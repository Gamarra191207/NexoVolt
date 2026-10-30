import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { Minus, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { fieldAt, isAtCharge, potentialAt, type Point2D, type Point3D, type PointCharge } from '../physics/electrostatics'
import TrajectorySimulator from './TrajectorySimulator'
import NumericInput from './NumericInput'

const WIDTH = 600
const HEIGHT = 360
const unproject2D = (screen: Point2D, camera: Camera): Point3D => ({ x: camera.target.x + (screen.x - WIDTH / 2) / (20 * camera.zoom), y: camera.target.y + (HEIGHT / 2 - screen.y) / (20 * camera.zoom), z: 0 })
const project2D = (point: Point3D, camera: Camera): Point2D => ({ x: WIDTH / 2 + (point.x - camera.target.x) * 20 * camera.zoom, y: HEIGHT / 2 - (point.y - camera.target.y) * 20 * camera.zoom })
type Camera = { yaw: number; pitch: number; zoom: number; target: Point3D }
function project3D(point: Point3D, camera: Camera): Point2D {
  const x = point.x - camera.target.x, y = point.y - camera.target.y, z = point.z - camera.target.z
  const cosYaw = Math.cos(camera.yaw), sinYaw = Math.sin(camera.yaw)
  const rotatedX = cosYaw * x - sinYaw * y
  const rotatedY = sinYaw * x + cosYaw * y
  const cosPitch = Math.cos(camera.pitch), sinPitch = Math.sin(camera.pitch)
  const vertical = cosPitch * rotatedY - sinPitch * z
  const scale = 20 * camera.zoom
  return { x: WIDTH / 2 + rotatedX * scale, y: HEIGHT / 2 - vertical * scale }
}
function cameraDepth(point: Point3D, camera: Camera): number {
  const x = point.x - camera.target.x, y = point.y - camera.target.y, z = point.z - camera.target.z
  const rotatedY = Math.sin(camera.yaw) * x + Math.cos(camera.yaw) * y
  return Math.sin(camera.pitch) * rotatedY + Math.cos(camera.pitch) * z
}
function unprojectAtZ(screen: Point2D, camera: Camera, z: number): Point3D {
  const scale = 20 * camera.zoom
  const u = (screen.x - WIDTH / 2) / scale
  const vertical = (HEIGHT / 2 - screen.y) / scale
  const projectedY = (vertical + Math.sin(camera.pitch) * (z - camera.target.z)) / Math.cos(camera.pitch)
  const x = camera.target.x + Math.cos(camera.yaw) * u + Math.sin(camera.yaw) * projectedY
  const y = camera.target.y - Math.sin(camera.yaw) * u + Math.cos(camera.yaw) * projectedY
  return { x, y, z }
}
const chargePrefixes = [
  { exponent: -12, label: 'pC' }, { exponent: -9, label: 'nC' }, { exponent: -6, label: 'μC' },
  { exponent: -3, label: 'mC' }, { exponent: 0, label: 'C' }, { exponent: 3, label: 'kC' },
  { exponent: 6, label: 'MC' }, { exponent: 9, label: 'GC' }, { exponent: 12, label: 'TC' },
]
const scientific = (value: number) => value.toExponential(3).replace('e', ' × 10^')
const chargeParts = (charge: number) => {
  if (charge === 0) return { mantissa: 1, exponent: -6 }
  const exponent = Math.max(-12, Math.min(12, Math.floor(Math.log10(Math.abs(charge)) / 3) * 3))
  return { mantissa: Math.abs(charge) / 10 ** exponent, exponent }
}
const scenarios: { name: string; charges: PointCharge[] }[] = [
  { name: 'Dipolo', charges: [{ id: 1, x: -4, y: 0, z: 0, chargeCoulombs: 2e-6 }, { id: 2, x: 4, y: 0, z: 0, chargeCoulombs: -2e-6 }] },
  { name: 'Dos cargas iguales', charges: [{ id: 1, x: -4, y: 0, z: 0, chargeCoulombs: 2e-6 }, { id: 2, x: 4, y: 0, z: 0, chargeCoulombs: 2e-6 }] },
  { name: 'Tres cargas', charges: [{ id: 1, x: -5, y: 0, z: 0, chargeCoulombs: 2e-6 }, { id: 2, x: 0, y: 3, z: 0, chargeCoulombs: -1e-6 }, { id: 3, x: 5, y: 0, z: 0, chargeCoulombs: 2e-6 }] },
]

function contours(charges: PointCharge[], camera: Camera) {
  const step = 12
  const scale = Math.max(...charges.map((charge) => Math.abs(charge.chargeCoulombs)), 1e-12) / 1e-6
  const levels = [-250000, -150000, -90000, -45000, 45000, 90000, 150000, 250000].map((level) => level * scale)
  const values: number[][] = []
  for (let y = 0; y <= HEIGHT; y += step) {
    const row: number[] = []
    for (let x = 0; x <= WIDTH; x += step) row.push(potentialAt(unproject2D({ x, y }, camera), charges))
    values.push(row)
  }
  const paths: { level: number; d: string }[] = []
  for (const level of levels) {
    let d = ''
    for (let row = 0; row < values.length - 1; row++) for (let col = 0; col < values[row].length - 1; col++) {
      const x = col * step; const y = row * step
      const corners = [values[row][col], values[row][col + 1], values[row + 1][col + 1], values[row + 1][col]]
      const edges: Point2D[] = []
      const coords: Point2D[] = [{ x, y }, { x: x + step, y }, { x: x + step, y: y + step }, { x, y: y + step }]
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4
        const a = corners[edge] - level; const b = corners[next] - level
        if ((a < 0) !== (b < 0)) {
          const t = a / (a - b)
          edges.push({ x: coords[edge].x + (coords[next].x - coords[edge].x) * t, y: coords[edge].y + (coords[next].y - coords[edge].y) * t })
        }
      }
      for (let i = 0; i + 1 < edges.length; i += 2) d += `M${edges[i].x.toFixed(1)},${edges[i].y.toFixed(1)}L${edges[i + 1].x.toFixed(1)},${edges[i + 1].y.toFixed(1)}`
    }
    paths.push({ level, d })
  }
  return paths
}

function equipotentialSurfaces(charges: PointCharge[], camera: Camera) {
  if (!charges.length) return [] as { level: number; vertices: Point3D[] }[]
  const maxCharge = Math.max(...charges.map((charge) => Math.abs(charge.chargeCoulombs)), 1e-12)
  const levels = [-250000, -90000, 90000, 250000].map((level) => level * maxCharge / 1e-6)
  const span = 18 / camera.zoom
  const xs = Array.from({ length: 13 }, (_, i) => camera.target.x - span + i * span / 6)
  const ys = Array.from({ length: 9 }, (_, i) => camera.target.y - span + i * span / 4)
  const zs = Array.from({ length: 7 }, (_, i) => camera.target.z - span + i * span / 3)
  const samples = new Map<string, { position: Point3D; value: number }>()
  for (const z of zs) for (const y of ys) for (const x of xs) {
    const position = { x, y, z }
    const source = charges.find((charge) => Math.hypot(x - charge.x, y - charge.y, z - charge.z) < 1e-5)
    const value = source ? Math.sign(source.chargeCoulombs) * 1e30 : potentialAt(position, charges)
    samples.set(`${x},${y},${z}`, { position, value })
  }
  const tetrahedra = [[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7]]
  const edges = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]
  const polygons: { level: number; vertices: Point3D[] }[] = []
  for (let zi = 0; zi < zs.length - 1; zi++) for (let yi = 0; yi < ys.length - 1; yi++) for (let xi = 0; xi < xs.length - 1; xi++) {
    const x = xs[xi], y = ys[yi], z = zs[zi]
    const corners = [
      samples.get(`${x},${y},${z}`)!, samples.get(`${xs[xi + 1]},${y},${z}`)!,
      samples.get(`${x},${ys[yi + 1]},${z}`)!, samples.get(`${xs[xi + 1]},${ys[yi + 1]},${z}`)!,
      samples.get(`${x},${y},${zs[zi + 1]}`)!, samples.get(`${xs[xi + 1]},${y},${zs[zi + 1]}`)!,
      samples.get(`${x},${ys[yi + 1]},${zs[zi + 1]}`)!, samples.get(`${xs[xi + 1]},${ys[yi + 1]},${zs[zi + 1]}`)!,
    ]
    for (const level of levels) for (const tetra of tetrahedra) {
      const intersections: Point3D[] = []
      for (const [edgeA, edgeB] of edges) {
        const a = corners[tetra[edgeA]], b = corners[tetra[edgeB]]
        const va = a.value - level, vb = b.value - level
        if ((va < 0) !== (vb < 0)) {
          const t = va / (va - vb)
          intersections.push({ x: a.position.x + (b.position.x - a.position.x) * t, y: a.position.y + (b.position.y - a.position.y) * t, z: a.position.z + (b.position.z - a.position.z) * t })
        }
      }
      if (intersections.length < 3) continue
      const center = { x: intersections.reduce((sum, item) => sum + item.x, 0) / intersections.length, y: intersections.reduce((sum, item) => sum + item.y, 0) / intersections.length, z: intersections.reduce((sum, item) => sum + item.z, 0) / intersections.length }
      const normal = { x: intersections[1].x - intersections[0].x, y: intersections[1].y - intersections[0].y, z: intersections[1].z - intersections[0].z }
      const basisU = { x: normal.y, y: -normal.x, z: 0 }
      const basisLength = Math.hypot(basisU.x, basisU.y, basisU.z) || 1
      basisU.x /= basisLength; basisU.y /= basisLength
      const basisV = { x: normal.y * basisU.z - normal.z * basisU.y, y: normal.z * basisU.x - normal.x * basisU.z, z: normal.x * basisU.y - normal.y * basisU.x }
      intersections.sort((a, b) => {
        const angle = (point: Point3D) => Math.atan2((point.x - center.x) * basisV.x + (point.y - center.y) * basisV.y + (point.z - center.z) * basisV.z, (point.x - center.x) * basisU.x + (point.y - center.y) * basisU.y + (point.z - center.z) * basisU.z)
        return angle(a) - angle(b)
      })
      const triangles = intersections.length === 3 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]]
      for (const triangle of triangles) {
        polygons.push({ level, vertices: triangle.map((index) => intersections[index]) })
      }
    }
  }
  return polygons
}

function fieldLines(charges: PointCharge[], threeD = false) {
  const lines: Point3D[][] = []
  for (const source of charges.filter((charge) => charge.chargeCoulombs > 0)) {
    const count = threeD ? 28 : 18
    for (let seed = 0; seed < count; seed++) {
      const angle = seed * Math.PI * (3 - Math.sqrt(5))
      const sphereZ = threeD ? 1 - 2 * (seed + .5) / count : 0
      const radius = threeD ? Math.sqrt(1 - sphereZ * sphereZ) : 1
      const direction = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: sphereZ }
      let point: Point3D = { x: source.x + direction.x * .55, y: source.y + direction.y * .55, z: source.z + direction.z * .55 }
      const path: Point3D[] = [{ ...point }]
      for (let step = 0; step < 2400; step++) {
        const vector = fieldAt(point, charges)
        const magnitude = Math.hypot(vector.x, vector.y, vector.z)
        if (magnitude < 1e-10) break
        const distanceStep = threeD ? .12 : .1
        point = { x: point.x + vector.x / magnitude * distanceStep, y: point.y + vector.y / magnitude * distanceStep, z: point.z + vector.z / magnitude * distanceStep }
        path.push({ ...point })
        if (charges.some((charge) => Math.hypot(point.x - charge.x, point.y - charge.y, point.z - charge.z) < .6)) break
      }
      lines.push(path)
    }
  }
  return lines
}

export default function ElectricFieldLab() {
  const [activeTool, setActiveTool] = useState<'viewer' | 'trajectory'>('viewer')
  const [threeD, setThreeD] = useState(false)
  const [charges, setCharges] = useState<PointCharge[]>([])
  const [selectedScenario, setSelectedScenario] = useState('empty')
  const [probe, setProbe] = useState<Point3D>({ x: 0, y: 3.2, z: 0 })
  const [showField, setShowField] = useState(true)
  const [showPotential, setShowPotential] = useState(true)
  const [dragging, setDragging] = useState<number | 'probe' | 'orbit' | 'pan' | 'depth' | null>(null)
  const [camera, setCamera] = useState<Camera>({ yaw: -.45, pitch: .35, zoom: .82, target: { x: 0, y: 0, z: 0 } })
  const pointerPosition = useRef<Point2D | null>(null)
  const [nextId, setNextId] = useState(1)
  const probeWorld = probe
  const field = fieldAt(probeWorld, charges)
  const magnitude = Math.hypot(field.x, field.y, field.z)
  const potential = potentialAt(probeWorld, charges)
  const probeAtSource = isAtCharge(probeWorld, charges)
  const equipotentials = useMemo(() => contours(charges, camera), [charges, camera.target.x, camera.target.y, camera.zoom])
  const surfaces3D = useMemo(() => threeD ? equipotentialSurfaces(charges, camera) : [], [charges, threeD, camera.target.x, camera.target.y, camera.target.z, camera.zoom])
  const surfacesInView = useMemo(() => surfaces3D.map((surface) => ({ ...surface, depth: surface.vertices.reduce((sum, point) => sum + cameraDepth(point, camera), 0) / surface.vertices.length })).sort((a, b) => a.depth - b.depth), [surfaces3D, camera])
  const fieldPaths = useMemo(() => fieldLines(charges, threeD), [charges, threeD])
  const project = (point: Point3D) => threeD ? project3D(point, camera) : project2D(point, camera)
  const spatialAxes: { label: string; end: Point3D; color: string }[] = [
    { label: 'x', end: { x: 3, y: 0, z: 0 }, color: '#d36f70' },
    { label: 'y', end: { x: 0, y: 3, z: 0 }, color: '#5f9d78' },
    { label: 'z', end: { x: 0, y: 0, z: 3 }, color: '#557ac3' },
  ]

  function updateCharges(next: PointCharge[]) { setCharges(next); setSelectedScenario('custom') }
  function loadScenario(value: string) {
    setSelectedScenario(value)
    setCharges(value === 'empty' ? [] : scenarios[Number(value)].charges.map((charge) => ({ ...charge })))
    setNextId(value === 'empty' ? 1 : Math.max(...scenarios[Number(value)].charges.map((charge) => charge.id)) + 1)
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    if (dragging === null) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const point = { x: (event.clientX - bounds.left) / bounds.width * WIDTH, y: (event.clientY - bounds.top) / bounds.height * HEIGHT }
    if (dragging === 'orbit' || dragging === 'pan' || dragging === 'depth') {
      const previous = pointerPosition.current
      if (previous) {
        const dx = point.x - previous.x, dy = point.y - previous.y
        if (dragging === 'orbit') setCamera((current) => ({ ...current, yaw: current.yaw + dx * .009, pitch: Math.max(-1.5, Math.min(1.5, current.pitch + dy * .009)) }))
        else if (dragging === 'depth') setCamera((current) => ({ ...current, target: { ...current.target, z: current.target.z + dy / (20 * current.zoom) } }))
        else setCamera((current) => {
          const horizontal = -dx / (20 * current.zoom)
          const vertical = dy / (20 * current.zoom * Math.cos(current.pitch))
          const cosYaw = Math.cos(current.yaw), sinYaw = Math.sin(current.yaw)
          return { ...current, target: { ...current.target, x: current.target.x + cosYaw * horizontal + sinYaw * vertical, y: current.target.y - sinYaw * horizontal + cosYaw * vertical } }
        })
      }
      pointerPosition.current = point
      return
    }
    if (dragging === 'probe') {
      for (const charge of charges) {
        const position = project(charge)
        const dx = point.x - position.x; const dy = point.y - position.y; const distance = Math.hypot(dx, dy)
        if (distance < 20) { const angle = distance === 0 ? 0 : Math.atan2(dy, dx); point.x = position.x + Math.cos(angle) * 20; point.y = position.y + Math.sin(angle) * 20 }
      }
    }
    if (dragging === 'probe') { setProbe(threeD ? unprojectAtZ(point, camera, probe.z) : unproject2D(point, camera)); return }
    const selectedCharge = charges.find((charge) => charge.id === dragging)
    if (!selectedCharge) return
    const world = threeD ? unprojectAtZ(point, camera, selectedCharge.z) : unproject2D(point, camera)
    updateCharges(charges.map((charge) => charge.id === dragging ? { ...charge, x: world.x, y: world.y } : charge))
  }

  function startNavigation(event: PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest('.charge-handle,.probe-handle')) return
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    pointerPosition.current = { x: (event.clientX - bounds.left) / bounds.width * WIDTH, y: (event.clientY - bounds.top) / bounds.height * HEIGHT }
    setDragging(threeD && event.altKey ? 'depth' : threeD && !event.shiftKey ? 'orbit' : 'pan')
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function zoomScene(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    setCamera((current) => ({ ...current, zoom: Math.max(.08, Math.min(8, current.zoom * Math.exp(-event.deltaY * .0015))) }))
  }

  function finishPointer() { setDragging(null); pointerPosition.current = null }

  function addCharge() {
    if (charges.length >= 10) return
    updateCharges([...charges, { id: nextId, x: ((charges.length % 5) - 2) * 2.5, y: Math.floor(charges.length / 5) * 3, z: 0, chargeCoulombs: 1e-6 }])
    setNextId(nextId + 1)
  }

  function centerOnCharges() {
    if (!charges.length) { setCamera((current) => ({ ...current, target: { x: 0, y: 0, z: 0 } })); return }
    const target = charges.reduce((sum, charge) => ({ x: sum.x + charge.x / charges.length, y: sum.y + charge.y / charges.length, z: sum.z + charge.z / charges.length }), { x: 0, y: 0, z: 0 })
    setCamera((current) => ({ ...current, target }))
  }

  function changeZoom(factor: number) { setCamera((current) => ({ ...current, zoom: Math.max(.08, Math.min(8, current.zoom * factor)) })) }

  function reset() { setCharges([]); setSelectedScenario('empty'); setProbe({ x: 0, y: 3.2, z: 0 }); setNextId(1); setCamera({ yaw: -.45, pitch: .35, zoom: .82, target: { x: 0, y: 0, z: 0 } }) }

  return <div className="electric-lab">
    <nav className="module-tools-nav" aria-label="Herramientas de electrostática">{[
      { id: 'viewer' as const, title: 'Visualizador de cargas y potencial' }, { id: 'trajectory' as const, title: 'Simulador de trayectoria' },
    ].map((item) => <button key={item.id} className={activeTool === item.id ? 'active' : ''} onClick={() => setActiveTool(item.id)}>{item.title}</button>)}</nav>
    {activeTool === 'trajectory' ? <TrajectorySimulator charges={charges} /> : <>
    <div className="electric-toolbar">
      <label className="scenario-picker"><span>ESCENARIO</span><select value={selectedScenario} onChange={(event) => loadScenario(event.target.value)}><option value="empty">Escenario vacío</option>{scenarios.map((scenario, index) => <option value={index} key={scenario.name}>{scenario.name}</option>)}{selectedScenario === 'custom' && <option value="custom" disabled>Personalizado</option>}</select></label>
      <div className="viewer-actions"><div className="dimension-switch"><button className={!threeD ? 'active' : ''} onClick={() => { setThreeD(false); setProbe((current) => ({ ...current, z: 0 })); if (charges.some((charge) => charge.z !== 0)) updateCharges(charges.map((charge) => ({ ...charge, z: 0 }))) }}>2D</button><button className={threeD ? 'active' : ''} onClick={() => setThreeD(true)}>3D</button></div><div className="zoom-actions"><button aria-label="Alejar vista" title="Alejar vista" onClick={() => changeZoom(.65)}><Minus size={13} /></button><button aria-label="Acercar vista" title="Acercar vista" onClick={() => changeZoom(1.5)}><Plus size={13} /></button></div><button className="center-view-button" onClick={centerOnCharges}>Centrar cargas</button><button className="reset-button" onClick={reset}><RotateCcw size={14} />Reiniciar</button></div>
    </div>
    <div className="electric-workspace"><div className="electric-visual"><div className={`electric-canvas-wrap ${threeD ? 'navigable-3d' : ''}`}><svg className="electric-canvas" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={threeD ? 'Visualizador 3D interactivo de cargas, campo y potencial' : 'Visualizador 2D interactivo de cargas, campo y potencial'} onPointerDown={startNavigation} onPointerMove={move} onPointerUp={finishPointer} onPointerCancel={finishPointer} onWheel={zoomScene}>
      <defs><pattern id="electricGrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#e5eaf1" strokeWidth=".7" /><circle cx="0" cy="0" r="1" fill="#d4dce7" /></pattern><marker id="fieldArrow" markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#5c82c5" /></marker></defs>
      <rect width={WIDTH} height={HEIGHT} fill={threeD ? '#fbfcfe' : 'url(#electricGrid)'} />
      {!threeD && (() => { const origin = project({ x: 0, y: 0, z: 0 }); return <path d={`M${origin.x} 0V${HEIGHT}M0 ${origin.y}H${WIDTH}`} stroke="#d4dae4" strokeWidth="1" /> })()}
      {threeD && spatialAxes.map(({ label, end, color }) => { const origin = project({ x: 0, y: 0, z: 0 }), tip = project(end); return <g key={`axis-${label}`}><line x1={origin.x} y1={origin.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth="1.7" /><text x={tip.x + 4} y={tip.y - 4} fill={color} fontSize="11" fontWeight="700">{label}</text></g> })}
      {threeD && showPotential && surfacesInView.map(({ level, vertices }, index) => { const points = vertices.map(project).map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '); return <polygon key={`surface-${index}`} points={points} fill={level > 0 ? '#e5a46e' : '#6e91d1'} fillOpacity=".08" stroke={level > 0 ? '#d99059' : '#6486c3'} strokeOpacity=".14" strokeWidth=".65" /> })}
      {showPotential && !threeD && equipotentials.map(({ level, d }) => <path key={level} d={d} fill="none" stroke={level > 0 ? '#e5a46e' : '#6e91d1'} strokeWidth="1.2" opacity=".68" />)}
      {showField && fieldPaths.map((line, index) => <path key={`line-${index}`} d={line.map((point, pointIndex) => { const projected = project(point); return `${pointIndex ? 'L' : 'M'}${projected.x.toFixed(1)},${projected.y.toFixed(1)}` }).join(' ')} fill="none" stroke="#5f84c5" strokeWidth={threeD ? '.9' : '1.25'} opacity={threeD ? '.36' : '.58'} markerEnd="url(#fieldArrow)" />)}
      {showField && (threeD ? [-1, -.5, 0, .5, 1].map((slice) => camera.target.z + slice * HEIGHT / (40 * camera.zoom)) : [0]).flatMap((z) => Array.from({ length: 11 }, (_, row) => Array.from({ length: 17 }, (_, col) => {
        const point = { x: 18 + col * 35, y: 15 + row * 33 }
        const world = threeD ? unprojectAtZ(point, camera, z) : unproject2D(point, camera)
        if (charges.some((charge) => Math.hypot(world.x - charge.x, world.y - charge.y, world.z - charge.z) < 1.25)) return null
        const vector = fieldAt(world, charges); const norm = Math.hypot(vector.x, vector.y, vector.z)
        if (norm < 1e-8) return null
        const start = project(world)
        const tip = project({ x: world.x + vector.x / norm * .35, y: world.y + vector.y / norm * .35, z: world.z + vector.z / norm * .35 })
        const intensity = Math.min(1, Math.max(.28, Math.log10(norm + 1) / 8))
        return <line key={`${z}-${row}-${col}`} x1={start.x} y1={start.y} x2={tip.x} y2={tip.y} stroke="#527ab9" strokeWidth={threeD ? '.85' : '1.15'} opacity={threeD ? intensity * .55 : intensity * .82} markerEnd="url(#fieldArrow)" />
      }))) }
      {charges.map((charge) => { const point = project(charge); const positive = charge.chargeCoulombs > 0; const color = positive ? '#547cda' : '#d47777'; return <g key={charge.id} transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => { event.stopPropagation(); setDragging(charge.id); event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId) }} className="charge-handle" role="button" aria-label={`Mover carga ${positive ? 'positiva' : 'negativa'}`}><circle r="28" fill="none" stroke={color} strokeWidth="1" opacity=".1" /><circle r="22" fill="none" stroke={color} strokeWidth="1.4" opacity=".17" /><circle r="16" fill={color} opacity=".16" /><circle r="12" fill={color} stroke="white" strokeWidth="1.4" /><text y="4" textAnchor="middle" fill="white" fontSize="15" fontWeight="700">{positive ? '+' : '−'}</text><text y="34" textAnchor="middle" fill="#40516b" fontSize="8" fontWeight="600">{scientific(charge.chargeCoulombs)} C{threeD ? ` · z ${charge.z.toFixed(1)}` : ''}</text></g> })}
      {(() => { const point = project(probeWorld); return <g transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => { event.stopPropagation(); setDragging('probe'); event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId) }} className="probe-handle" role="button" aria-label="Mover punto de prueba"><circle r="11" fill="#273b5d" stroke="white" strokeWidth="3" /><path d="M-17 0H17M0-17V17" stroke="#273b5d" strokeWidth="1" /><text x="14" y="-13" fill="#273b5d" fontSize="10" fontWeight="700">P</text></g> })()}
    </svg><div className="canvas-axis-label">x (cm) <span>y (cm)</span>{threeD && <span>z (cm)</span>}</div><div className="orbit-hint">{threeD ? 'Arrastra para rotar · Shift + arrastra para desplazar · Alt + arrastra para mover en z · rueda para zoom' : 'Arrastra para desplazarte · rueda o controles +/− para cambiar la escala'}</div></div><div className="visual-caption">{threeD ? 'Espacio 3D libre: rota, desplaza y cambia la profundidad del encuadre.' : 'Plano 2D sin límites: desplázate y aleja la vista para explorar más espacio.'}</div>
    <div className="electric-options"><button className={showField ? 'toggle-on' : ''} onClick={() => setShowField(!showField)}><i className="field-key" />Dirección del campo</button><button className={showPotential ? 'toggle-on' : ''} onClick={() => setShowPotential(!showPotential)}><i className="potential-key" />Equipotenciales</button><button onClick={addCharge} disabled={charges.length >= 10}><Plus size={14} />Agregar carga</button>{charges.length > 0 && <button onClick={() => updateCharges(charges.slice(0, -1))}><Trash2 size={13} />Quitar carga</button>}</div></div>
    <aside className="electric-control-panel"><div className="charge-panel-heading">CARGAS FUENTE <span>{charges.length}/10</span></div>{charges.length ? <div className="charge-editors">{charges.map((charge) => { const parts = chargeParts(charge.chargeCoulombs); return <div key={charge.id} className="charge-editor"><span className={`charge-editor-dot ${charge.chargeCoulombs < 0 ? 'negative' : ''}`} />Carga {charge.id}<select aria-label={`Signo de carga ${charge.id}`} value={charge.chargeCoulombs < 0 ? -1 : 1} onChange={(event) => updateCharges(charges.map((item) => item.id === charge.id ? { ...item, chargeCoulombs: Math.abs(item.chargeCoulombs) * Number(event.target.value) } : item))}><option value={1}>+</option><option value={-1}>−</option></select><NumericInput aria-label={`Magnitud de carga ${charge.id}`} min={1} max={999} step={1} value={Number(parts.mantissa.toPrecision(4))} onValueChange={(value) => updateCharges(charges.map((item) => item.id === charge.id ? { ...item, chargeCoulombs: Math.sign(item.chargeCoulombs) * value * 10 ** parts.exponent } : item))} /><select aria-label={`Prefijo de carga ${charge.id}`} value={parts.exponent} onChange={(event) => { const exponent = Number(event.target.value); updateCharges(charges.map((item) => item.id === charge.id ? { ...item, chargeCoulombs: Math.sign(item.chargeCoulombs) * parts.mantissa * 10 ** exponent } : item)) }}>{chargePrefixes.map((prefix) => <option key={prefix.exponent} value={prefix.exponent}>{prefix.label}</option>)}</select><div className={`charge-position-fields ${threeD ? 'three-d' : ''}`}>{(['x', 'y'] as const).map((axis) => <label key={axis}>{axis}<NumericInput step={0.1} value={charge[axis]} onValueChange={(value) => updateCharges(charges.map((item) => item.id === charge.id ? { ...item, [axis]: value } : item))} /></label>)}{threeD && <label>z<NumericInput step={0.1} value={charge.z} onValueChange={(z) => updateCharges(charges.map((item) => item.id === charge.id ? { ...item, z } : item))} /></label>}</div></div> })}</div> : <p className="empty-charge-note">Sin cargas</p>}
      <div className="probe-editor"><div className="charge-panel-heading"><span>PUNTO P · cm</span><button className="inline-view-button" onClick={() => setCamera((current) => ({ ...current, target: { x: probe.x, y: probe.y, z: probe.z } }))}>Centrar</button></div><div className="probe-coordinate-inputs">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}>{axis.toUpperCase()}<NumericInput step={0.1} value={probe[axis]} disabled={!threeD && axis === 'z'} onValueChange={(value) => setProbe((current) => ({ ...current, [axis]: value }))} aria-label={`Coordenada ${axis} del punto P en centímetros`} /></label>)}</div></div>
      <div className="probe-results"><div className="probe-results-heading">RESULTADOS EN P</div><div className="probe-result-item"><span>Campo eléctrico |E⃗|</span><strong>{probeAtSource ? 'Indefinido' : <>{scientific(magnitude)} <small>N/C</small></>}</strong>{!probeAtSource && <span className="vector-result">Eₓ {scientific(field.x)} · Eᵧ {scientific(field.y)} · E_z {scientific(field.z)} N/C</span>}</div><div className="probe-result-item"><span>Potencial eléctrico</span><strong>{probeAtSource ? 'Indefinido' : <>{scientific(potential)} <small>V</small></>}</strong></div><div className="probe-result-item"><span>Ubicación de P (x, y, z)</span><strong>({scientific(probeWorld.x / 100)}; {scientific(probeWorld.y / 100)}; {scientific(probeWorld.z / 100)}) <small>m</small></strong></div></div>
      <div className="physics-note">El campo es vectorial y el potencial es escalar. Se aplica superposición para cargas puntuales; ambos resultados son indefinidos exactamente sobre una carga fuente.</div>
    </aside></div>
    </>}
  </div>
}
