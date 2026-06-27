import { type UsePlay } from '@/hooks/usePlay'
import { type MobileSection } from './MobileNav'
import { PlayScreen } from './PlayScreen'
import { PlayDesktop } from './PlayDesktop'

/**
 * Picks the Play-vs-Bot layout. The game state (`play`) is owned by App so it
 * survives navigating to an analysis tab and back, and survives a resize across
 * the desktop breakpoint — crossing 1024px swaps the layout but keeps the game.
 */
export function PlayMode({
  wide,
  play,
  onClose,
  onOpenSettings,
  onSelectNav,
}: {
  wide: boolean
  play: UsePlay
  onClose: () => void
  onOpenSettings: () => void
  onSelectNav: (section: MobileSection) => void
}) {
  return wide ? (
    <PlayDesktop play={play} onClose={onClose} onOpenSettings={onOpenSettings} />
  ) : (
    <PlayScreen play={play} onClose={onClose} onOpenSettings={onOpenSettings} onSelectNav={onSelectNav} />
  )
}
