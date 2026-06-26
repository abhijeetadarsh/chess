import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { initNativeShell } from './lib/native'

// Edge-to-edge status bar on the native (Capacitor) build; no-op on web.
initNativeShell()

// NOTE: StrictMode is intentionally omitted — react-chessboard's underlying
// react-dnd HTML5 backend throws "Cannot have two HTML5 backends" when the tree
// is double-mounted in development StrictMode.
createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
)
