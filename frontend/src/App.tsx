import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useAnalysis } from '@/hooks/useAnalysis'
import { usePlay } from '@/hooks/usePlay'
import { LoginPage } from '@/components/LoginPage'
import { SourcesPanel } from '@/components/SourcesPanel'
import { BoardPanel } from '@/components/BoardPanel'
import { AnalysisPanel } from '@/components/AnalysisPanel'
import { MobileLayout } from '@/components/MobileLayout'
import { type MobileSection } from '@/components/MobileNav'
import { PlayMode } from '@/components/PlayMode'
import { SettingsDrawer } from '@/components/SettingsDrawer'

function usePersistentToggle(key: string) {
  const [on, setOn] = useState(() => localStorage.getItem(key) === '1')
  const toggle = () =>
    setOn((v) => {
      localStorage.setItem(key, v ? '0' : '1')
      return !v
    })
  return [on, toggle] as const
}

function MainApp() {
  const analysis = useAnalysis()
  // Play state lives here (not inside PlayMode) so an in-progress game survives
  // navigating to an analysis tab and back via the persistent mobile nav.
  const play = usePlay()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mode, setMode] = useState<'analyze' | 'play'>('analyze')
  const [mobileTab, setMobileTab] = useState<'board' | 'moves' | 'games'>('games')
  const [sourcesCollapsed, toggleSources] = usePersistentToggle('ca_sources_col')
  const [analysisCollapsed, toggleAnalysis] = usePersistentToggle('ca_analysis_col')

  // Bottom-nav handler shared by the analysis layout and the Play screen, so the
  // nav behaves identically (and stays put) in both.
  const selectMobileNav = (section: MobileSection) => {
    if (section === 'play') setMode('play')
    else {
      setMode('analyze')
      setMobileTab(section)
    }
  }
  // Desktop-first: when the width is reported as 0 (some embedded renderers do
  // this on first paint) assume the wide 3-pane layout, then correct on resize.
  const [wide, setWide] = useState(() => (window.innerWidth === 0 ? true : window.innerWidth >= 1024))

  useEffect(() => {
    const compute = () => {
      if (window.innerWidth > 0) setWide(window.innerWidth >= 1024)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      {mode === 'play' ? (
        <PlayMode
          wide={wide}
          play={play}
          onClose={() => setMode('analyze')}
          onOpenSettings={() => setSettingsOpen(true)}
          onSelectNav={selectMobileNav}
        />
      ) : wide ? (
        <div
          className="grid h-screen gap-[18px] p-[18px] pt-[max(18px,env(safe-area-inset-top))]"
          style={{
            gridTemplateColumns: `${sourcesCollapsed ? '40px' : '300px'} minmax(440px,1.1fr) ${
              analysisCollapsed ? '40px' : 'minmax(320px,1fr)'
            }`,
          }}
        >
          <SourcesPanel
            analysis={analysis}
            collapsed={sourcesCollapsed}
            onToggleCollapse={toggleSources}
            onOpenSettings={() => setSettingsOpen(true)}
            onPlayBot={() => setMode('play')}
          />
          <BoardPanel analysis={analysis} />
          <AnalysisPanel
            analysis={analysis}
            collapsed={analysisCollapsed}
            onToggleCollapse={toggleAnalysis}
          />
        </div>
      ) : (
        <MobileLayout
          analysis={analysis}
          onOpenSettings={() => setSettingsOpen(true)}
          tab={mobileTab}
          onTabChange={setMobileTab}
          onSelectNav={selectMobileNav}
        />
      )}
    </>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
  if (!user) return <LoginPage />
  return <MainApp />
}
