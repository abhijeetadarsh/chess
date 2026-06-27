import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { NavigationBar } from '@capgo/capacitor-navigation-bar'

export const isNative = Capacitor.isNativePlatform()

/**
 * Make the WebView draw *under* the status bar (edge-to-edge), so the app fills
 * the screen instead of sitting inside a framed browser-like band. The top bars
 * pad themselves with `env(safe-area-inset-top)` so nothing hides behind the
 * clock. No-op on the web build. Call once at startup.
 */
export function initNativeShell(): void {
  if (!isNative) return
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
}

/** Convert an `H S% L%` CSS-var triple (Tailwind format) to a `#rrggbb` string. */
function hslTripleToHex(triple: string): string | null {
  const m = triple.trim().match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/)
  if (!m) return null
  const h = +m[1]
  const s = +m[2] / 100
  const l = +m[3] / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** The resolved background of the bottom tab bar (`--card`) for the active theme. */
function cardColorHex(): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--card')
    return hslTripleToHex(v) ?? '#000000'
  } catch {
    return '#000000'
  }
}

/**
 * Keep the native system bars in sync with the active theme:
 *  - Status-bar icons use the *contrasting* colour so they stay legible
 *    (dark icons on a light theme, light icons on a dark theme).
 *  - The bottom navigation bar is painted the same colour as the tab bar
 *    (`--card`) so there's no mismatched strip at the very bottom.
 *
 * Call *after* `document.documentElement.dataset.theme` has been updated so the
 * resolved `--card` value reflects the new theme. No-op on the web build.
 */
export function syncSystemBars(themeIsLight: boolean): void {
  if (!isNative) return
  // Capacitor semantics are inverted from what the names suggest:
  //   Style.Light = dark icons (for a LIGHT background)
  //   Style.Dark  = light icons (for a DARK background)
  StatusBar.setStyle({ style: themeIsLight ? Style.Light : Style.Dark }).catch(() => {})
  NavigationBar.setNavigationBarColor({ color: cardColorHex() }).catch(() => {})
}
