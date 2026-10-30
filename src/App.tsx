import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Atom, Compass, Cpu, FlaskConical,
  Maximize2, Minimize2, Moon, ShieldCheck, Sun,
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
      <div className="side-label">NAVEGACIÓN</div>
      <button className={`nav-link home-link ${active === null ? 'selected' : ''}`} onClick={() => setActive(null)}><span className="nav-code">00</span><Compass size={17} /><span className="nav-copy"><strong>Centro de control</strong><small>Vista general</small></span><span className="nav-dot" /></button>
      <div className="side-label modules-label">ESTACIONES</div>
      <nav className="module-nav">{modules.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => openModule(item.id)} className={`nav-link ${active === item.id ? 'selected' : ''}`}><span className="nav-code">{item.number}</span><Icon size={17} /><span className="nav-copy"><strong>{item.short}</strong><small>{item.topic}</small></span></button> })}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-status"><Cpu size={15} /><span><strong>Motor local</strong><small>4 núcleos físicos disponibles</small></span><i /></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-context"><span className="session-label">SESIÓN DE LABORATORIO · ELECTROMAGNETISMO</span><div className="breadcrumb"><span>Centro experimental</span><span className="crumb-slash">/</span><strong>{selected?.short ?? 'Panel general'}</strong></div></div><div className="top-actions"><EngineStatus /><div className="settings-menu"><button className="icon-button settings-trigger" aria-label="Apariencia" aria-expanded={showSettings} onClick={() => setShowSettings(!showSettings)}>{darkMode ? <Moon size={18} /> : <Sun size={18} />}</button>{showSettings && <section className="settings-popover" aria-label="Apariencia"><div className="settings-heading"><strong>Apariencia</strong></div><div className="theme-setting"><div className="theme-setting-icon">{darkMode ? <Moon size={16} /> : <Sun size={16} />}</div><div className="theme-setting-copy"><strong>Modo oscuro</strong><span>{darkMode ? 'Activado' : 'Desactivado'}</span></div><button className={`switch ${darkMode ? 'on' : ''}`} role="switch" aria-checked={darkMode} aria-label="Activar modo oscuro" onClick={() => setDarkMode(!darkMode)}><i /></button></div></section>}</div></div></header>

      {selected ? <section className={`module-page module-page--instrument module-${selected.color}`}>
        <button className="back-link" onClick={() => setActive(null)}><ArrowLeft size={15} />Todos los módulos</button>
        <div className="module-heading"><div><div className="eyebrow"><span className={`eyebrow-dot ${selected.color}`} />UNIDAD {selected.number} <span className="eyebrow-divider">·</span> {selected.topic.toUpperCase()}</div><h1>{selected.title}</h1><p>{selected.description}</p></div><aside className="module-brief"><span>MODELO ACTIVO</span><strong>{selected.formula}</strong><small><i />{selected.backendCommands.length} servicios físicos conectados</small></aside></div>
        <div className={`workspace-grid ${active === 'current' || active === 'magnetism' ? 'current-workspace' : ''}`}>
          <section ref={simulationCardRef} className={`simulation-card simulation-card--instrument ${isFullscreen ? 'is-fullscreen' : ''}`}><div className="card-topline"><div className="station-title"><span className="station-code">ESTACIÓN {selected.number}</span><div><span className="section-kicker">BANCO DE EXPERIMENTACIÓN</span><h2>{active === 'capacitors' ? 'Placas, dieléctricos y energía' : active === 'current' ? 'Circuitos y ley de Ohm' : active === 'magnetism' ? 'Campos magnéticos y cargas en movimiento' : 'Campo y potencial eléctrico'}</h2></div></div><div className="simulation-header-actions"><span className="experiment-ready"><i />LISTO</span><button className="fullscreen-button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver simulación en pantalla completa'} title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>{isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{isFullscreen ? 'Salir' : 'Pantalla completa'}</button></div></div>
            {active === 'electric-field' ? <ElectricFieldLab /> : active === 'capacitors' ? <CapacitorLab /> : active === 'current' ? <CircuitLab /> : <MagneticLab />}
          </section>
        </div>
      </section> : <section className="home-page home-console">
        <section className="lab-overview command-deck" aria-labelledby="lab-title"><div className="lab-overview-copy"><div className="eyebrow muted-eyebrow"><FlaskConical size={13} />CENTRO DE EXPERIMENTOS DE ELECTROMAGNETISMO</div><h1 id="lab-title">Un espacio para construir, medir y contrastar modelos físicos</h1><p>Manipula sistemas eléctricos y magnéticos, observa su respuesta y compara magnitudes calculadas por el motor local. Cada unidad funciona como una estación de laboratorio completa.</p><div className="command-actions"><button onClick={() => openModule('electric-field')}>Abrir primera estación <ArrowRight size={15} /></button><span><ShieldCheck size={14} />Cálculo local · sin conexión requerida</span></div></div><aside className="command-telemetry"><header><span>ESTADO DEL CENTRO</span><strong>Operativo</strong></header><div><span>Estaciones disponibles</span><strong>04 / 04</strong></div><div><span>Experiencias interactivas</span><strong>12</strong></div><div><span>Pruebas físicas</span><strong>15</strong></div><footer><i />Motor Rust sincronizado</footer></aside></section>
        <div className="section-header unit-section-title"><div><div className="eyebrow muted-eyebrow">DIRECTORIO DE ESTACIONES</div><h1>Selecciona un banco experimental</h1><p>Cada estación conserva sus controles, instrumentos y lecturas en un espacio de trabajo propio.</p></div><span className="module-count">04 UNIDADES · 12 EXPERIENCIAS</span></div>
        <div className="module-grid unit-rack">{modules.map((item) => { const Icon = item.icon; return <button key={item.id} className={`module-card ${item.color}`} onClick={() => openModule(item.id)}><div className="module-card-top"><span className="module-number">{item.number}</span><div className="module-icon"><Icon size={20} strokeWidth={1.8} /></div><span className="module-state"><i />DISPONIBLE</span></div><div className="module-card-body"><span className="module-topic">{item.topic}</span><h3>{item.title}</h3><p>{item.description}</p></div><div className="module-experiences" aria-label={`Experiencias de ${item.title}`}>{item.experiences.map((experience, index) => <span key={experience}><b>{String(index + 1).padStart(2, '0')}</b>{experience}</span>)}</div><div className="module-formula"><span>MODELO BASE</span><strong>{item.formula}</strong></div><div className="module-card-bottom"><span>Entrar a la estación</span><span className="module-engine-label">Backend validado</span><span className="card-arrow"><ArrowRight size={15} /></span></div></button> })}</div>
      </section>}
    </main>
  </div>
}

export default App
