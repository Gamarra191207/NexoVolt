import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Atom, Compass,
  Maximize2, Minimize2, Moon, Sun,
} from 'lucide-react'
import ElectricFieldLab from './components/ElectricFieldLab'
import CapacitorLab from './components/CapacitorLab'
import CircuitLab from './components/CircuitLab'
import MagneticLab from './components/MagneticLab'
import EngineStatus from './components/EngineStatus'
import { modules, type ModuleId } from './data/unitManifest'
import './unit-structure.css'

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
      <div className="brand"><div className="brand-mark"><Atom size={19} strokeWidth={1.8} /></div><div><strong>Nexo<span>Volt</span></strong><small>LABORATORIO UNIVERSITARIO</small></div></div>
      <button className={`nav-link ${active === null ? 'selected' : ''}`} onClick={() => setActive(null)}><Compass size={17} />Inicio <span className="nav-dot" /></button>
      <div className="side-label modules-label">MÓDULOS</div>
      <nav className="module-nav">{modules.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => openModule(item.id)} className={`nav-link ${active === item.id ? 'selected' : ''}`}><Icon size={17} /><span>{item.short}</span></button> })}</nav>
      <div className="sidebar-spacer" />
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Laboratorio</span><span className="crumb-slash">/</span><strong>{selected?.short ?? 'Inicio'}</strong></div><div className="top-actions"><EngineStatus /><div className="settings-menu"><button className="icon-button settings-trigger" aria-label="Apariencia" aria-expanded={showSettings} onClick={() => setShowSettings(!showSettings)}>{darkMode ? <Moon size={18} /> : <Sun size={18} />}</button>{showSettings && <section className="settings-popover" aria-label="Apariencia"><div className="settings-heading"><strong>Apariencia</strong></div><div className="theme-setting"><div className="theme-setting-icon">{darkMode ? <Moon size={16} /> : <Sun size={16} />}</div><div className="theme-setting-copy"><strong>Modo oscuro</strong><span>{darkMode ? 'Activado' : 'Desactivado'}</span></div><button className={`switch ${darkMode ? 'on' : ''}`} role="switch" aria-checked={darkMode} aria-label="Activar modo oscuro" onClick={() => setDarkMode(!darkMode)}><i /></button></div></section>}</div></div></header>

      {selected ? <section className={`module-page ${active === 'magnetism' ? 'module-page--instrument' : ''}`}>
        <button className="back-link" onClick={() => setActive(null)}><ArrowLeft size={15} />Todos los módulos</button>
        <div className="module-heading"><div><div className="eyebrow"><span className={`eyebrow-dot ${selected.color}`} />MÓDULO {selected.number} <span className="eyebrow-divider">·</span> {selected.topic.toUpperCase()}</div><h1>{selected.title}</h1><p>{selected.description}</p></div></div>
        <div className={`workspace-grid ${active === 'current' || active === 'magnetism' ? 'current-workspace' : ''}`}>
          <section ref={simulationCardRef} className={`simulation-card ${active === 'magnetism' ? 'simulation-card--instrument' : ''} ${isFullscreen ? 'is-fullscreen' : ''}`}><div className="card-topline"><div><span className="section-kicker">SIMULACIÓN</span><h2>{active === 'capacitors' ? 'Placas, dieléctricos y energía' : active === 'current' ? 'Circuitos y ley de Ohm' : active === 'magnetism' ? 'Campos magnéticos y cargas en movimiento' : 'Campo y potencial eléctrico'}</h2></div><div className="simulation-header-actions"><button className="fullscreen-button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver simulación en pantalla completa'} title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>{isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{isFullscreen ? 'Salir' : 'Pantalla completa'}</button></div></div>
            {active === 'electric-field' ? <ElectricFieldLab /> : active === 'capacitors' ? <CapacitorLab /> : active === 'current' ? <CircuitLab /> : <MagneticLab />}
          </section>
        </div>
      </section> : <section className="home-page">
        <section className="lab-overview" aria-labelledby="lab-title"><div className="lab-overview-copy"><div className="eyebrow muted-eyebrow">CENTRO DE EXPERIMENTOS DE ELECTROMAGNETISMO</div><h1 id="lab-title">Investiga, modifica variables y contrasta modelos físicos</h1><p>Cada unidad combina controles experimentales, visualización dinámica y resultados calculados por el motor físico. El laboratorio está pensado para explorar relaciones, formular hipótesis y repetir escenarios.</p></div><div className="lab-overview-stats" aria-label="Resumen del laboratorio"><div><strong>04</strong><span>Unidades</span></div><div><strong>12</strong><span>Experiencias</span></div><div><strong>15</strong><span>Pruebas físicas</span></div><div><strong>Rust</strong><span>Motor Tauri</span></div></div></section>
        <div className="section-header unit-section-title"><div><div className="eyebrow muted-eyebrow">ESTRUCTURA POR UNIDADES</div><h1>Laboratorios disponibles</h1><p>Selecciona una unidad para abrir su espacio de experimentación.</p></div><span className="module-count">04 UNIDADES</span></div>
        <div className="module-grid">{modules.map((item) => { const Icon = item.icon; return <button key={item.id} className={`module-card ${item.color}`} onClick={() => openModule(item.id)}><div className="module-card-top"><div className="module-icon"><Icon size={19} strokeWidth={1.8} /></div><span className="module-number">UNIDAD {item.number}</span></div><div className="module-card-body"><span className="module-topic">{item.topic}</span><h3>{item.title}</h3><p>{item.description}</p><div className="module-experiences" aria-label={`Experiencias de ${item.title}`}>{item.experiences.map((experience) => <span key={experience}>{experience}</span>)}</div></div><div className="module-card-bottom"><span>Explorar unidad</span><span className="module-engine-label">Backend validado</span><span className="card-arrow"><ArrowRight size={15} /></span></div><div className="card-accent" /></button> })}</div>
      </section>}
    </main>
  </div>
}

export default App
