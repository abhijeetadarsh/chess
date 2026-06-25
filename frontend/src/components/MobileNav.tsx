import { type ReactNode } from 'react'
import { Bot, Gamepad2, ListOrdered, Swords } from 'lucide-react'

import { cn } from '@/lib/utils'

export type MobileSection = 'board' | 'moves' | 'games' | 'play'

/**
 * Persistent bottom navigation for the mobile/tablet layouts. Lives in both the
 * analysis layout and the Play-vs-Bot screen so it never disappears as you move
 * between them. `Play` is its own section; the other three are analysis tabs.
 */
export function MobileNav({
  active,
  onSelect,
  movesBadge,
}: {
  active: MobileSection
  onSelect: (section: MobileSection) => void
  movesBadge?: number
}) {
  return (
    <nav className="z-20 flex flex-shrink-0 items-stretch border-t bg-card pb-[env(safe-area-inset-bottom)]">
      <TabButton active={active === 'board'} onClick={() => onSelect('board')} icon={<Swords className="h-5 w-5" />} label="Board" />
      <TabButton
        active={active === 'moves'}
        onClick={() => onSelect('moves')}
        icon={<ListOrdered className="h-5 w-5" />}
        label="Moves"
        badge={movesBadge}
      />
      <TabButton active={active === 'games'} onClick={() => onSelect('games')} icon={<Gamepad2 className="h-5 w-5" />} label="Games" />
      <TabButton active={active === 'play'} onClick={() => onSelect('play')} icon={<Bot className="h-5 w-5" />} label="Play" />
    </nav>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[0.66rem] font-semibold transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span className="relative">
        {icon}
        {badge ? (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blunder px-1 text-[0.6rem] font-bold leading-none text-white">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </button>
  )
}
