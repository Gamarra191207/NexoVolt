import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Atom, Compass,
  Maximize2, Minimize2,
} from 'lucide-react'
import ElectricFieldLab from './components/ElectricFieldLab'
import CapacitorLab from './components/CapacitorLab'
import CircuitLab from './components/CircuitLab'
import MagneticLab from './components/MagneticLab'
import { modules, type ModuleId } from './data/unitManifest'
import './unit-structure.css'

function App() {
  const [active, setActive] = useState<ModuleId | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const simulationCardRef = useRef<HTMLElement | null>(null)
  const selected = modules.find((item) => item.id === active)

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

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Atom size={19} strokeWidth={1.8} /></div><div><strong>Nexo<span>Volt</span></strong></div></div>
      <div className="side-label">NAVEGACIÓN</div>
      <button className={`nav-link home-link ${active === null ? 'selected' : ''}`} onClick={() => setActive(null)}><Compass size={17} /><span className="nav-copy"><strong>Inicio</strong></span><span className="nav-dot" /></button>
      <div className="side-label modules-label">ESTACIONES</div>
      <nav className="module-nav">{modules.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => openModule(item.id)} className={`nav-link ${active === item.id ? 'selected' : ''}`}><Icon size={17} /><span className="nav-copy"><strong>{item.short}</strong></span></button> })}</nav>
      <div className="sidebar-spacer" />
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-context"><span className="session-label">SESIÓN DE LABORATORIO · ELECTROMAGNETISMO</span><div className="breadcrumb"><span>Centro experimental</span><span className="crumb-slash">/</span><strong>{selected?.short ?? 'Panel general'}</strong></div></div></header>

      {selected ? <section className={`module-page module-page--instrument module-${selected.color}`}>
        <button className="back-link" onClick={() => setActive(null)}><ArrowLeft size={15} />Todos los módulos</button>
        <div className="module-heading module-heading--lab">
          <div>
            <span className="module-heading-kicker">ESTACIÓN DE TRABAJO</span>
            <h1>{selected.title}</h1>
            <p>{active === 'capacitors' ? 'Explora la geometría, los materiales y la energía almacenada.' : active === 'current' ? 'Construye circuitos y observa la relación entre voltaje, corriente y resistencia.' : active === 'magnetism' ? 'Analiza campos magnéticos y el movimiento de cargas.' : 'Modela cargas, inspecciona el campo y mide el potencial en cualquier punto.'}</p>
          </div>
          <button className="fullscreen-button module-fullscreen" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver simulación en pantalla completa'} title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>{isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{isFullscreen ? 'Salir' : 'Pantalla completa'}</button>
        </div>
        <div className={`workspace-grid ${active === 'current' || active === 'magnetism' ? 'current-workspace' : ''}`}>
          <section ref={simulationCardRef} className={`simulation-card simulation-card--instrument ${isFullscreen ? 'is-fullscreen' : ''}`}><div className="card-topline fullscreen-only-header"><div className="station-title"><h2>{active === 'capacitors' ? 'Placas, dieléctricos y energía' : active === 'current' ? 'Circuitos y ley de Ohm' : active === 'magnetism' ? 'Campos magnéticos y cargas en movimiento' : 'Campo y potencial eléctrico'}</h2></div><div className="simulation-header-actions"><button className="fullscreen-button" onClick={toggleFullscreen} aria-label="Salir de pantalla completa"><Minimize2 size={15} />Salir</button></div></div>
            {active === 'electric-field' ? <ElectricFieldLab /> : active === 'capacitors' ? <CapacitorLab /> : active === 'current' ? <CircuitLab /> : <MagneticLab />}
          </section>
        </div>
      </section> : <section className="home-page home-console">
        <div className="section-header unit-section-title"><h1>Estaciones</h1></div>
        <div className="module-grid unit-rack">{modules.map((item) => { const Icon = item.icon; return <button key={item.id} className={`module-card ${item.color}`} onClick={() => openModule(item.id)}><div className="module-card-top"><div className="module-icon"><Icon size={22} strokeWidth={1.8} /></div></div><div className="module-card-body"><h3>{item.title}</h3></div><div className="module-card-bottom"><span className="card-arrow"><ArrowRight size={17} /></span></div></button> })}</div>
      </section>}
    </main>
  </div>
}

export default App
