import { useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { BOARD_THEMES, PIECE_SETS, SOUND_OPTIONS, SPEED_PRESETS, UI_THEMES, pieceUrl } from '@/lib/chess-assets'
import { previewMoveSound } from '@/lib/sound'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

function initials(name: string) {
  const parts = name.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/)
  const i = parts.map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return i || name[0]?.toUpperCase() || '?'
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3.5 text-[0.64rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </div>
  )
}

export function SettingsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, settings, updateSetting, logout } = useAuth()
  const [cc, setCc] = useState(settings.chesscom_username)
  const [lc, setLc] = useState(settings.lichess_username)
  const [ccSaved, setCcSaved] = useState(false)
  const [lcSaved, setLcSaved] = useState(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[428px] max-w-full flex-col p-0 sm:max-w-none">
        <SheetHeader className="flex-shrink-0 border-b px-5 py-4">
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className="scrollbar-thin flex-1 overflow-y-auto pb-10">
          {/* Account */}
          <div className="px-5 pt-5">
            <SectionTitle>Account</SectionTitle>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-base font-extrabold text-primary-foreground">
                {user ? initials(user.username) : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{user?.username ?? '—'}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Chess Analysis account</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => logout()}>
                Logout
              </Button>
            </div>
          </div>

          <Separator className="my-5" />

          {/* Chess Accounts */}
          <div className="px-5">
            <SectionTitle>Chess Accounts</SectionTitle>
            <div className="mb-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Chess.com Username</Label>
              <div className="flex gap-2">
                <Input value={cc} placeholder="e.g. hikaru" onChange={(e) => setCc(e.target.value)} />
                <Button
                  size="sm"
                  onClick={() => {
                    updateSetting('chesscom_username', cc)
                    setCcSaved(true)
                    setTimeout(() => setCcSaved(false), 1500)
                  }}
                >
                  {ccSaved ? 'Saved ✓' : 'Save'}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Lichess Username</Label>
              <div className="flex gap-2">
                <Input value={lc} placeholder="e.g. DrNykterstein" onChange={(e) => setLc(e.target.value)} />
                <Button
                  size="sm"
                  onClick={() => {
                    updateSetting('lichess_username', lc)
                    setLcSaved(true)
                    setTimeout(() => setLcSaved(false), 1500)
                  }}
                >
                  {lcSaved ? 'Saved ✓' : 'Save'}
                </Button>
              </div>
            </div>
          </div>

          <Separator className="my-5" />

          {/* Fetch Defaults */}
          <div className="px-5">
            <SectionTitle>Fetch Defaults</SectionTitle>
            <div className="mb-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Default Source</Label>
              <Segmented
                options={[
                  { value: 'chesscom', label: 'Chess.com' },
                  { value: 'lichess', label: 'Lichess' },
                  { value: 'pgn', label: 'PGN' },
                ]}
                value={settings.default_source}
                onChange={(v) => updateSetting('default_source', v)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Default Games to Fetch</Label>
              <Input
                type="number"
                min={1}
                max={50}
                className="w-24"
                value={settings.default_games}
                onChange={(e) => updateSetting('default_games', Number(e.target.value) || 10)}
              />
            </div>
          </div>

          <Separator className="my-5" />

          {/* Engine */}
          <div className="px-5">
            <SectionTitle>Engine Speed</SectionTitle>
            <Segmented
              options={SPEED_PRESETS.map((p) => ({ value: String(p.depth), label: p.label }))}
              value={String(settings.engine_depth)}
              onChange={(v) => updateSetting('engine_depth', Number(v))}
            />
            <div className="mt-1.5 text-[0.72rem] text-muted-foreground">
              {SPEED_PRESETS.find((p) => p.depth === settings.engine_depth)?.hint}
            </div>
          </div>

          <Separator className="my-5" />

          {/* Appearance */}
          <div className="px-5">
            <SectionTitle>Appearance</SectionTitle>
            <div className="mb-4 space-y-2">
              <Label className="text-xs text-muted-foreground">Interface Theme</Label>
              <div className="flex flex-wrap gap-2.5">
                {Object.entries(UI_THEMES).map(([key, t]) => (
                  <button
                    key={key}
                    title={t.label}
                    onClick={() => updateSetting('ui_theme', key)}
                    style={{ background: t.bg, borderColor: t.dot }}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-transform hover:scale-110',
                      settings.ui_theme === key && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                    )}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.dot }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <Label className="text-xs text-muted-foreground">Board Colors</Label>
              <div className="flex flex-wrap gap-2.5">
                {Object.entries(BOARD_THEMES).map(([key, [l, d]]) => (
                  <button
                    key={key}
                    title={key}
                    onClick={() => updateSetting('board_theme', key)}
                    style={{ background: `linear-gradient(135deg, ${l} 0 50%, ${d} 50% 100%)` }}
                    className={cn(
                      'h-8 w-8 rounded-lg border-2 border-transparent transition-transform hover:scale-110',
                      settings.board_theme === key && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Piece Set</Label>
              <div className="flex items-center gap-2.5">
                <Select value={settings.piece_set} onValueChange={(v) => updateSetting('piece_set', v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIECE_SETS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <img src={pieceUrl(settings.piece_set, 'wN')} alt="" width={36} height={36} />
              </div>
            </div>
          </div>

          <Separator className="my-5" />

          {/* Sound */}
          <div className="px-5">
            <SectionTitle>Sound</SectionTitle>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Piece move sounds</div>
                <div className="mt-0.5 text-[0.73rem] text-muted-foreground">
                  Plays a click when pieces move
                </div>
              </div>
              <Switch
                checked={!!settings.sound_enabled}
                onCheckedChange={(v) => updateSetting('sound_enabled', v ? 1 : 0)}
              />
            </div>

            <div className="mt-4 space-y-2">
              <Label className="text-xs text-muted-foreground">Sound Style</Label>
              <Select
                value={settings.sound_style}
                onValueChange={(v) => {
                  updateSetting('sound_style', v)
                  previewMoveSound(v) // play a one-shot preview so the choice is audible
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOUND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => previewMoveSound(settings.sound_style)}
                className="text-[0.72rem] font-medium text-primary hover:underline"
              >
                ▶ Play preview
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-md px-1.5 py-1.5 text-sm font-semibold transition-all',
            value === o.value
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
