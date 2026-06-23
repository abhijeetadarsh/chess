import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import type { UseAnalysis } from '@/hooks/useAnalysis'
import { SPEED_PRESETS } from '@/lib/chess-assets'
import type { GameInfo } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

function resultClass(r: string) {
  return r === 'win' ? 'text-good' : r === 'lose' ? 'text-blunder' : 'text-muted-foreground'
}

export function SourcesPanel({
  analysis,
  collapsed,
  onToggleCollapse,
  onOpenSettings,
}: {
  analysis: UseAnalysis
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenSettings: () => void
}) {
  const { settings, updateSetting } = useAuth()
  const [tab, setTab] = useState(
    ['chesscom', 'lichess', 'pgn'].includes(settings.default_source) ? settings.default_source : 'chesscom',
  )
  const [ccUser, setCcUser] = useState(settings.chesscom_username)
  const [lcUser, setLcUser] = useState(settings.lichess_username)
  const [limit, setLimit] = useState(settings.default_games)
  const [pgnText, setPgnText] = useState('')

  if (collapsed) {
    return (
      <div className="flex w-10 flex-col items-center gap-1.5 overflow-hidden rounded-xl border bg-card py-3 shadow">
        <span className="text-lg">♟</span>
        <button
          onClick={onOpenSettings}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Settings"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Expand"
        >
          <PanelLeftOpen className="h-[18px] w-[18px]" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow">
      {/* Brand + actions */}
      <div className="flex flex-shrink-0 items-center justify-between border-b px-3.5 py-3">
        <span className="flex items-center gap-1.5 truncate text-sm font-extrabold tracking-tight">
          ♟ Chess Analysis
        </span>
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button
            onClick={onOpenSettings}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Settings"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Collapse"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Fetch form */}
      <div className="flex-shrink-0 px-4 pb-4 pt-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="chesscom" className="flex-1">
              Chess.com
            </TabsTrigger>
            <TabsTrigger value="lichess" className="flex-1">
              Lichess
            </TabsTrigger>
            <TabsTrigger value="pgn" className="flex-1">
              PGN
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chesscom" className="space-y-2.5">
            <div className="flex gap-2">
              <Input placeholder="Username (e.g. hikaru)" value={ccUser} onChange={(e) => setCcUser(e.target.value)} />
              <Input
                type="number"
                className="w-16 text-center"
                min={1}
                max={50}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </div>
            <Button className="w-full" onClick={() => analysis.fetchGamesFor('chesscom', ccUser, limit)}>
              Fetch games
            </Button>
          </TabsContent>

          <TabsContent value="lichess" className="space-y-2.5">
            <div className="flex gap-2">
              <Input placeholder="Username (e.g. DrNykterstein)" value={lcUser} onChange={(e) => setLcUser(e.target.value)} />
              <Input
                type="number"
                className="w-16 text-center"
                min={1}
                max={50}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </div>
            <Button className="w-full" onClick={() => analysis.fetchGamesFor('lichess', lcUser, limit)}>
              Fetch games
            </Button>
          </TabsContent>

          <TabsContent value="pgn" className="space-y-2.5">
            <textarea
              className="h-[104px] w-full resize-none rounded-md border border-transparent bg-secondary/60 p-3 font-mono text-xs outline-none transition-colors focus:border-primary focus:bg-card focus:ring-2 focus:ring-ring"
              placeholder="Paste PGN here..."
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              rows={5}
            />
            <Button className="w-full" onClick={() => analysis.analyzePgn(pgnText, null)}>
              Analyze PGN
            </Button>
          </TabsContent>
        </Tabs>

        {/* Engine speed */}
        <div className="mt-4">
          <div className="mb-2 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
            Engine speed
          </div>
          <div className="flex gap-0.5 rounded-lg bg-muted p-1">
            {SPEED_PRESETS.map((p) => (
              <button
                key={p.depth}
                onClick={() => updateSetting('engine_depth', p.depth)}
                className={cn(
                  'flex-1 rounded-md px-1.5 py-1.5 text-sm font-semibold transition-all',
                  settings.engine_depth === p.depth
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-[0.72rem] text-muted-foreground">
            {SPEED_PRESETS.find((p) => p.depth === settings.engine_depth)?.hint ?? ''}
          </div>
        </div>
      </div>

      {/* Games list */}
      <div className="flex-shrink-0 border-t px-4 py-3 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
        Games
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3 [overscroll-behavior:contain]">
        {analysis.games.length === 0 ? (
          <div className="flex h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Fetch games above, or paste a PGN.
          </div>
        ) : (
          analysis.games.map((g, i) => (
            <GameItem
              key={i}
              game={g}
              selected={i === analysis.selectedGameIndex}
              onClick={() => analysis.selectGame(i)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function GameItem({ game, selected, onClick }: { game: GameInfo; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'mb-2 cursor-pointer rounded-xl border border-transparent bg-secondary/60 p-3 transition-all hover:-translate-y-px hover:shadow',
        selected && 'border-primary ring-1 ring-primary',
      )}
    >
      <div className="mb-1.5 text-sm font-semibold leading-snug">
        <span className={resultClass(game.white_result)}>
          ⬜ {game.white}
          {game.white_rating ? ` (${game.white_rating})` : ''}
        </span>
        <br />
        <span className={resultClass(game.black_result)}>
          ⬛ {game.black}
          {game.black_rating ? ` (${game.black_rating})` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5 text-[0.71rem] text-muted-foreground">
        <span>{game.time_class}</span>
        <span>{game.time_control}</span>
        <span>{game.rated ? '🏆 Rated' : 'Casual'}</span>
        {game.opening && <span>{game.opening}</span>}
      </div>
    </div>
  )
}
