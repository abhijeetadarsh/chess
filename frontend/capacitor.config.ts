import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.abhijeetadarsh.chessanalysis',
  appName: 'Chess Analysis',
  // Vite builds the SPA into frontend/dist; Capacitor bundles that into the APK.
  webDir: 'dist',
}

export default config
