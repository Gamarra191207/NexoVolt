import { useEffect, useRef, useState } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, Atom, BatteryCharging,
  Compass, Magnet, Maximize2, Minimize2, Moon, Sun, Zap,
} from 'lucide-react'
import ElectricFieldLab from './components/ElectricFieldLab'
import CapacitorLab from './components/CapacitorLab'
import CircuitLab from './components/CircuitLab'
import MagneticLab from './components/MagneticLab'

type ModuleId = 'electric-field' | 'capacitors' | 'current' | 'magnetism'

const modules = [
  { id: 'electric-field' as const, number: '01', title: 'Campo eléctrico y potencial', short: 'Campo eléctrico', description: 'Visualiza cómo las cargas modifican el espacio a su alrededor.', icon: Zap, color: 'blue', topic: 'Electrostática', formula: 'E⃗ = kΣqᵢr̂ᵢ/rᵢ² · V = kΣqᵢ/rᵢ' },
  { id: 'capacitors' as const, number: '02', title: 'Capacitores y dieléctricos', short: 'Capacitores', description: 'Explora placas en 3D y calcula la energía almacenada.', icon: BatteryCharging, color: 'violet', topic: 'Capacitancia', formula: 'C = ε · A / d' },
  { id: 'current' as const, number: '03', title: 'Corriente eléctrica y ley de Ohm', short: 'Corriente eléctrica', description: 'Relaciona voltaje, resistencia y corriente en un circuito sencillo.', icon: Activity, color: 'orange', topic: 'Circuitos', formula: 'V = I · R' },
  { id: 'magnetism' as const, number: '04', title: 'Fuerza y campo magnético', short: 'Magnetismo', description: 'Sigue la dirección del campo y la fuerza sobre cargas en movimiento.', icon: Magnet, color: 'green', topic: 'Magnetismo', formula: 'F⃗ = q(E⃗ + v⃗ × B⃗)' },
]

function App() {
  const [active, setActive] = useState<ModuleId | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('laboratorio-em-theme') === 'dark')
  const [showSettings, setShowSettings] = useState(false)
  const simulationCardRef = useRef<HTMLElement | null>(null)
  const selected = modules.find((item) => item.id === active)

  useEffect(() => {
    localStorage.setItem('laboratorio-em-theme', darkMode ? 'dark' : 'light')
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === simulationCardRef.current)
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  async function toggleFullscreen() {
    const card = simulationCardRef.current
    if (!card) return
    if (document.fullscreenElement === card) {
      await document.exitFullscreen()
      return
    }
    if (isFullscreen) { setIsFullscreen(false); return }
    try {
      await card.requestFullscreen()
    } catch {
      setIsFullscreen(true)
    }
  }

  const openModule = (id: ModuleId) => setActive(id)

  return <div className="app-shell" data-theme={darkMode ? 'dark' : 'light'}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Atom size={19} strokeWidth={1.8} /></div><div><strong>Laboratorio <span>EM</span></strong><small>SIMULADOR DE FÍSICA</small></div></div>
      <button className={`nav-link ${active === null ? 'selected' : ''}`} onClick={() => setActive(null)}><Compass size={17} />Inicio <span className="nav-dot" /></button>
      <div className="side-label modules-label">MÓDULOS</div>
      <nav className="module-nav">{modules.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => openModule(item.id)} className={`nav-link ${active === item.id ? 'selected' : ''}`}><Icon size={17} /><span>{item.short}</span></button> })}</nav>
      <div className="sidebar-spacer" />
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Laboratorio</span><span className="crumb-slash">/</span><strong>{selected?.short ?? 'Inicio'}</strong></div><div className="top-actions"><div className="settings-menu"><button className="icon-button settings-trigger" aria-label="Apariencia" aria-expanded={showSettings} onClick={() => setShowSettings(!showSettings)}>{darkMode ? <Moon size={18} /> : <Sun size={18} />}</button>{showSettings && <section className="settings-popover" aria-label="Apariencia"><div className="settings-heading"><strong>Apariencia</strong></div><div className="theme-setting"><div className="theme-setting-icon">{darkMode ? <Moon size={16} /> : <Sun size={16} />}</div><div className="theme-setting-copy"><strong>Modo oscuro</strong><span>{darkMode ? 'Activado' : 'Desactivado'}</span></div><button className={`switch ${darkMode ? 'on' : ''}`} role="switch" aria-checked={darkMode} aria-label="Activar modo oscuro" onClick={() => setDarkMode(!darkMode)}><i /></button></div></section>}</div></div></header>

      {selected ? <section className="module-page">
        <button className="back-link" onClick={() => setActive(null)}><ArrowLeft size={15} />Todos los módulos</button>
        <div className="module-heading"><div><div className="eyebrow"><span className={`eyebrow-dot ${selected.color}`} />MÓDULO {selected.number} <span className="eyebrow-divider">·</span> {selected.topic.toUpperCase()}</div><h1>{selected.title}</h1><p>{selected.description}</p></div></div>
        <div className={`workspace-grid ${active === 'current' || active === 'magnetism' ? 'current-workspace' : ''}`}>
          <section ref={simulationCardRef} className={`simulation-card ${isFullscreen ? 'is-fullscreen' : ''}`}><div className="card-topline"><div><span className="section-kicker">SIMULACIÓN</span><h2>{active === 'capacitors' ? 'Placas, dieléctricos y energía' : active === 'current' ? 'Circuitos y ley de Ohm' : active === 'magnetism' ? 'Campos magnéticos y cargas en movimiento' : 'Campo y potencial eléctrico'}</h2></div><div className="simulation-header-actions"><button className="fullscreen-button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver simulación en pantalla completa'} title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>{isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{isFullscreen ? 'Salir' : 'Pantalla completa'}</button></div></div>
            {active === 'electric-field' ? <ElectricFieldLab /> : active === 'capacitors' ? <CapacitorLab /> : active === 'current' ? <CircuitLab /> : <MagneticLab />}
          </section>
        </div>
      </section> : <section className="home-page">
        <div className="section-header"><div><div className="eyebrow muted-eyebrow">LABORATORIO DE ELECTROMAGNETISMO</div><h1>Simuladores</h1></div><span className="module-count">04 MÓDULOS</span></div>
        <div className="module-grid">{modules.map((item) => { const Icon = item.icon; return <button key={item.id} className={`module-card ${item.color}`} onClick={() => openModule(item.id)}><div className="module-card-top"><div className="module-icon"><Icon size={19} strokeWidth={1.8} /></div><span className="module-number">{item.number}</span></div><div className="module-card-body"><span className="module-topic">{item.topic}</span><h3>{item.title}</h3><p>{item.description}</p></div><div className="module-card-bottom"><span>Explorar módulo</span><span className="card-arrow"><ArrowRight size={15} /></span></div><div className="card-accent" /></button> })}</div>
      </section>}
    </main>
  </div>
}

export default App
