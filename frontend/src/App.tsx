import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useAnalysis } from '@/hooks/useAnalysis'
import { LoginPage } from '@/components/LoginPage'
import { SourcesPanel } from '@/components/SourcesPanel'
import { BoardPanel } from '@/components/BoardPanel'
import { AnalysisPanel } from '@/components/AnalysisPanel'
import { MobileLayout } from '@/components/MobileLayout'
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mode, setMode] = useState<'analyze' | 'play'>('analyze')
  const [sourcesCollapsed, toggleSources] = usePersistentToggle('ca_sources_col')
  const [analysisCollapsed, toggleAnalysis] = usePersistentToggle('ca_analysis_col')
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
          onClose={() => setMode('analyze')}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : wide ? (
        <div
          className="grid h-screen gap-[18px] p-[18px]"
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
          onPlayBot={() => setMode('play')}
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
