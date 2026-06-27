import { useCallback, useRef, useState } from 'react'
import { Chess } from 'chess.js'

import * as api from '@/lib/api'
import { START_FEN } from '@/lib/chess-assets'
import { playMoveSound } from '@/lib/sound'
import type { MoveData } from '@/lib/types'
import { useAuth } from './useAuth'
import type { EvalInfo, Highlight } from './useAnalysis'

export interface PlayGameOver {
  result: string | null
  reason: string | null
  winner: 'white' | 'black' | null
}

export interface UsePlay {
  started: boolean
  elo: number
  userColor: 'white' | 'black'
  orientation: 'white' | 'black'
  fen: string
  moves: MoveData[] // every ply (your moves AND the bot's), each scored like analysis
  currentFen: string
  evalInfo: EvalInfo
  highlight: Highlight | null
  animationMs: number
  thinking: boolean
  reviewing: boolean
  reviewIndex: number
  status: string
  gameOver: PlayGameOver | null
  feedback: MoveData | null // the card shown under the board
  setElo: (elo: number) => void
  setUserColor: (c: 'white' | 'black') => void
  start: () => void
  newGame: () => void
  flip: () => void
  resign: () => void
  reviewMove: (index: number) => void
  resume: () => void
  onPieceDrop: (source: string, target: string) => boolean
}

export function usePlay(): UsePlay {
  const { settings, user } = useAuth()

  const [started, setStarted] = useState(false)
  const [elo, setElo] = useState(1200)
  const [userColor, setUserColor] = useState<'white' | 'black'>('white')
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [fen, setFen] = useState(START_FEN)
  const [moves, setMoves] = useState<MoveData[]>([])
  const [evalInfo, setEvalInfo] = useState<EvalInfo>({ eval: 0, mate: null })
  const [highlight, setHighlight] = useState<Highlight | null>(null)
  const [animationMs, setAnimationMs] = useState(260)
  const [thinking, setThinking] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(-1)
  const [status, setStatus] = useState('Choose a level and color to start')
  const [gameOver, setGameOver] = useState<PlayGameOver | null>(null)

  // Authoritative game state lives in refs so the async move handler never races
  // a stale closure.
  const chessRef = useRef(new Chess())
  const liveFenRef = useRef(START_FEN)
  const liveHighlightRef = useRef<Highlight | null>(null)
  const thinkingRef = useRef(false)
  const reviewingRef = useRef(false)
  const gameOverRef = useRef(false)
  const eloRef = useRef(elo)
  eloRef.current = elo
  // A separate Chess instance that accumulates *every* move (user + bot) in
  // order, kept only for exporting a PGN of the finished game. The authoritative
  // `chessRef` is rebuilt from FENs as moves stream back and so loses history.
  const historyRef = useRef(new Chess())
  const savedRef = useRef(false)
  const userRef = useRef(user)
  userRef.current = user

  const overText = (g: PlayGameOver): string => {
    if (g.winner === null) return `Draw — ${g.reason ?? 'game over'}.`
    const won = g.winner === userColor
    if (g.reason === 'checkmate') return won ? 'Checkmate — you win!' : 'Checkmate — the bot wins.'
    if (g.reason === 'resignation') return won ? 'The bot resigned — you win!' : 'You resigned — the bot wins.'
    return won ? 'You win!' : 'The bot wins.'
  }

  const applyGameOver = useCallback(
    (g: PlayGameOver) => {
      gameOverRef.current = true
      setGameOver(g)
      setStatus(overText(g))
      // Persist the finished game (best-effort) so it can be reviewed later.
      if (!savedRef.current && historyRef.current.history().length > 0) {
        savedRef.current = true
        const h = historyRef.current
        const botName = `Stockfish (${eloRef.current})`
        const you = userRef.current?.username || 'You'
        h.header(
          'Event', 'Play vs Bot',
          'Site', 'Chess Analysis',
          'White', userColor === 'white' ? you : botName,
          'Black', userColor === 'black' ? you : botName,
          'Result', g.result || '*',
        )
        void api.saveBotGame({
          pgn: h.pgn(),
          user_color: userColor,
          elo: eloRef.current,
          result: g.result,
          reason: g.reason,
        })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userColor],
  )

  const resetTo = useCallback((color: 'white' | 'black') => {
    const c = new Chess()
    chessRef.current = c
    historyRef.current = new Chess()
    savedRef.current = false
    liveFenRef.current = c.fen()
    liveHighlightRef.current = null
    thinkingRef.current = false
    reviewingRef.current = false
    gameOverRef.current = false
    setReviewing(false)
    setReviewIndex(-1)
    setThinking(false)
    setGameOver(null)
    setMoves([])
    setHighlight(null)
    setEvalInfo({ eval: 0, mate: null })
    setAnimationMs(0)
    setFen(c.fen())
    setOrientation(color)
  }, [])

  // Pull a bot move (its opening move as White) and apply it.
  const requestBotOpening = useCallback(async () => {
    thinkingRef.current = true
    setThinking(true)
    setStatus('Bot is thinking…')
    try {
      const res = await api.botMove(liveFenRef.current, eloRef.current, settings.engine_depth)
      chessRef.current = new Chess(res.fen)
      liveFenRef.current = res.fen
      if (res.bot) {
        setAnimationMs(260)
        setFen(res.bot.fen)
        const hl = { from: res.bot.from, to: res.bot.to }
        liveHighlightRef.current = hl
        setHighlight(hl)
        playMoveSound(res.bot.san.includes('x'), !!settings.sound_enabled, settings.sound_style)
        try { historyRef.current.move(res.bot.san) } catch { /* best-effort PGN history */ }
        if (res.bot_feedback) setMoves((prev) => [...prev, res.bot_feedback!])
      }
      setEvalInfo({ eval: res.eval, mate: res.mate })
      if (res.game_over) applyGameOver({ result: res.result, reason: res.reason, winner: res.winner })
      else setStatus('Your move')
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`)
    } finally {
      thinkingRef.current = false
      setThinking(false)
    }
  }, [applyGameOver, settings.engine_depth, settings.sound_enabled, settings.sound_style])

  const start = useCallback(() => {
    resetTo(userColor)
    setStarted(true)
    setStatus(userColor === 'white' ? 'Your move' : 'Bot is thinking…')
    if (userColor === 'black') void requestBotOpening()
  }, [userColor, resetTo, requestBotOpening])

  const newGame = useCallback(() => {
    setStarted(false)
    resetTo(userColor)
    setStatus('Choose a level and color to start')
  }, [userColor, resetTo])

  const flip = useCallback(() => setOrientation((o) => (o === 'white' ? 'black' : 'white')), [])

  const resign = useCallback(() => {
    if (gameOverRef.current || !started) return
    applyGameOver({
      result: userColor === 'white' ? '0-1' : '1-0',
      reason: 'resignation',
      winner: userColor === 'white' ? 'black' : 'white',
    })
  }, [started, userColor, applyGameOver])

  const reviewMove = useCallback((index: number) => {
    setMoves((list) => {
      const m = list[index]
      if (m) {
        reviewingRef.current = true
        setReviewing(true)
        setReviewIndex(index)
        setAnimationMs(0)
        setFen(m.fen)
        setHighlight({ from: m.from, to: m.to })
        setEvalInfo({ eval: m.eval, mate: m.mate_in })
      }
      return list
    })
  }, [])

  const resume = useCallback(() => {
    reviewingRef.current = false
    setReviewing(false)
    setReviewIndex(-1)
    setAnimationMs(0)
    setFen(liveFenRef.current)
    setHighlight(liveHighlightRef.current)
  }, [])

  const submitMove = useCallback(
    async (beforeFen: string, uci: string) => {
      try {
        const res = await api.playMove(beforeFen, uci, eloRef.current, settings.engine_depth)
        // Append your move and (if it replied) the bot's move as scored plies.
        setMoves((prev) => (res.bot_feedback ? [...prev, res.feedback, res.bot_feedback] : [...prev, res.feedback]))
        chessRef.current = new Chess(res.fen)
        liveFenRef.current = res.fen
        // Accumulate the user's move (then the bot's reply) for the PGN export.
        try {
          historyRef.current.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
          })
          if (res.bot) historyRef.current.move(res.bot.san)
        } catch { /* best-effort PGN history */ }
        if (res.bot) {
          setAnimationMs(260)
          setFen(res.bot.fen)
          const hl = { from: res.bot.from, to: res.bot.to }
          liveHighlightRef.current = hl
          setHighlight(hl)
          playMoveSound(res.bot.san.includes('x'), !!settings.sound_enabled, settings.sound_style)
        } else {
          setFen(res.fen)
        }
        setEvalInfo({ eval: res.eval, mate: res.mate })
        if (res.game_over) applyGameOver({ result: res.result, reason: res.reason, winner: res.winner })
        else setStatus('Your move')
      } catch (e) {
        // Roll back the optimistic user move and resync to the live position.
        setFen(liveFenRef.current)
        setHighlight(liveHighlightRef.current)
        setStatus(`Error: ${(e as Error).message}`)
      } finally {
        thinkingRef.current = false
        setThinking(false)
      }
    },
    [applyGameOver, settings.engine_depth, settings.sound_enabled, settings.sound_style],
  )

  const onPieceDrop = useCallback(
    (source: string, target: string): boolean => {
      if (!started || thinkingRef.current || reviewingRef.current || gameOverRef.current) return false
      const beforeFen = chessRef.current.fen()
      const game = new Chess(beforeFen)
      let move
      try {
        move = game.move({ from: source, to: target, promotion: 'q' })
      } catch {
        return false
      }
      if (!move) return false
      // Accept locally and show it immediately; the bot's reply streams back.
      chessRef.current = game
      const uci = move.from + move.to + (move.promotion || '')
      setAnimationMs(260)
      setFen(game.fen())
      setHighlight({ from: move.from, to: move.to })
      playMoveSound(!!move.captured, !!settings.sound_enabled, settings.sound_style)
      thinkingRef.current = true
      setThinking(true)
      setStatus('Bot is thinking…')
      void submitMove(beforeFen, uci)
      return true
    },
    [started, submitMove, settings.sound_enabled, settings.sound_style],
  )

  const feedback =
    reviewing && reviewIndex >= 0 ? moves[reviewIndex] ?? null : moves[moves.length - 1] ?? null

  return {
    started,
    elo,
    userColor,
    orientation,
    fen,
    moves,
    currentFen: fen,
    evalInfo,
    highlight,
    animationMs,
    thinking,
    reviewing,
    reviewIndex,
    status,
    gameOver,
    feedback,
    setElo,
    setUserColor,
    start,
    newGame,
    flip,
    resign,
    reviewMove,
    resume,
    onPieceDrop,
  }
}
