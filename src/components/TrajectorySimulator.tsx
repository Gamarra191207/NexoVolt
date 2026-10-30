import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Target } from 'lucide-react'
import { fieldAt, potentialAt, simulateTrajectory, type Point3D, type PointCharge, type TrajectoryState } from '../physics/electrostatics'
import NumericInput from './NumericInput'

const scientific = (value: number) => Number.isFinite(value) ? value.toExponential(3).replace('e', ' × 10^') : '—'
const WIDTH = 600
const HEIGHT = 360
const speedOf = (state: TrajectoryState) => Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z)
type TrajectoryCase = { id: string; name: string; description: string; charges: PointCharge[]; start: Point3D; velocity: Point3D; particleCharge: number; mass: number; duration: number }
const trajectoryCases: TrajectoryCase[] = [
  { id: 'reflection', name: 'Reflexión ante una carga', description: 'La partícula positiva se acerca a otra positiva: la fuerza la frena, se detiene un instante y vuelve.', charges: [{ id: 1, x: 0, y: 0, z: 0, chargeCoulombs: 1e-6 }], start: { x: -10, y: 0, z: 0 }, velocity: { x: 300, y: 0, z: 0 }, particleCharge: 1, mass: .001, duration: 1 },
  { id: 'dipole', name: 'Desviación en un dipolo', description: 'La carga atraviesa la región del dipolo y la fuerza eléctrica curva su trayectoria.', charges: [{ id: 1, x: 0, y: 4, z: 0, chargeCoulombs: 1e-6 }, { id: 2, x: 0, y: -4, z: 0, chargeCoulombs: -1e-6 }], start: { x: -12, y: 0, z: 0 }, velocity: { x: 700, y: 0, z: 0 }, particleCharge: 1, mass: .001, duration: .5 },
  { id: 'attraction', name: 'Aceleración hacia una carga', description: 'Una partícula positiva parte del reposo y acelera hacia una fuente negativa.', charges: [{ id: 1, x: 0, y: 0, z: 0, chargeCoulombs: -1e-6 }], start: { x: -15, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, particleCharge: 1, mass: .001, duration: .5 },
]

export default function TrajectorySimulator({ charges }: { charges: PointCharge[] }) {
  const [simulationCharges, setSimulationCharges] = useState(charges)
  const [selectedCase, setSelectedCase] = useState('viewer')
  const [start, setStart] = useState<Point3D>({ x: -8, y: -3, z: 0 })
  const [velocity, setVelocity] = useState<Point3D>({ x: 1200, y: 0, z: 0 })
  const [particleChargeNanoC, setParticleChargeNanoC] = useState(1)
  const [particleMassMg, setParticleMassMg] = useState(1)
  const [durationMs, setDurationMs] = useState(2)
  const [trajectory, setTrajectory] = useState<TrajectoryState[]>([])
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)

  function clearTrajectory() { setTrajectory([]); setFrame(0); setPlaying(false) }
  function selectCase(caseId: string) {
    setSelectedCase(caseId)
    const scenario = trajectoryCases.find((item) => item.id === caseId)
    setSimulationCharges((scenario?.charges ?? charges).map((charge) => ({ ...charge })))
    if (scenario) {
      setStart(scenario.start)
      setVelocity(scenario.velocity)
      setParticleChargeNanoC(scenario.particleCharge)
      setParticleMassMg(scenario.mass)
      setDurationMs(scenario.duration)
    } else {
      setStart({ x: -8, y: -3, z: 0 })
      setVelocity({ x: 1200, y: 0, z: 0 })
      setParticleChargeNanoC(1)
      setParticleMassMg(1)
      setDurationMs(2)
    }
    clearTrajectory()
  }
  function simulate() {
    const duration = Math.max(.01, Math.min(20, durationMs)) / 1000
    const states = simulateTrajectory(simulationCharges, { x: start.x / 100, y: start.y / 100, z: start.z / 100 }, velocity, particleChargeNanoC * 1e-9, particleMassMg * 1e-6, duration, duration / 500)
    setTrajectory(states)
    setFrame(0)
    setPlaying(states.length > 1)
  }

  useEffect(() => {
    if (!playing || trajectory.length < 2) return
    const timer = window.setInterval(() => setFrame((current) => {
      if (current >= trajectory.length - 1) { setPlaying(false); return trajectory.length - 1 }
      return current + 1
    }), 24)
    return () => window.clearInterval(timer)
  }, [playing, trajectory])

  const analysis = useMemo(() => {
    if (!trajectory.length) return null
    const positions = [...trajectory.map((state) => ({ x: state.position.x * 100, y: state.position.y * 100 })), ...simulationCharges.map(({ x, y }) => ({ x, y }))]
    let minX = Math.min(...positions.map((point) => point.x)); let maxX = Math.max(...positions.map((point) => point.x))
    let minY = Math.min(...positions.map((point) => point.y)); let maxY = Math.max(...positions.map((point) => point.y))
    if (maxX - minX < 4) { minX -= 2; maxX += 2 }
    if (maxY - minY < 4) { minY -= 2; maxY += 2 }
    const padding = 42
    const scale = Math.min((WIDTH - 2 * padding) / (maxX - minX), (HEIGHT - 2 * padding) / (maxY - minY))
    const project = (point: { x: number; y: number }) => ({ x: padding + (point.x - minX) * scale, y: HEIGHT - padding - (point.y - minY) * scale })
    const points = trajectory.map((state) => project({ x: state.position.x * 100, y: state.position.y * 100 }))
    const fullPath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
    const activePath = points.slice(0, Math.max(1, Math.min(frame + 1, points.length))).map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
    const speeds = trajectory.map(speedOf)
    const maxSpeed = Math.max(...speeds, 1e-12)
    const turnIndex = trajectory.findIndex((_, index) => {
      if (index < 2 || index >= trajectory.length - 2 || speeds[index] > maxSpeed * .08) return false
      const before = trajectory[index - 1].velocity, after = trajectory[index + 1].velocity
      const dot = before.x * after.x + before.y * after.y + before.z * after.z
      return dot < 0
    })
    const maxAbsEnergy = Math.max(...trajectory.map((state) => {
      const position = { x: state.position.x * 100, y: state.position.y * 100, z: state.position.z * 100 }
      const kinetic = .5 * particleMassMg * 1e-6 * speedOf(state) ** 2
      const potential = particleChargeNanoC * 1e-9 * potentialAt(position, simulationCharges)
      return Math.abs(kinetic) + Math.abs(potential)
    }), 1e-30)
    const currentIndex = Math.min(frame, trajectory.length - 1)
    const current = trajectory[currentIndex]
    const position = { x: current.position.x * 100, y: current.position.y * 100, z: current.position.z * 100 }
    const field = fieldAt(position, simulationCharges)
    const chargeC = particleChargeNanoC * 1e-9
    const massKg = particleMassMg * 1e-6
    const acceleration = { x: field.x * chargeC / massKg, y: field.y * chargeC / massKg, z: field.z * chargeC / massKg }
    const kinetic = .5 * massKg * speedOf(current) ** 2
    const potential = chargeC * potentialAt(position, simulationCharges)
    const arrow = (vector: Point3D, direction: number) => {
      const dx = vector.x * direction * scale
      const dy = -vector.y * direction * scale
      const length = Math.hypot(dx, dy)
      if (length < 1e-9) return null
      const size = 34
      return { x: dx / length * size, y: dy / length * size }
    }
    const currentPoint = points[currentIndex]
    const velocityArrow = arrow(current.velocity, 1)
    const forceArrow = arrow(acceleration, 1)
    const chartPoints = speeds.map((speed, index) => ({ x: padding + index / Math.max(1, speeds.length - 1) * (WIDTH - 2 * padding), y: 110 - speed / maxSpeed * 82 }))
    const speedPath = chartPoints.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
    const energy = trajectory.map((state) => {
      const p = { x: state.position.x * 100, y: state.position.y * 100, z: state.position.z * 100 }
      return { kinetic: .5 * massKg * speedOf(state) ** 2, potential: chargeC * potentialAt(p, simulationCharges) }
    })
    return { project, points, fullPath, activePath, current, currentPoint, currentIndex, speeds, maxSpeed, turnIndex, field, acceleration, kinetic, potential, maxAbsEnergy, velocityArrow, forceArrow, speedPath, chartPoints, energy }
  }, [trajectory, frame, simulationCharges, particleChargeNanoC, particleMassMg])

  function coordinate(axis: keyof Point3D, value: number) { setStart((current) => ({ ...current, [axis]: value })); clearTrajectory() }
  function setSpeed(axis: keyof Point3D, value: number) { setVelocity((current) => ({ ...current, [axis]: value })); clearTrajectory() }
  const atTurn = analysis?.turnIndex !== -1 && analysis?.turnIndex === analysis?.currentIndex

  return <section className="tool-panel trajectory-tool">
    <div className="tool-intro"><span className="section-kicker">MOVIMIENTO DE CARGAS</span><h3>Trayectoria de una partícula</h3></div>
    <div className="trajectory-layout"><div className="trajectory-left-column">
      <div className="trajectory-visual"><svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Reproducción de una partícula cargada bajo la influencia de un campo eléctrico"><defs><pattern id="trajectoryGrid" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d9dee8" /></pattern><marker id="trajectoryVelocityArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#36836f" /></marker><marker id="trajectoryForceArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#bd6c38" /></marker></defs><rect width={WIDTH} height={HEIGHT} fill="url(#trajectoryGrid)" />{analysis && simulationCharges.map((charge) => { const point = analysis.project(charge); return <g key={charge.id}><circle cx={point.x} cy={point.y} r="10" fill={charge.chargeCoulombs > 0 ? '#547cda' : '#d47777'} /><text x={point.x} y={point.y + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{charge.chargeCoulombs > 0 ? '+' : '−'}</text></g> })}{analysis && <><path d={analysis.fullPath} fill="none" stroke="#e6c7aa" strokeWidth="2" strokeDasharray="5 5" /><path d={analysis.activePath} fill="none" stroke="#df8b48" strokeWidth="3" strokeLinecap="round" />{analysis.turnIndex > 0 && <><circle cx={analysis.points[analysis.turnIndex].x} cy={analysis.points[analysis.turnIndex].y} r="10" fill="none" stroke="#8c69bd" strokeWidth="2" strokeDasharray="3 2" /><text x={analysis.points[analysis.turnIndex].x + 10} y={analysis.points[analysis.turnIndex].y - 10} fill="#7556a0" fontSize="9" fontWeight="700">retorno</text></>}<circle cx={analysis.points[0].x} cy={analysis.points[0].y} r="5" fill="#49896c" stroke="white" strokeWidth="2" /><g transform={`translate(${analysis.currentPoint.x} ${analysis.currentPoint.y})`}><circle r="13" fill="#df8b4833" /><circle r="7" fill="#df8b48" stroke="white" strokeWidth="2" />{analysis.velocityArrow && <line x1="0" y1="-9" x2={analysis.velocityArrow.x} y2={analysis.velocityArrow.y - 9} stroke="#36836f" strokeWidth="2.2" markerEnd="url(#trajectoryVelocityArrow)" />}{analysis.forceArrow && <line x1="0" y1="9" x2={analysis.forceArrow.x} y2={analysis.forceArrow.y + 9} stroke="#bd6c38" strokeWidth="2.2" markerEnd="url(#trajectoryForceArrow)" />}</g></>}</svg><div className="trajectory-legend"><span><i className="start-key" />Inicio</span><span><i className="path-key" />Recorrido</span><span><i className="velocity-key" />Velocidad</span><span><i className="force-key" />Fuerza</span></div>{analysis && <div className="trajectory-finish">t = {scientific(analysis.current.time)} s · v = {scientific(speedOf(analysis.current))} m/s · posición ({scientific(analysis.current.position.x)}; {scientific(analysis.current.position.y)}) m</div>}{!trajectory.length && <div className="trajectory-empty">Sin trayectoria</div>}</div>
      {analysis && <div className="trajectory-playback"><div className="playback-buttons"><button aria-label="Volver al inicio" title="Volver al inicio" onClick={() => { setPlaying(false); setFrame(0) }}><SkipBack size={14} /></button><button className="playback-main" onClick={() => { if (frame >= trajectory.length - 1) setFrame(0); setPlaying(!playing) }} aria-label={playing ? 'Pausar recorrido' : 'Reproducir recorrido'}>{playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}{playing ? 'Pausar' : 'Reproducir'}</button><button aria-label="Avanzar un paso" title="Avanzar un paso" onClick={() => { setPlaying(false); setFrame((value) => Math.min(trajectory.length - 1, value + 1)) }}><SkipForward size={14} /></button><button className="return-button" onClick={() => { if (analysis.turnIndex > 0) { setPlaying(false); setFrame(analysis.turnIndex) } }} disabled={analysis.turnIndex < 0}><Target size={13} />Ver punto de retorno</button></div><label className="trajectory-timeline"><span>Recorrido</span><input type="range" min="0" max={trajectory.length - 1} value={analysis.currentIndex} onChange={(event) => { setPlaying(false); setFrame(Number(event.target.value)) }} aria-label="Instante del recorrido"/><span>{analysis.currentIndex + 1}/{trajectory.length}</span></label></div>}
      {analysis && <div className="trajectory-chart-card"><div className="trajectory-chart-title"><strong>Rapidez durante el recorrido</strong><span>Una bajada a cero indica una pausa instantánea</span></div><svg viewBox={`0 0 ${WIDTH} 120`} role="img" aria-label="Gráfica de rapidez respecto al tiempo"><path d="M42 16V94H558" fill="none" stroke="#dfe4eb" strokeWidth="1"/><path d={analysis.speedPath} fill="none" stroke="#548a7b" strokeWidth="2.5"/>{analysis.turnIndex > 0 && <line x1={analysis.chartPoints[analysis.turnIndex].x} x2={analysis.chartPoints[analysis.turnIndex].x} y1="15" y2="95" stroke="#8c69bd" strokeDasharray="3 3"/>}<line x1={analysis.chartPoints[analysis.currentIndex].x} x2={analysis.chartPoints[analysis.currentIndex].x} y1="14" y2="95" stroke="#df8b48" strokeWidth="1.5"/><circle cx={analysis.chartPoints[analysis.currentIndex].x} cy={analysis.chartPoints[analysis.currentIndex].y} r="4" fill="#df8b48"/><text x="42" y="110" fill="#8a94a2" fontSize="8">0 s</text><text x="558" y="110" textAnchor="end" fill="#8a94a2" fontSize="8">{scientific(trajectory[trajectory.length - 1].time)} s</text></svg></div>}
    </div><div className="trajectory-controls"><div className="trajectory-case-picker"><label>CASO<select value={selectedCase} onChange={(event) => selectCase(event.target.value)}><option value="viewer">Cargas actuales</option>{trajectoryCases.map((scenario) => <option value={scenario.id} key={scenario.id}>{scenario.name}</option>)}</select></label></div><div className="tool-card-heading">PARTÍCULA</div><div className="trajectory-input-grid"><label>Carga (nC)<NumericInput step="any" value={particleChargeNanoC} onValueChange={(value) => { setParticleChargeNanoC(value); clearTrajectory() }} /></label><label>Masa (mg)<NumericInput min={0.001} step="any" value={particleMassMg} onValueChange={(value) => { setParticleMassMg(value); clearTrajectory() }} /></label></div><div className="tool-card-heading small-heading">POSICIÓN (cm) · VELOCIDAD (m/s)</div><div className="trajectory-vector-grid">{(['x', 'y', 'z'] as const).map((axis) => <div key={axis}><span>{axis.toUpperCase()}</span><label><NumericInput step="any" value={start[axis]} onValueChange={(value) => coordinate(axis, value)} aria-label={`Posición inicial ${axis} en centímetros`} /><small>cm</small></label><label><NumericInput step="any" value={velocity[axis]} onValueChange={(value) => setSpeed(axis, value)} aria-label={`Velocidad inicial ${axis}`} /><small>m/s</small></label></div>)}</div><label className="duration-input">Duración (ms)<NumericInput min={0.01} max={20} step={0.1} value={durationMs} onValueChange={(value) => { setDurationMs(value); clearTrajectory() }} /></label><div className="trajectory-actions"><button className="play-button" onClick={simulate}><Play size={14} fill="currentColor" />Iniciar recorrido</button><button className="secondary-action" onClick={clearTrajectory}><RotateCcw size={13} />Limpiar</button></div>
      {analysis && <><div className="tool-card-heading trajectory-section-heading">2 · ¿QUÉ OCURRE EN ESTE INSTANTE?</div><div className="trajectory-readouts"><div><span>Rapidez</span><strong>{scientific(speedOf(analysis.current))} <small>m/s</small></strong></div><div><span>Fuerza eléctrica</span><strong>{scientific(Math.hypot(analysis.field.x, analysis.field.y, analysis.field.z) * Math.abs(particleChargeNanoC * 1e-9))} <small>N</small></strong></div><div><span>Energía cinética</span><strong>{scientific(analysis.kinetic)} <small>J</small></strong></div><div><span>Energía potencial</span><strong>{scientific(analysis.potential)} <small>J</small></strong></div></div><div className={`trajectory-explanation ${atTurn ? 'turning' : ''}`}><strong>{atTurn ? 'Punto de retorno' : 'Lee las flechas'}</strong><p>{atTurn ? 'La rapidez casi llega a cero y la partícula invierte el sentido. Si el campo sigue ejerciendo fuerza, la aceleración continúa aunque la velocidad sea cero: por eso vuelve a moverse.' : 'La flecha verde muestra hacia dónde se mueve; la naranja indica la fuerza eléctrica y, por tanto, hacia dónde cambia su velocidad. Al avanzar, observa cómo la energía cinética y potencial se transforman.'}</p></div><div className="energy-bars"><div className="energy-bar-heading"><span>Intercambio de energía</span><small>K + U ≈ constante</small></div><label><span>Cinética K</span><i><b style={{ width: `${Math.min(100, Math.abs(analysis.kinetic) / analysis.maxAbsEnergy * 100)}%` }} /></i></label><label><span>Potencial U</span><i className="potential-energy"><b style={{ width: `${Math.min(100, Math.abs(analysis.potential) / analysis.maxAbsEnergy * 100)}%` }} /></i></label></div></>}
      </div></div>
  </section>
}
