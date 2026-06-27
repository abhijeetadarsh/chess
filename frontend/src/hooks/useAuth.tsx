import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import * as api from '@/lib/api'
import { syncSystemBars } from '@/lib/native'
import type { AuthUser, UserSettings } from '@/lib/types'

export const DEFAULT_SETTINGS: UserSettings = {
  chesscom_username: '',
  lichess_username: '',
  default_games: 10,
  default_source: 'chesscom',
  sound_enabled: 1,
  sound_style: 'wood',
  tap_to_move: 0,
  ui_theme: 'light',
  board_theme: 'green',
  piece_set: 'cburnett',
  engine_depth: 14,
}

function loadLocalSettings(): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    ui_theme: localStorage.getItem('ca_ui') || DEFAULT_SETTINGS.ui_theme,
    board_theme: localStorage.getItem('ca_board') || DEFAULT_SETTINGS.board_theme,
    piece_set: localStorage.getItem('ca_pieces') || DEFAULT_SETTINGS.piece_set,
    sound_enabled: localStorage.getItem('ca_sound') === 'off' ? 0 : 1,
    sound_style: localStorage.getItem('ca_sound_style') || DEFAULT_SETTINGS.sound_style,
    tap_to_move: localStorage.getItem('ca_tap_to_move') === '1' ? 1 : 0,
  }
}

const LOCAL_KEYS: Partial<Record<keyof UserSettings, string>> = {
  ui_theme: 'ca_ui',
  board_theme: 'ca_board',
  piece_set: 'ca_pieces',
  sound_style: 'ca_sound_style',
  tap_to_move: 'ca_tap_to_move',
}

interface AuthContextValue {
  user: AuthUser | null
  settings: UserSettings
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [settings, setSettings] = useState<UserSettings>(loadLocalSettings)
  const [loading, setLoading] = useState(true)

  // Apply the interface theme to <html data-theme> whenever it changes.
  useEffect(() => {
    const theme = settings.ui_theme || 'light'
    document.documentElement.dataset.theme = theme
    // Only 'light' is a light theme; every other preset is dark.
    syncSystemBars(theme === 'light')
  }, [settings.ui_theme])

  // Validate an existing token on mount and pull server-side settings.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!api.getToken()) {
        setLoading(false)
        return
      }
      try {
        const me = await api.fetchMe()
        if (cancelled) return
        setUser({ id: me.id, username: me.username, email: me.email, settings: me.settings })
        setSettings({ ...DEFAULT_SETTINGS, ...me.settings })
      } catch {
        api.clearToken()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password)
    api.setToken(res.token)
    setUser({ id: res.user_id, username: res.username, settings: res.settings })
    setSettings({ ...DEFAULT_SETTINGS, ...res.settings })
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const res = await api.register(username, password)
    api.setToken(res.token)
    setUser({ id: res.user_id, username: res.username, settings: res.settings })
    setSettings({ ...DEFAULT_SETTINGS, ...res.settings })
  }, [])

  const logout = useCallback(async () => {
    await api.logoutRequest()
    api.clearToken()
    setUser(null)
  }, [])

  const updateSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((s) => ({ ...s, [key]: value }))
      const lk = LOCAL_KEYS[key]
      if (lk) localStorage.setItem(lk, String(value))
      if (key === 'sound_enabled') localStorage.setItem('ca_sound', value ? 'on' : 'off')
      api.saveSettings({ [key]: value } as Partial<UserSettings>)
    },
    [],
  )

  return (
    <AuthContext.Provider value={{ user, settings, loading, login, register, logout, updateSetting }}>
      {children}
    </AuthContext.Provider>
  )
}
