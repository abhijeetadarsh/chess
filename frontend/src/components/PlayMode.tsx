import { usePlay } from '@/hooks/usePlay'
import { PlayScreen } from './PlayScreen'
import { PlayDesktop } from './PlayDesktop'

/**
 * Owns the play game state and picks the layout. The hook lives here (not inside
 * either layout) so the game survives a resize across the desktop breakpoint —
 * crossing 1024px swaps the layout but keeps the same `usePlay` instance.
 */
export function PlayMode({
  wide,
  onClose,
  onOpenSettings,
}: {
  wide: boolean
  onClose: () => void
  onOpenSettings: () => void
}) {
  const play = usePlay()

  return wide ? (
    <PlayDesktop play={play} onClose={onClose} onOpenSettings={onOpenSettings} />
  ) : (
    <PlayScreen play={play} onClose={onClose} />
  )
}
