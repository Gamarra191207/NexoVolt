import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, BookOpen, Layers3, RotateCcw, Zap } from 'lucide-react'
import { VACUUM_PERMITTIVITY } from '../physics/capacitors'
import NumericInput from './NumericInput'
import './capacitor-lab.css'
import './capacitor-lab-v2.css'
import './capacitor-lab-v3.css'

type View = 'plates' | 'formulas'
type WorldPoint = { x: number; y: number; z: number }
type ProjectedPoint = { x: number; y: number; depth: number }
type SceneFace = { id: string; points: WorldPoint[]; fill: string; opacity?: number }

function pointsAttribute(points: ProjectedPoint[]) {
  return points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

function rotateScenePoint(point: WorldPoint, rotation: { x: number; y: number; z: number }): ProjectedPoint {
  const pitch = rotation.x * Math.PI / 180
  const yaw = rotation.y * Math.PI / 180
  const roll = rotation.z * Math.PI / 180
  const yawX = Math.cos(yaw) * point.x + Math.sin(yaw) * point.z
  const yawZ = -Math.sin(yaw) * point.x + Math.cos(yaw) * point.z
  const pitchY = Math.cos(pitch) * point.y - Math.sin(pitch) * yawZ
  const pitchZ = Math.sin(pitch) * point.y + Math.cos(pitch) * yawZ
  return {
    x: Math.cos(roll) * yawX - Math.sin(roll) * pitchY,
    y: Math.sin(roll) * yawX + Math.cos(roll) * pitchY,
    depth: pitchZ,
  }
}

function makeCuboidFaces(
  center: WorldPoint,
  size: WorldPoint,
  colors: { near: string; far: string; left: string; right: string; top: string; bottom: string },
  id: string,
  opacity = 1,
): SceneFace[] {
  const x = size.x / 2
  const y = size.y / 2
  const z = size.z / 2
  const vertices: WorldPoint[] = [
    { x: center.x - x, y: center.y - y, z: center.z - z },
    { x: center.x + x, y: center.y - y, z: center.z - z },
    { x: center.x + x, y: center.y + y, z: center.z - z },
    { x: center.x - x, y: center.y + y, z: center.z - z },
    { x: center.x - x, y: center.y - y, z: center.z + z },
    { x: center.x + x, y: center.y - y, z: center.z + z },
    { x: center.x + x, y: center.y + y, z: center.z + z },
    { x: center.x - x, y: center.y + y, z: center.z + z },
  ]
  const faces: { name: keyof typeof colors; indices: number[] }[] = [
    { name: 'near', indices: [4, 5, 6, 7] },
    { name: 'far', indices: [0, 3, 2, 1] },
    { name: 'left', indices: [0, 4, 7, 3] },
    { name: 'right', indices: [1, 2, 6, 5] },
    { name: 'top', indices: [3, 7, 6, 2] },
    { name: 'bottom', indices: [0, 1, 5, 4] },
  ]
  return faces.map((face) => ({
    id: `${id}-${face.name}`,
    points: face.indices.map((index) => vertices[index]),
    fill: colors[face.name],
    opacity,
  }))
}

function formatValue(value: number, unit: string, digits = 3) {
  if (!Number.isFinite(value)) return `— ${unit}`
  return `${Number(value.toPrecision(digits)).toLocaleString('es-PE')} ${unit}`
}

function formatCapacitance(farads: number) {
  if (farads >= 1) return formatValue(farads, 'F')
  if (farads >= 1e-3) return formatValue(farads * 1e3, 'mF')
  if (farads >= 1e-6) return formatValue(farads * 1e6, 'µF')
  if (farads >= 1e-9) return formatValue(farads * 1e9, 'nF')
  return formatValue(farads * 1e12, 'pF')
}

function formatCharge(coulombs: number) {
  if (Math.abs(coulombs) >= 1) return formatValue(coulombs, 'C')
  if (Math.abs(coulombs) >= 1e-3) return formatValue(coulombs * 1e3, 'mC')
  if (Math.abs(coulombs) >= 1e-6) return formatValue(coulombs * 1e6, 'µC')
  if (Math.abs(coulombs) >= 1e-9) return formatValue(coulombs * 1e9, 'nC')
  return formatValue(coulombs * 1e12, 'pC')
}

function formatEnergy(joules: number) {
  if (joules >= 1) return formatValue(joules, 'J')
  if (joules >= 1e-3) return formatValue(joules * 1e3, 'mJ')
  if (joules >= 1e-6) return formatValue(joules * 1e6, 'µJ')
  return formatValue(joules * 1e9, 'nJ')
}

export default function CapacitorLab() {
  const [view, setView] = useState<View>('plates')
  const [areaCm2, setAreaCm2] = useState(100)
  const [separationMm, setSeparationMm] = useState(2)
  const [sourceVoltage, setSourceVoltage] = useState(120)
  const [relativePermittivity, setRelativePermittivity] = useState(4)
  const [dielectricInserted, setDielectricInserted] = useState(true)
  const [batteryConnected, setBatteryConnected] = useState(true)
  const [isolatedCharge, setIsolatedCharge] = useState(VACUUM_PERMITTIVITY * 100e-4 / 2e-3 * 120)
  const [cameraRotation, setCameraRotation] = useState({ x: -18, y: 28, z: 0 })
  const [cameraZoom, setCameraZoom] = useState(1)
  const orbitStart = useRef<{ pointerId: number; x: number; y: number; yaw: number; pitch: number } | null>(null)

  const plateResults = useMemo(() => {
    const area = areaCm2 * 1e-4
    const separation = separationMm * 1e-3
    const epsilonR = dielectricInserted ? relativePermittivity : 1
    const capacitance = VACUUM_PERMITTIVITY * epsilonR * area / separation
    const voltage = batteryConnected ? sourceVoltage : isolatedCharge / capacitance
    const charge = batteryConnected ? capacitance * sourceVoltage : isolatedCharge
    const field = voltage / separation
    const energy = 0.5 * capacitance * voltage ** 2
    const polarization = VACUUM_PERMITTIVITY * (epsilonR - 1) * field
    const energyDensity = 0.5 * VACUUM_PERMITTIVITY * epsilonR * field ** 2
    return { capacitance, voltage, charge, field, energy, polarization, energyDensity, susceptibility: epsilonR - 1 }
  }, [areaCm2, separationMm, sourceVoltage, relativePermittivity, dielectricInserted, batteryConnected, isolatedCharge])

  function reset() {
    setAreaCm2(100)
    setSeparationMm(2)
    setSourceVoltage(120)
    setRelativePermittivity(4)
    setDielectricInserted(true)
    setBatteryConnected(true)
    setIsolatedCharge(VACUUM_PERMITTIVITY * 100e-4 / 2e-3 * 120)
  }

  const areaProgress = (Math.sqrt(areaCm2) - Math.sqrt(20)) / (Math.sqrt(500) - Math.sqrt(20))
  const plateSide = 1.1 + areaProgress * 0.9
  const plateThickness = 0.07
  const separation = 0.6 + ((separationMm - 0.5) / 9.5) * 1.5
  const plateOffset = separation / 2 + plateThickness / 2
  const leftPlateCenter = { x: -plateOffset, y: 0, z: 0 }
  const rightPlateCenter = { x: plateOffset, y: 0, z: 0 }
  const leftPlateFaces = makeCuboidFaces(leftPlateCenter, { x: plateThickness, y: plateSide, z: plateSide }, { near: '#557bc4', far: '#405f9e', left: '#39588f', right: '#466cac', top: '#8da9de', bottom: '#304d82' }, 'positive-plate')
  const rightPlateFaces = makeCuboidFaces(rightPlateCenter, { x: plateThickness, y: plateSide, z: plateSide }, { near: '#cf727b', far: '#a9505c', left: '#994650', right: '#bd626d', top: '#e6a0a2', bottom: '#8a3c49' }, 'negative-plate')
  const dielectricFaces = dielectricInserted
    ? makeCuboidFaces({ x: 0, y: 0, z: 0 }, { x: separation * 0.92, y: plateSide * 0.92, z: plateSide * 0.92 }, { near: '#b8cae7', far: '#9eb2d4', left: '#879fc7', right: '#9fb4d9', top: '#d5e0f1', bottom: '#7d94b8' }, 'dielectric', 0.48)
    : []
  const worldFieldLines = [
    ...Array.from({ length: 5 }, (_, index) => ({ y: (index - 2) * plateSide * 0.15, z: 0 })),
    ...Array.from({ length: 5 }, (_, index) => ({ y: 0, z: (index - 2) * plateSide * 0.15 })),
  ].map(({ y, z }) => ({ from: { x: -separation / 2 + 0.1, y, z }, to: { x: separation / 2 - 0.1, y, z } }))
  const dimensionY = -plateSide / 2 - 0.24
  const dimensionStart = { x: -separation / 2, y: dimensionY, z: 0 }
  const dimensionEnd = { x: separation / 2, y: dimensionY, z: 0 }
  const sceneFaces = [...leftPlateFaces, ...rightPlateFaces, ...dielectricFaces]
  const sceneWorldPoints = [
    ...sceneFaces.flatMap((face) => face.points),
    ...worldFieldLines.flatMap((line) => [line.from, line.to]),
    dimensionStart,
    dimensionEnd,
  ]
  const rotatedScenePoints = sceneWorldPoints.map((point) => rotateScenePoint(point, cameraRotation))
  const sceneBounds = rotatedScenePoints.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x), maxX: Math.max(bounds.maxX, point.x),
    minY: Math.min(bounds.minY, point.y), maxY: Math.max(bounds.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
  const sceneScale = Math.min(590 / (sceneBounds.maxX - sceneBounds.minX), 260 / (sceneBounds.maxY - sceneBounds.minY)) * cameraZoom
  const sceneCenterX = (sceneBounds.minX + sceneBounds.maxX) / 2
  const sceneCenterY = (sceneBounds.minY + sceneBounds.maxY) / 2
  const projectPoint = (point: WorldPoint): ProjectedPoint => {
    const rotated = rotateScenePoint(point, cameraRotation)
    return { x: 380 + (rotated.x - sceneCenterX) * sceneScale, y: 196 - (rotated.y - sceneCenterY) * sceneScale, depth: rotated.depth }
  }
  const projectedFaces = sceneFaces.map((face) => {
    const points = face.points.map(projectPoint)
    return { ...face, projected: points, depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length }
  }).sort((a, b) => a.depth - b.depth)
  const projectedFieldLines = worldFieldLines.map((line) => ({ from: projectPoint(line.from), to: projectPoint(line.to) }))
  const projectedDimensionStart = projectPoint(dimensionStart)
  const projectedDimensionEnd = projectPoint(dimensionEnd)
  const projectedDimensionCenter = projectPoint({ x: 0, y: dimensionY, z: 0 })
  const projectedLeftCenter = projectPoint(leftPlateCenter)
  const projectedRightCenter = projectPoint(rightPlateCenter)
  const projectedDielectricCenter = projectPoint({ x: 0, y: 0, z: 0 })

  function resetCamera() {
    setCameraRotation({ x: -18, y: 28, z: 0 })
    setCameraZoom(1)
  }

  function handleScenePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    orbitStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, yaw: cameraRotation.y, pitch: cameraRotation.x }
  }

  function handleScenePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const start = orbitStart.current
    if (!start || start.pointerId !== event.pointerId) return
    const yaw = ((start.yaw + (event.clientX - start.x) * 0.65 + 180) % 360 + 360) % 360 - 180
    const pitch = Math.max(-89, Math.min(89, start.pitch - (event.clientY - start.y) * 0.55))
    setCameraRotation((current) => ({ ...current, x: pitch, y: yaw }))
  }

  function stopSceneDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (orbitStart.current?.pointerId !== event.pointerId) return
    orbitStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function openFormulaRepository() {
    setView('formulas')
  }

  return <div className="capacitor-lab">
    <div className="capacitor-toolbar">
      {view === 'formulas' ? <button className="formula-back-button" onClick={() => setView('plates')}><ArrowLeft size={14} />Volver al simulador</button> : <>
        <div className="capacitor-section-label"><Layers3 size={15} /><div><strong>Placas y dieléctricos</strong><span>Simulación 3D y energía almacenada</span></div></div>
        <div className="capacitor-toolbar-actions"><button className="formula-library-button" onClick={openFormulaRepository}><BookOpen size={13} />Fórmulas</button><span className="capacitor-assumptions">MODELO ELECTROSTÁTICO IDEAL</span><button className="reset-button" onClick={reset}><RotateCcw size={13} />Reiniciar</button></div>
      </>}
    </div>

    {view === 'formulas' ? <FormulaRepository /> : <>
    <div className="plate-lab-layout">
      <div className="plate-main-column">
        <div className={`plate-visual capacitor-3d-visual ${dielectricInserted ? 'has-dielectric' : ''}`}>
          <svg
            className="capacitor-3d-scene"
            viewBox="0 0 760 400"
            role="img"
            aria-label={`Modelo 3D navegable del capacitor: área ${areaCm2} centímetros cuadrados y separación ${separationMm} milímetros. Arrastra para orbitar.`}
            onPointerDown={handleScenePointerDown}
            onPointerMove={handleScenePointerMove}
            onPointerUp={stopSceneDrag}
            onPointerCancel={stopSceneDrag}
            onWheel={(event) => { event.preventDefault(); setCameraZoom((zoom) => Math.min(1.45, Math.max(0.65, zoom * (event.deltaY < 0 ? 1.08 : 0.92)))) }}
          >
            <defs>
              <marker id="field-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#7893c5" /></marker>
              <marker id="dimension-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 Z" fill="#7d8da7" /></marker>
            </defs>
            <ellipse cx="380" cy="345" rx="185" ry="18" fill="#253858" opacity=".06" />
            {projectedFaces.map((face) => <polygon key={face.id} points={pointsAttribute(face.projected)} fill={face.fill} fillOpacity={face.opacity ?? 1} stroke="#fff" strokeOpacity=".28" strokeWidth="1.2" className={face.id.startsWith('dielectric') ? 'dielectric-3d-face' : 'plate-3d-face'} />)}
            {projectedFieldLines.map((line, index) => <line key={index} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} className="capacitor-field-ray" markerEnd="url(#field-arrow)" />)}
            <text x={projectedLeftCenter.x} y={projectedLeftCenter.y + 7} className="plate-charge-mark" textAnchor="middle">+</text>
            <text x={projectedRightCenter.x} y={projectedRightCenter.y + 7} className="plate-charge-mark" textAnchor="middle">−</text>
            {dielectricInserted ? <text x={projectedDielectricCenter.x} y={projectedDielectricCenter.y + 5} className="dielectric-3d-label" textAnchor="middle">εᵣ {relativePermittivity.toFixed(1)}</text> : <text x={projectedDielectricCenter.x} y={projectedDielectricCenter.y + 5} className="vacuum-3d-label" textAnchor="middle">Vacío</text>}
            <line x1={projectedDimensionStart.x} y1={projectedDimensionStart.y} x2={projectedDimensionEnd.x} y2={projectedDimensionEnd.y} className="dimension-line" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)" />
            <rect x={projectedDimensionCenter.x - 45} y={projectedDimensionCenter.y + 11} width="90" height="21" rx="10.5" className="dimension-label-bg" />
            <text x={projectedDimensionCenter.x} y={projectedDimensionCenter.y + 25} className="dimension-label" textAnchor="middle">{separationMm.toFixed(1)} mm</text>
            <text x="380" y="27" className="scene-view-label" textAnchor="middle">MODELO 3D</text>
          </svg>
          <div className="plate-caption"><span><i />Vista 3D · placas cuadradas</span><span>Área · {areaCm2} cm²</span></div>
        </div>
        <div className="camera-navigation-panel">
          <div className="camera-navigation-heading"><div><strong>Vista 3D</strong></div><button onClick={resetCamera}><RotateCcw size={12} />Restablecer</button></div>
          <div className="camera-axis-controls">
            <label><span>Rotación X</span><output>{cameraRotation.x.toFixed(0)}°</output><input type="range" min="-90" max="90" step="1" value={cameraRotation.x} style={{ '--range': `${((cameraRotation.x + 90) / 180) * 100}%` } as CSSProperties} onChange={(event) => setCameraRotation((rotation) => ({ ...rotation, x: Number(event.target.value) }))} /></label>
            <label><span>Rotación Y</span><output>{cameraRotation.y.toFixed(0)}°</output><input type="range" min="-180" max="180" step="1" value={cameraRotation.y} style={{ '--range': `${((cameraRotation.y + 180) / 360) * 100}%` } as CSSProperties} onChange={(event) => setCameraRotation((rotation) => ({ ...rotation, y: Number(event.target.value) }))} /></label>
            <label><span>Rotación Z</span><output>{cameraRotation.z.toFixed(0)}°</output><input type="range" min="-180" max="180" step="1" value={cameraRotation.z} style={{ '--range': `${((cameraRotation.z + 180) / 360) * 100}%` } as CSSProperties} onChange={(event) => setCameraRotation((rotation) => ({ ...rotation, z: Number(event.target.value) }))} /></label>
            <label><span>Zoom</span><output>{Math.round(cameraZoom * 100)}%</output><input type="range" min="65" max="145" step="1" value={Math.round(cameraZoom * 100)} style={{ '--range': `${((cameraZoom - 0.65) / 0.8) * 100}%` } as CSSProperties} onChange={(event) => setCameraZoom(Number(event.target.value) / 100)} /></label>
          </div>
        </div>
        <div className="plate-control-panel">
          <div className="plate-control-heading"><div><strong>Control del sistema</strong><span>La escena 3D refleja cada ajuste en tiempo real</span></div><span className="control-live-badge"><i />ACTIVO</span></div>
          <div className="plate-control-grid">
            <label className="capacitor-control"><span>Área de cada placa</span><div className="capacitor-control-input"><NumericInput min={20} max={500} step={1} value={areaCm2} onValueChange={setAreaCm2} /><em>cm²</em></div><input className="capacitor-range" aria-label="Área de cada placa" type="range" min="20" max="500" step="1" value={areaCm2} style={{ '--range': `${((areaCm2 - 20) / 480) * 100}%` } as CSSProperties} onChange={(event) => setAreaCm2(Number(event.target.value))} /></label>
            <label className="capacitor-control"><span>Separación entre placas</span><div className="capacitor-control-input"><NumericInput min={0.5} max={10} step={0.1} value={separationMm} onValueChange={setSeparationMm} /><em>mm</em></div><input className="capacitor-range" aria-label="Separación entre placas" type="range" min="0.5" max="10" step="0.1" value={separationMm} style={{ '--range': `${((separationMm - 0.5) / 9.5) * 100}%` } as CSSProperties} onChange={(event) => setSeparationMm(Number(event.target.value))} /></label>
            <label className="capacitor-control"><span>Voltaje de la fuente</span><div className="capacitor-control-input"><NumericInput min={10} max={500} step={1} value={sourceVoltage} onValueChange={setSourceVoltage} /><em>V</em></div><input className="capacitor-range" aria-label="Voltaje de la fuente" type="range" min="10" max="500" step="1" value={sourceVoltage} style={{ '--range': `${((sourceVoltage - 10) / 490) * 100}%` } as CSSProperties} onChange={(event) => setSourceVoltage(Number(event.target.value))} /></label>
            <label className={`capacitor-control ${!dielectricInserted ? 'is-disabled' : ''}`}><span>Permitividad relativa</span><div className="capacitor-control-input"><NumericInput min={1} max={10} step={0.1} value={relativePermittivity} disabled={!dielectricInserted} onValueChange={setRelativePermittivity} /><em>εr</em></div><input className="capacitor-range" aria-label="Permitividad relativa" type="range" min="1" max="10" step="0.1" value={relativePermittivity} disabled={!dielectricInserted} style={{ '--range': `${((relativePermittivity - 1) / 9) * 100}%` } as CSSProperties} onChange={(event) => setRelativePermittivity(Number(event.target.value))} /></label>
          </div>
        </div>
      </div>
      <div className="plate-side-column">
        <section className="plate-condition-card">
          <div className="plate-section-title"><Zap size={14} /><strong>Condiciones del sistema</strong></div>
          <div className="condition-toggle-row medium-condition-row"><div><strong>Medio entre placas</strong><small>{dielectricInserted ? 'Material dieléctrico' : 'Vacío, sin material'}</small></div><div className="medium-mode-picker" role="radiogroup" aria-label="Medio entre placas"><button role="radio" aria-checked={!dielectricInserted} className={!dielectricInserted ? 'selected' : ''} onClick={() => setDielectricInserted(false)}>Vacío</button><button role="radio" aria-checked={dielectricInserted} className={dielectricInserted ? 'selected' : ''} onClick={() => setDielectricInserted(true)}>Dieléctrico</button></div></div>
          <div className="condition-toggle-row"><div><strong>Batería conectada</strong><small>{batteryConnected ? 'El voltaje se mantiene constante' : 'La carga queda aislada'}</small></div><button className={`switch ${batteryConnected ? 'on' : ''}`} role="switch" aria-checked={batteryConnected} aria-label="Conectar batería" onClick={() => { if (batteryConnected) setIsolatedCharge(plateResults.charge); setBatteryConnected(!batteryConnected) }}><i /></button></div>
        </section>
        <section className="plate-results-card">
          <div className="plate-section-title"><span className="live-dot" /><strong>Magnitudes calculadas</strong><small>EN VIVO</small></div>
          <div className="plate-primary-result"><span>Capacitancia</span><strong>{formatCapacitance(plateResults.capacitance)}</strong><small>Capacitor de placas paralelas</small></div>
          <div className="plate-metrics-grid">
            <div><span>Carga eléctrica</span><strong>{formatCharge(plateResults.charge)}</strong><small>En las placas</small></div>
            <div><span>Diferencia de potencial</span><strong>{formatValue(plateResults.voltage, 'V')}</strong><small>Entre placas</small></div>
            <div><span>Campo eléctrico</span><strong>{formatValue(plateResults.field / 1e3, 'kV/m')}</strong><small>En el espacio interior</small></div>
            <div><span>Energía almacenada</span><strong>{formatEnergy(plateResults.energy)}</strong><small>En el campo eléctrico</small></div>
          </div>
          <p className="plate-interpretation">{batteryConnected ? 'Con batería conectada, el voltaje permanece fijo; al insertar el dieléctrico aumentan la capacitancia, la carga y la energía.' : 'Con la batería desconectada, la carga permanece fija; el dieléctrico reduce el voltaje, el campo y la energía almacenada.'}</p>
        </section>
        <div className="dielectric-detail"><strong>{dielectricInserted ? 'Respuesta del material' : 'Medio de referencia'}</strong><span>Susceptibilidad eléctrica · {plateResults.susceptibility.toFixed(1)}</span><span>Polarización · {formatValue(plateResults.polarization * 1e6, 'µC/m²')}</span><span>Densidad de energía · {formatValue(plateResults.energyDensity, 'J/m³')}</span></div>
      </div>
    </div>
    </>}
  </div>
}

function FormulaRepository() {
  const groups = [
    {
      title: 'Capacitor de placas paralelas',
      subtitle: 'Geometría y magnitudes eléctricas',
      formulas: [
        ['Capacitancia', 'C = ε A / d', 'A es el área de una placa y d la separación.'],
        ['Carga y diferencia de potencial', 'Q = C ΔV', 'Relación constitutiva para un capacitor ideal.'],
        ['Campo entre placas', 'E ≈ ΔV / d', 'Aproximación válida lejos de los bordes.'],
      ],
    },
    {
      title: 'Material dieléctrico y energía',
      subtitle: 'Medio lineal, homogéneo e isotrópico',
      formulas: [
        ['Permitividad', 'ε = ε₀ εᵣ', 'ε₀ es la permitividad del vacío (8.854 × 10⁻¹² F/m) y εᵣ la relativa del material.'],
        ['Susceptibilidad', 'χₑ = εᵣ − 1', 'Relación para un dieléctrico lineal.'],
        ['Polarización', 'P = ε₀ χₑ E', 'Densidad de momento dipolar inducido.'],
        ['Energía almacenada', 'U = ½ C (ΔV)² = Q²/(2C) = ½ Q ΔV', 'Las expresiones son equivalentes para un capacitor ideal.'],
        ['Densidad de energía', 'u = ½ ε E²', 'Energía almacenada por unidad de volumen del campo.'],
      ],
    },
  ] as const

  return <section className="formula-repository" aria-labelledby="formula-repository-title">
    <div className="formula-repository-heading"><div><span className="section-kicker">BIBLIOTECA DEL MÓDULO</span><h3 id="formula-repository-title">Repositorio de fórmulas</h3><p>Ecuaciones utilizadas para placas paralelas, dieléctricos y energía almacenada.</p></div><BookOpen size={22} /></div>
    <div className="formula-repository-groups">{groups.map((group) => <article className="formula-group" key={group.title}><header><strong>{group.title}</strong><span>{group.subtitle}</span></header><div className="formula-group-items">{group.formulas.map(([title, equation, description]) => <div className="formula-entry" key={title}><strong>{title}</strong><div className="formula-equation">{equation}</div><p>{description}</p></div>)}</div></article>)}</div>
    <div className="formula-assumption-note"><strong>Supuestos del modelo</strong><span>Capacitores ideales, dieléctrico lineal y uniforme, placas paralelas y efectos de borde despreciables.</span></div>
  </section>
}
