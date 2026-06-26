import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

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

/** Keep the status-bar icon colour readable against the active theme. */
export function syncStatusBarStyle(themeIsLight: boolean): void {
  if (!isNative) return
  // Style.Dark = dark icons (for a light background); Style.Light = light icons.
  StatusBar.setStyle({ style: themeIsLight ? Style.Dark : Style.Light }).catch(() => {})
}
