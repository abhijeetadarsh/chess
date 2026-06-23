import { useCallback, useRef, useState } from 'react'
import { Chess } from 'chess.js'

import * as api from '@/lib/api'
import { START_FEN } from '@/lib/chess-assets'
import { playMoveSound } from '@/lib/sound'
import type { ClassSummary, GameInfo, MoveData, StreamEvent } from '@/lib/types'
import { useAuth } from './useAuth'

export interface Highlight {
  from: string
  to: string
}
export interface EvalInfo {
  eval: number
  mate: number | null
}
interface Meta {
  white: string
  black: string
  result: string
  opening: string
}

export interface UseAnalysis {
  games: GameInfo[]
  fetchedUser: string
  moves: MoveData[]
  currentIndex: number
  orientation: 'white' | 'black'
  currentFen: string
  meta: Meta | null
  accuracies: { white: number; black: number } | null
  summary: { white: ClassSummary; black: ClassSummary } | null
  status: string
  streaming: boolean
  progress: number
  exploring: boolean
  evalInfo: EvalInfo
  exploreHint: string
  highlight: Highlight | null
  selectedGameIndex: number
  fetchGamesFor: (source: 'chesscom' | 'lichess', username: string, limit: number) => Promise<void>
  analyzePgn: (pgn: string, gameInfo?: GameInfo | null) => Promise<void>
  selectGame: (index: number) => void
  goToMove: (index: number) => void
  flip: () => void
  playAlternative: (index: number, uci: string) => void
  onPieceDrop: (source: string, target: string) => boolean
  backToGame: () => void
}

export function useAnalysis(): UseAnalysis {
  const { settings } = useAuth()

  const [games, setGames] = useState<GameInfo[]>([])
  const [fetchedUser, setFetchedUser] = useState('')
  const [selectedGameIndex, setSelectedGameIndex] = useState(-1)
  const [moves, setMoves] = useState<MoveData[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [currentFen, setCurrentFen] = useState(START_FEN)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [accuracies, setAccuracies] = useState<{ white: number; black: number } | null>(null)
  const [summary, setSummary] = useState<{ white: ClassSummary; black: ClassSummary } | null>(null)
  const [status, setStatus] = useState('Ready')
  const [streaming, setStreaming] = useState(false)
  const [progress, setProgress] = useState(0)
  const [exploring, setExploring] = useState(false)
  const [evalInfo, setEvalInfo] = useState<EvalInfo>({ eval: 0, mate: null })
  const [exploreHint, setExploreHint] = useState('Drag pieces to test moves')
  const [highlight, setHighlight] = useState<Highlight | null>(null)

  const exploreChessRef = useRef<Chess | null>(null)
  const exploreReturnRef = useRef(-1)
  const evalSeqRef = useRef(0)
  const evalTimerRef = useRef<number | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const movesRef = useRef<MoveData[]>([])
  const streamingRef = useRef(false)

  // keep refs that callbacks rely on in sync
  movesRef.current = moves

  const requestEval = useCallback((fen: string) => {
    window.clearTimeout(evalTimerRef.current)
    const seq = ++evalSeqRef.current
    setExploreHint('Evaluating…')
    evalTimerRef.current = window.setTimeout(async () => {
      try {
        const d = await api.evaluateFen(fen, 12)
        if (seq !== evalSeqRef.current) return
        setEvalInfo({ eval: d.eval, mate: d.mate })
        setExploreHint(
          d.game_over
            ? 'Game over in this line'
            : `Engine: ${d.mate != null ? '#' + d.mate : (d.eval >= 0 ? '+' : '') + d.eval}` +
                (d.best_san ? ` · best ${d.best_san}` : ''),
        )
      } catch {
        if (seq === evalSeqRef.current) setExploreHint('Eval unavailable')
      }
    }, 250)
  }, [])

  const enterExplore = useCallback((returnIndex: number) => {
    exploreReturnRef.current = returnIndex
    setExploring(true)
    setExploreHint('Drag pieces to test moves')
  }, [])

  const exitExplore = useCallback(() => {
    exploreChessRef.current = null
    evalSeqRef.current++
    setExploring(false)
  }, [])

  const goToMove = useCallback(
    (index: number) => {
      exploreChessRef.current = null
      setExploring(false)
      setCurrentIndex((prev) => {
        const list = movesRef.current
        const fen = index < 0 ? START_FEN : list[index]?.fen ?? START_FEN
        setCurrentFen(fen)
        if (index >= 0 && list[index]) {
          setHighlight({ from: list[index].from, to: list[index].to })
          setEvalInfo({ eval: list[index].eval, mate: list[index].mate_in })
          if (index !== prev) playMoveSound(list[index].san.includes('x'), !!settings.sound_enabled)
        } else {
          setHighlight(null)
          setEvalInfo({ eval: 0, mate: null })
        }
        return index
      })
    },
    [settings.sound_enabled],
  )

  const flip = useCallback(() => {
    setOrientation((o) => (o === 'white' ? 'black' : 'white'))
  }, [])

  const onPieceDrop = useCallback(
    (source: string, target: string): boolean => {
      const chess = exploreChessRef.current ?? new Chess(currentFen)
      let move
      try {
        move = chess.move({ from: source, to: target, promotion: 'q' })
      } catch {
        return false
      }
      if (!move) return false
      exploreChessRef.current = chess
      const fen = chess.fen()
      setCurrentFen(fen)
      if (!exploring) enterExplore(currentIndex)
      setHighlight({ from: move.from, to: move.to })
      playMoveSound(!!move.captured, !!settings.sound_enabled)
      requestEval(fen)
      setStatus(`Testing: ${move.san}`)
      return true
    },
    [currentFen, exploring, currentIndex, enterExplore, requestEval, settings.sound_enabled],
  )

  const playAlternative = useCallback(
    (index: number, uci: string) => {
      if (!uci) return
      const list = movesRef.current
      const beforeFen = index <= 0 ? START_FEN : list[index - 1]?.fen ?? START_FEN
      const chess = new Chess(beforeFen)
      let move
      try {
        move = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : 'q',
        })
      } catch {
        return
      }
      if (!move) return
      exploreChessRef.current = chess
      const fen = chess.fen()
      enterExplore(index)
      setCurrentFen(fen)
      setHighlight({ from: move.from, to: move.to })
      playMoveSound(!!move.captured, !!settings.sound_enabled)
      requestEval(fen)
      setStatus(`Trying engine move: ${move.san}`)
    },
    [enterExplore, requestEval, settings.sound_enabled],
  )

  const backToGame = useCallback(() => {
    goToMove(exploreReturnRef.current)
  }, [goToMove])

  const handleEvent = useCallback((ev: StreamEvent, gameInfo?: GameInfo | null) => {
    if (ev.type === 'meta') {
      setMeta({
        white: gameInfo?.white ?? ev.white,
        black: gameInfo?.black ?? ev.black,
        result: ev.result,
        opening: ev.opening,
      })
      setAccuracies(null)
      setSummary(null)
      setCurrentIndex(-1)
      setCurrentFen(START_FEN)
      setHighlight(null)
      setEvalInfo({ eval: 0, mate: null })
    } else if (ev.type === 'move') {
      setMoves((prev) => [...prev, ev.data])
      setProgress((ev.index + 1) / ev.total)
      setStatus(`Analyzing… move ${ev.index + 1} / ${ev.total}`)
    } else if (ev.type === 'summary') {
      setAccuracies({ white: ev.white_accuracy, black: ev.black_accuracy })
      setSummary(ev.summary)
    } else if (ev.type === 'error') {
      setStatus(`Error: ${ev.detail}`)
    }
  }, [])

  const analyzePgn = useCallback(
    async (pgn: string, gameInfo?: GameInfo | null) => {
      if (streamingRef.current) {
        setStatus('Analysis already running…')
        return
      }
      if (!pgn || !pgn.trim()) {
        setStatus('No PGN to analyze')
        return
      }
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      streamingRef.current = true
      setStreaming(true)
      setMoves([])
      movesRef.current = []
      setCurrentIndex(-1)
      setCurrentFen(START_FEN)
      setHighlight(null)
      setProgress(0)
      setStatus(`Analyzing at depth ${settings.engine_depth}…`)
      try {
        for await (const ev of api.streamAnalysis(pgn, settings.engine_depth, ac.signal)) {
          handleEvent(ev, gameInfo)
        }
        setStatus('Analysis complete')
      } catch (e) {
        if (!ac.signal.aborted) setStatus(`Error: ${(e as Error).message}`)
      } finally {
        streamingRef.current = false
        setStreaming(false)
      }
    },
    [handleEvent, settings.engine_depth],
  )

  const fetchGamesFor = useCallback(
    async (source: 'chesscom' | 'lichess', username: string, limit: number) => {
      if (!username.trim()) {
        setStatus('Enter a username first')
        return
      }
      setStatus(`Fetching games for ${username}…`)
      try {
        const list = await api.fetchGames(source, username, limit)
        setGames(list)
        setFetchedUser(username)
        setSelectedGameIndex(-1)
        setStatus(`Fetched ${list.length} games for ${username}`)
      } catch (e) {
        setGames([])
        setStatus(`Error: ${(e as Error).message}`)
      }
    },
    [],
  )

  const selectGame = useCallback(
    (index: number) => {
      const g = games[index]
      if (!g) return
      setSelectedGameIndex(index)
      const u = fetchedUser.toLowerCase()
      setOrientation(u && (g.black || '').toLowerCase() === u ? 'black' : 'white')
      analyzePgn(g.pgn, g)
    },
    [games, fetchedUser, analyzePgn],
  )

  return {
    games,
    fetchedUser,
    moves,
    currentIndex,
    orientation,
    currentFen,
    meta,
    accuracies,
    summary,
    status,
    streaming,
    progress,
    exploring,
    evalInfo,
    exploreHint,
    highlight,
    selectedGameIndex,
    fetchGamesFor,
    analyzePgn,
    selectGame,
    goToMove,
    flip,
    playAlternative,
    onPieceDrop,
    backToGame,
  }
}
