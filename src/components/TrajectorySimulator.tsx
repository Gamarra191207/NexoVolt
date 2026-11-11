import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { Crosshair, Hand, Pause, Play, Plus, RotateCcw, SkipBack, SkipForward, Trash2, Zap, ZoomIn, ZoomOut } from 'lucide-react'
import { fieldAt, potentialAt, simulateTrajectory, type Point3D, type PointCharge, type TrajectoryState } from '../physics/electrostatics'
import NumericInput from './NumericInput'
import ResultPanel from './ResultPanel'

const scientific = (value: number) => Number.isFinite(value) ? value.toExponential(3).replace('e', ' × 10^') : '—'
const WIDTH = 600
const HEIGHT = 360
const DEFAULT_SOURCES: PointCharge[] = [
  { id: 1, x: 2, y: 5, z: 0, chargeCoulombs: 1e-6 },
  { id: 2, x: 2, y: -5, z: 0, chargeCoulombs: -1e-6 },
]
const speedOf = (state: TrajectoryState) => Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z)
type TrajectoryCase = { id: string; name: string; sources: PointCharge[]; start: Point3D; velocity: Point3D; particleCharge: number; mass: number; duration: number }
type Camera = { x: number; y: number; zoom: number }
type DragState =
  | { kind: 'source'; id: number; offsetX: number; offsetY: number }
  | { kind: 'particle'; offsetX: number; offsetY: number }
  | { kind: 'pan'; screenX: number; screenY: number; cameraX: number; cameraY: number }
const trajectoryCases: TrajectoryCase[] = [
  { id: 'reflection', name: 'Reflexión', sources: [{ id: 1, x: 0, y: 0, z: 0, chargeCoulombs: 1e-6 }], start: { x: -10, y: 0, z: 0 }, velocity: { x: 300, y: 0, z: 0 }, particleCharge: 1, mass: .001, duration: 1 },
  { id: 'dipole', name: 'Dipolo', sources: DEFAULT_SOURCES, start: { x: -12, y: 0, z: 0 }, velocity: { x: 700, y: 0, z: 0 }, particleCharge: 1, mass: .001, duration: .5 },
  { id: 'attraction', name: 'Atracción', sources: [{ id: 1, x: 0, y: 0, z: 0, chargeCoulombs: -1e-6 }], start: { x: -15, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, particleCharge: 1, mass: .001, duration: .5 },
]

export default function TrajectorySimulator() {
  const [sources, setSources] = useState<PointCharge[]>(DEFAULT_SOURCES.map((source) => ({ ...source })))
  const [selectedCase, setSelectedCase] = useState('custom')
  const [start, setStart] = useState<Point3D>({ x: -12, y: 0, z: 0 })
  const [velocity, setVelocity] = useState<Point3D>({ x: 700, y: 0, z: 0 })
  const [particleChargeNanoC, setParticleChargeNanoC] = useState(1)
  const [particleMassMg, setParticleMassMg] = useState(.001)
  const [durationMs, setDurationMs] = useState(.5)
  const [trajectory, setTrajectory] = useState<TrajectoryState[]>([])
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [camera, setCamera] = useState<Camera>({ x: -2, y: 0, zoom: 18 })
  const dragRef = useRef<DragState | null>(null)

  function clearTrajectory() { setTrajectory([]); setFrame(0); setPlaying(false) }
  function markCustom() { setSelectedCase('custom'); clearTrajectory() }
  function selectCase(caseId: string) {
    setSelectedCase(caseId)
    const scenario = trajectoryCases.find((item) => item.id === caseId)
    if (!scenario) return
    setSources(scenario.sources.map((source) => ({ ...source })))
    setStart({ ...scenario.start }); setVelocity({ ...scenario.velocity })
    setParticleChargeNanoC(scenario.particleCharge); setParticleMassMg(scenario.mass); setDurationMs(scenario.duration)
    clearTrajectory()
  }
  function addSource(sign: 1 | -1) {
    const id = Math.max(0, ...sources.map((source) => source.id)) + 1
    const offset = sources.length % 5
    setSources((current) => [...current, { id, x: -4 + offset * 2, y: 6 - offset * 3, z: 0, chargeCoulombs: sign * 1e-6 }])
    markCustom()
  }
  function updateSource(id: number, field: 'x' | 'y' | 'charge', value: number) {
    setSources((current) => current.map((source) => source.id !== id ? source : field === 'charge' ? { ...source, chargeCoulombs: value * 1e-6 } : { ...source, [field]: value }))
    markCustom()
  }
  function removeSource(id: number) { setSources((current) => current.filter((source) => source.id !== id)); markCustom() }
  function resetLab() {
    setSources(DEFAULT_SOURCES.map((source) => ({ ...source }))); setSelectedCase('custom')
    setStart({ x: -12, y: 0, z: 0 }); setVelocity({ x: 700, y: 0, z: 0 })
    setParticleChargeNanoC(1); setParticleMassMg(.001); setDurationMs(.5); setCamera({ x: -2, y: 0, zoom: 18 }); clearTrajectory()
  }
  function simulate() {
    const duration = Math.max(.01, Math.min(20, durationMs)) / 1000
    const states = simulateTrajectory(sources, { x: start.x / 100, y: start.y / 100, z: start.z / 100 }, velocity, particleChargeNanoC * 1e-9, particleMassMg * 1e-6, duration, duration / 500)
    setTrajectory(states); setFrame(0); setPlaying(states.length > 1)
  }

  useEffect(() => {
    if (!playing || trajectory.length < 2) return
    const timer = window.setInterval(() => setFrame((current) => {
      if (current >= trajectory.length - 1) { setPlaying(false); return trajectory.length - 1 }
      return current + 1
    }), 24)
    return () => window.clearInterval(timer)
  }, [playing, trajectory])

  const view = useMemo(() => ({
    project: (point: { x: number; y: number }) => ({ x: WIDTH / 2 + (point.x - camera.x) * camera.zoom, y: HEIGHT / 2 - (point.y - camera.y) * camera.zoom }),
    unproject: (point: { x: number; y: number }) => ({ x: camera.x + (point.x - WIDTH / 2) / camera.zoom, y: camera.y - (point.y - HEIGHT / 2) / camera.zoom }),
  }), [camera])

  const grid = useMemo(() => {
    const minorStep = camera.zoom >= 28 ? 1 : camera.zoom >= 12 ? 2 : 5
    const majorStep = minorStep * 5
    const left = camera.x - WIDTH / (2 * camera.zoom); const right = camera.x + WIDTH / (2 * camera.zoom)
    const bottom = camera.y - HEIGHT / (2 * camera.zoom); const top = camera.y + HEIGHT / (2 * camera.zoom)
    const vertical: { value: number; major: boolean }[] = []; const horizontal: { value: number; major: boolean }[] = []
    for (let value = Math.floor(left / minorStep) * minorStep; value <= right; value += minorStep) vertical.push({ value, major: Math.abs(value / majorStep - Math.round(value / majorStep)) < 1e-6 })
    for (let value = Math.floor(bottom / minorStep) * minorStep; value <= top; value += minorStep) horizontal.push({ value, major: Math.abs(value / majorStep - Math.round(value / majorStep)) < 1e-6 })
    return { vertical, horizontal, minorStep }
  }, [camera])

  function svgPoint(event: ReactPointerEvent<SVGSVGElement> | ReactWheelEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT }
  }
  function beginSourceDrag(event: ReactPointerEvent<SVGGElement>, source: PointCharge) {
    event.stopPropagation(); clearTrajectory(); setSelectedCase('custom')
    const svg = event.currentTarget.ownerSVGElement; if (!svg) return
    const rect = svg.getBoundingClientRect(); const screen = { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT }
    const world = view.unproject(screen)
    dragRef.current = { kind: 'source', id: source.id, offsetX: source.x - world.x, offsetY: source.y - world.y }
    svg.setPointerCapture(event.pointerId)
  }
  function beginParticleDrag(event: ReactPointerEvent<SVGGElement>) {
    event.stopPropagation(); clearTrajectory(); setSelectedCase('custom')
    const svg = event.currentTarget.ownerSVGElement; if (!svg) return
    const rect = svg.getBoundingClientRect(); const screen = { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT }
    const world = view.unproject(screen)
    dragRef.current = { kind: 'particle', offsetX: start.x - world.x, offsetY: start.y - world.y }
    svg.setPointerCapture(event.pointerId)
  }
  function beginPan(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    const point = svgPoint(event)
    dragRef.current = { kind: 'pan', screenX: point.x, screenY: point.y, cameraX: camera.x, cameraY: camera.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function moveDrag(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current; if (!drag) return
    const screen = svgPoint(event)
    if (drag.kind === 'pan') {
      setCamera((current) => ({ ...current, x: drag.cameraX - (screen.x - drag.screenX) / current.zoom, y: drag.cameraY + (screen.y - drag.screenY) / current.zoom }))
      return
    }
    const world = view.unproject(screen); const x = Math.round((world.x + drag.offsetX) * 10) / 10; const y = Math.round((world.y + drag.offsetY) * 10) / 10
    if (drag.kind === 'source') setSources((current) => current.map((source) => source.id === drag.id ? { ...source, x, y } : source))
    else setStart((current) => ({ ...current, x, y }))
  }
  function endDrag(event: ReactPointerEvent<SVGSVGElement>) { dragRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }
  function zoomAt(factor: number, anchor = { x: WIDTH / 2, y: HEIGHT / 2 }) {
    setCamera((current) => {
      const nextZoom = Math.max(5, Math.min(60, current.zoom * factor)); const worldX = current.x + (anchor.x - WIDTH / 2) / current.zoom; const worldY = current.y - (anchor.y - HEIGHT / 2) / current.zoom
      return { x: worldX - (anchor.x - WIDTH / 2) / nextZoom, y: worldY + (anchor.y - HEIGHT / 2) / nextZoom, zoom: nextZoom }
    })
  }
  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) { event.preventDefault(); zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, svgPoint(event)) }

  const analysis = useMemo(() => {
    if (!trajectory.length) return null
    const points = trajectory.map((state) => view.project({ x: state.position.x * 100, y: state.position.y * 100 }))
    const path = (items: { x: number; y: number }[]) => items.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
    const speeds = trajectory.map(speedOf); const maxSpeed = Math.max(...speeds, 1e-12)
    const turnIndex = trajectory.findIndex((_, index) => {
      if (index < 2 || index >= trajectory.length - 2 || speeds[index] > maxSpeed * .08) return false
      const before = trajectory[index - 1].velocity, after = trajectory[index + 1].velocity
      return before.x * after.x + before.y * after.y + before.z * after.z < 0
    })
    const currentIndex = Math.min(frame, trajectory.length - 1); const current = trajectory[currentIndex]
    const position = { x: current.position.x * 100, y: current.position.y * 100, z: current.position.z * 100 }
    const field = fieldAt(position, sources); const chargeC = particleChargeNanoC * 1e-9; const massKg = particleMassMg * 1e-6
    const acceleration = { x: field.x * chargeC / massKg, y: field.y * chargeC / massKg, z: field.z * chargeC / massKg }
    const kinetic = .5 * massKg * speedOf(current) ** 2; const potential = chargeC * potentialAt(position, sources)
    const energies = trajectory.map((state) => { const p = { x: state.position.x * 100, y: state.position.y * 100, z: state.position.z * 100 }; return Math.abs(.5 * massKg * speedOf(state) ** 2) + Math.abs(chargeC * potentialAt(p, sources)) })
    const arrow = (vector: Point3D) => { const length = Math.hypot(vector.x, vector.y); return length < 1e-9 ? null : { x: vector.x / length * 34, y: -vector.y / length * 34 } }
    const chartPoints = speeds.map((speed, index) => ({ x: 42 + index / Math.max(1, speeds.length - 1) * 516, y: 110 - speed / maxSpeed * 82 }))
    return { points, fullPath: path(points), activePath: path(points.slice(0, Math.max(1, currentIndex + 1))), current, currentIndex, currentPoint: points[currentIndex], turnIndex, field, kinetic, potential, maxAbsEnergy: Math.max(...energies, 1e-30), velocityArrow: arrow(current.velocity), forceArrow: arrow(acceleration), chartPoints, speedPath: path(chartPoints) }
  }, [trajectory, frame, sources, particleChargeNanoC, particleMassMg, view])

  function coordinate(axis: keyof Point3D, value: number) { setStart((current) => ({ ...current, [axis]: value })); markCustom() }
  function setSpeed(axis: keyof Point3D, value: number) { setVelocity((current) => ({ ...current, [axis]: value })); markCustom() }
  const atTurn = analysis?.turnIndex !== -1 && analysis?.turnIndex === analysis?.currentIndex
  const idleParticle = view.project(start)

  return <section className="tool-panel trajectory-tool">
    <div className="tool-intro trajectory-intro"><div><h3>Trayectoria de una partícula</h3></div><button className="secondary-action trajectory-reset" onClick={resetLab}><RotateCcw size={13} />Restablecer laboratorio</button></div>
    <div className="trajectory-layout"><div className="trajectory-left-column">
      <div className="trajectory-visual"><svg className={dragRef.current ? 'is-dragging' : ''} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="application" aria-label="Plano cartesiano interactivo. Arrastra las cargas o el fondo para mover la vista; usa la rueda para acercar o alejar." onPointerDown={beginPan} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onWheel={handleWheel}><defs><marker id="trajectoryVelocityArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#36836f" /></marker><marker id="trajectoryForceArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#bd6c38" /></marker></defs><rect width={WIDTH} height={HEIGHT} className="trajectory-plane-bg" />
        <g className="trajectory-grid">{grid.vertical.map((line) => { const x = view.project({ x: line.value, y: 0 }).x; return <line key={`x-${line.value}`} x1={x} y1="0" x2={x} y2={HEIGHT} className={line.value === 0 ? 'axis' : line.major ? 'major' : ''} /> })}{grid.horizontal.map((line) => { const y = view.project({ x: 0, y: line.value }).y; return <line key={`y-${line.value}`} x1="0" y1={y} x2={WIDTH} y2={y} className={line.value === 0 ? 'axis' : line.major ? 'major' : ''} /> })}</g>
        <g className="trajectory-axis-labels">{grid.vertical.filter((line) => line.major && line.value !== 0).map((line) => { const point = view.project({ x: line.value, y: 0 }); return point.y > 10 && point.y < HEIGHT - 10 ? <text key={`xl-${line.value}`} x={point.x + 3} y={point.y - 4}>{line.value}</text> : null })}{grid.horizontal.filter((line) => line.major && line.value !== 0).map((line) => { const point = view.project({ x: 0, y: line.value }); return point.x > 10 && point.x < WIDTH - 10 ? <text key={`yl-${line.value}`} x={point.x + 4} y={point.y - 3}>{line.value}</text> : null })}</g>
        {sources.map((source, index) => { const point = view.project(source); const positive = source.chargeCoulombs >= 0; return <g key={source.id} className="trajectory-source draggable-element" onPointerDown={(event) => beginSourceDrag(event, source)}><circle cx={point.x} cy={point.y} r="20" className="drag-hit-area" /><circle cx={point.x} cy={point.y} r="18" fill={positive ? '#547cda22' : '#d4777722'} /><circle cx={point.x} cy={point.y} r="10" fill={positive ? '#547cda' : '#d47777'} /><text x={point.x} y={point.y + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{positive ? '+' : '−'}</text><text x={point.x} y={point.y + 29} textAnchor="middle" fill="#68778c" fontSize="8">F{index + 1}</text></g> })}
        {!analysis && <g className="draggable-element mobile-charge-handle" transform={`translate(${idleParticle.x} ${idleParticle.y})`} onPointerDown={beginParticleDrag}><circle r="20" className="drag-hit-area" /><circle r="14" fill={particleChargeNanoC >= 0 ? '#df8b4833' : '#8c69bd33'} /><circle r="7" fill={particleChargeNanoC >= 0 ? '#df8b48' : '#8c69bd'} stroke="white" strokeWidth="2" /><text y="3" textAnchor="middle" fill="white" fontSize="8" fontWeight="800">{particleChargeNanoC >= 0 ? '+' : '−'}</text><text y="27" textAnchor="middle" className="mobile-charge-label">Móvil</text></g>}
        {analysis && <><path d={analysis.fullPath} fill="none" stroke="#e6c7aa" strokeWidth="2" strokeDasharray="5 5" /><path d={analysis.activePath} fill="none" stroke="#df8b48" strokeWidth="3" strokeLinecap="round" />{analysis.turnIndex > 0 && <circle cx={analysis.points[analysis.turnIndex].x} cy={analysis.points[analysis.turnIndex].y} r="10" fill="none" stroke="#8c69bd" strokeWidth="2" strokeDasharray="3 2" />}<circle cx={analysis.points[0].x} cy={analysis.points[0].y} r="5" fill="#49896c" stroke="white" strokeWidth="2" /><g transform={`translate(${analysis.currentPoint.x} ${analysis.currentPoint.y})`}><circle r="13" fill="#df8b4833" /><circle r="7" fill="#df8b48" stroke="white" strokeWidth="2" />{analysis.velocityArrow && <line x1="0" y1="-9" x2={analysis.velocityArrow.x} y2={analysis.velocityArrow.y - 9} stroke="#36836f" strokeWidth="2.2" markerEnd="url(#trajectoryVelocityArrow)" />}{analysis.forceArrow && <line x1="0" y1="9" x2={analysis.forceArrow.x} y2={analysis.forceArrow.y + 9} stroke="#bd6c38" strokeWidth="2.2" markerEnd="url(#trajectoryForceArrow)" />}</g></>}</svg>
        <div className="trajectory-legend"><span><i className="source-key" />Fuentes: {sources.length}</span><span><i className="path-key" />Recorrido</span><span><i className="velocity-key" />Velocidad</span><span><i className="force-key" />Fuerza</span></div><div className="trajectory-navigation"><span><Hand size={12}/>Arrastra el fondo</span><span>Cuadrícula: {grid.minorStep} cm</span><button onClick={() => zoomAt(1 / 1.2)} aria-label="Alejar"><ZoomOut size={13}/></button><button onClick={() => zoomAt(1.2)} aria-label="Acercar"><ZoomIn size={13}/></button><button onClick={() => setCamera({ x: -2, y: 0, zoom: 18 })} aria-label="Centrar vista"><Crosshair size={13}/></button></div>{analysis ? <div className="trajectory-finish">t = {scientific(analysis.current.time)} s · v = {scientific(speedOf(analysis.current))} m/s · posición ({scientific(analysis.current.position.x)}; {scientific(analysis.current.position.y)}) m</div> : <div className="trajectory-empty"><Zap size={18} /><span>Arrastra las cargas para ubicarlas y pulsa “Iniciar recorrido”</span></div>}</div>
      {analysis && <div className="trajectory-playback"><div className="playback-buttons"><button aria-label="Volver al inicio" onClick={() => { setPlaying(false); setFrame(0) }}><SkipBack size={14} /></button><button className="playback-main" onClick={() => { if (frame >= trajectory.length - 1) setFrame(0); setPlaying(!playing) }}>{playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}{playing ? 'Pausar' : 'Reproducir'}</button><button aria-label="Avanzar un paso" onClick={() => { setPlaying(false); setFrame((value) => Math.min(trajectory.length - 1, value + 1)) }}><SkipForward size={14} /></button></div><label className="trajectory-timeline"><span>Recorrido</span><input type="range" min="0" max={trajectory.length - 1} value={analysis.currentIndex} onChange={(event) => { setPlaying(false); setFrame(Number(event.target.value)) }} /><span>{analysis.currentIndex + 1}/{trajectory.length}</span></label></div>}
      {analysis && <div className="trajectory-chart-card"><div className="trajectory-chart-title"><strong>Rapidez durante el recorrido</strong><span>La curva responde a todas las fuentes activas</span></div><svg viewBox={`0 0 ${WIDTH} 120`} role="img" aria-label="Rapidez respecto al tiempo"><path d="M42 16V94H558" fill="none" stroke="#dfe4eb" /><path d={analysis.speedPath} fill="none" stroke="#548a7b" strokeWidth="2.5"/><line x1={analysis.chartPoints[analysis.currentIndex].x} x2={analysis.chartPoints[analysis.currentIndex].x} y1="14" y2="95" stroke="#df8b48" strokeWidth="1.5"/><circle cx={analysis.chartPoints[analysis.currentIndex].x} cy={analysis.chartPoints[analysis.currentIndex].y} r="4" fill="#df8b48"/></svg></div>}
    </div><div className="trajectory-controls">
      <div className="trajectory-case-picker"><label>CONFIGURACIÓN<select value={selectedCase} onChange={(event) => selectCase(event.target.value)}><option value="custom">Laboratorio libre</option>{trajectoryCases.map((scenario) => <option value={scenario.id} key={scenario.id}>{scenario.name}</option>)}</select></label></div>
      <div className="field-source-section"><div className="field-source-heading"><div><span className="tool-card-heading">FUENTES DE CAMPO</span><small>{sources.length} {sources.length === 1 ? 'fuente activa' : 'fuentes activas'}</small></div><div><button onClick={() => addSource(1)}><Plus size={12}/>Positiva</button><button onClick={() => addSource(-1)}><Plus size={12}/>Negativa</button></div></div>
        <div className="field-source-list">{sources.length ? sources.map((source, index) => <div className="field-source-row" key={source.id}><span className={source.chargeCoulombs >= 0 ? 'positive' : 'negative'}>{source.chargeCoulombs >= 0 ? '+' : '−'}</span><label>q <NumericInput step="any" value={source.chargeCoulombs * 1e6} onValueChange={(value) => updateSource(source.id, 'charge', value)} /><small>µC</small></label><label>x <NumericInput step="any" value={source.x} onValueChange={(value) => updateSource(source.id, 'x', value)} /><small>cm</small></label><label>y <NumericInput step="any" value={source.y} onValueChange={(value) => updateSource(source.id, 'y', value)} /><small>cm</small></label><button className="delete-source" onClick={() => removeSource(source.id)} aria-label={`Eliminar fuente ${index + 1}`}><Trash2 size={13}/></button></div>) : <div className="field-source-empty">Sin fuentes: la partícula mantendrá un movimiento rectilíneo uniforme.</div>}</div>
      </div>
      <div className="tool-card-heading particle-heading">CARGA MÓVIL</div><div className="trajectory-input-grid"><label>Carga (nC)<NumericInput step="any" value={particleChargeNanoC} onValueChange={(value) => { setParticleChargeNanoC(value); markCustom() }} /></label><label>Masa (mg)<NumericInput min={0.001} step="any" value={particleMassMg} onValueChange={(value) => { setParticleMassMg(value); markCustom() }} /></label></div>
      <div className="tool-card-heading small-heading">POSICIÓN (cm) · VELOCIDAD (m/s)</div><div className="trajectory-vector-grid">{(['x', 'y', 'z'] as const).map((axis) => <div key={axis}><span>{axis.toUpperCase()}</span><label><NumericInput step="any" value={start[axis]} onValueChange={(value) => coordinate(axis, value)} aria-label={`Posición inicial ${axis}`} /><small>cm</small></label><label><NumericInput step="any" value={velocity[axis]} onValueChange={(value) => setSpeed(axis, value)} aria-label={`Velocidad inicial ${axis}`} /><small>m/s</small></label></div>)}</div>
      <label className="duration-input">Duración (ms)<NumericInput min={0.01} max={20} step={0.1} value={durationMs} onValueChange={(value) => { setDurationMs(value); markCustom() }} /></label><div className="trajectory-actions"><button className="play-button" onClick={simulate}><Play size={14} fill="currentColor" />Iniciar recorrido</button><button className="secondary-action" onClick={clearTrajectory}>Limpiar trayectoria</button></div>
      {analysis && <><ResultPanel className="trajectory-readouts" title="Estado de la partícula" status={atTurn ? 'Punto de retorno' : 'En movimiento'} statusTone={atTurn ? 'warning' : 'ready'} primaryLabel="Rapidez" primaryValue={<>{scientific(speedOf(analysis.current))} <small>m/s</small></>} primaryDetail="Magnitud instantánea de la velocidad" metrics={[{ label: 'Fuerza eléctrica', value: <>{scientific(Math.hypot(analysis.field.x, analysis.field.y, analysis.field.z) * Math.abs(particleChargeNanoC * 1e-9))} <small>N</small></> }, { label: 'Energía cinética', value: <>{scientific(analysis.kinetic)} <small>J</small></> }, { label: 'Energía potencial', value: <>{scientific(analysis.potential)} <small>J</small></>, wide: true }]} note="Cada fuente contribuye al campo neto que acelera la carga móvil." /><div className="energy-bars"><div className="energy-bar-heading"><span>Intercambio de energía</span><small>Energía total</small></div><label><span>Cinética</span><i><b style={{ width: `${Math.min(100, Math.abs(analysis.kinetic) / analysis.maxAbsEnergy * 100)}%` }} /></i></label><label><span>Potencial</span><i className="potential-energy"><b style={{ width: `${Math.min(100, Math.abs(analysis.potential) / analysis.maxAbsEnergy * 100)}%` }} /></i></label></div></>}
    </div></div>
  </section>
}
