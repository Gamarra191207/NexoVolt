import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react'
import { ArrowRight, CircleDot, Compass, Pause, Play, RotateCcw, Zap } from 'lucide-react'
import { crossedFieldDrift, cyclotronPeriod, simulateLorentzTrajectory, type Vector2 } from '../physics/magnetism'
import NumericInput from './NumericInput'
import './magnetic-lab.css'

type Tool = 'field' | 'lorentz'
type Source = 'magnet' | 'electromagnet' | 'wire' | 'loop'
type DragTarget = 'probe' | 'source' | 'viewport' | null

const fieldSourceCopy: Record<Source, { title: string; subtitle: string }> = {
  magnet: { title: 'Imán de barra', subtitle: 'Las líneas salen del norte y regresan al sur.' },
  electromagnet: { title: 'Electroimán', subtitle: 'La corriente en la bobina magnetiza el núcleo de hierro.' },
  wire: { title: 'Conductor recto', subtitle: 'El campo rodea a la corriente según la mano derecha.' },
  loop: { title: 'Espira de corriente', subtitle: 'La espira concentra el campo a lo largo de su eje.' },
}

function localMagneticVector(source: Source, point: Vector2, sourcePosition: Vector2, reversed: boolean): Vector2 {
  const dx = point.x - sourcePosition.x, dy = point.y - sourcePosition.y
  const radius = Math.max(38, Math.hypot(dx, dy))
  const direction = reversed ? -1 : 1
  if (source === 'wire') return { x: direction * dy / radius, y: -direction * dx / radius }
  const moment = source === 'magnet' || source === 'electromagnet' ? -direction : direction
  const dot = moment * dx
  const scale = radius ** 5
  return { x: (3 * dot * dx - moment * radius ** 2) / scale, y: 3 * dot * dy / scale }
}

function relativeMagneticStrength(source: Source, strength: number, point: Vector2, sourcePosition: Vector2) {
  const distance = Math.max(52, Math.hypot(point.x - sourcePosition.x, point.y - sourcePosition.y))
  const sourceGain = source === 'electromagnet' ? 1.65 : source === 'wire' ? .78 : source === 'loop' ? 1.12 : 1
  return Math.min(100, Math.max(2, 6500 * strength * sourceGain / distance ** 1.45))
}

function FieldScene({ source, strength, reversed }: { source: Source; strength: number; reversed: boolean }) {
  const [probe, setProbe] = useState<Vector2>({ x: 554, y: 72 })
  const [sourcePosition, setSourcePosition] = useState<Vector2>({ x: 340, y: 180 })
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })
  const dragTarget = useRef<DragTarget>(null)
  const dragOffset = useRef<Vector2>({ x: 0, y: 0 })
  const panOrigin = useRef({ pointer: { x: 0, y: 0 }, position: { x: 0, y: 0 } })
  const dragMoved = useRef(false)
  const draggableSource = source === 'magnet' || source === 'electromagnet'
  const direction = reversed ? -1 : 1
  const opacity = .35 + strength * .055
  const probeField = localMagneticVector(source, probe, sourcePosition, reversed)
  const probeAngle = Math.atan2(probeField.y, probeField.x) * 180 / Math.PI
  const relativeField = relativeMagneticStrength(source, strength, probe, sourcePosition)
  const sourceDistance = Math.hypot(probe.x - sourcePosition.x, probe.y - sourcePosition.y)
  const influenceLabel = relativeField > 66 ? 'Alta' : relativeField > 32 ? 'Media' : 'Baja'
  const fieldSamples = useMemo(() => Array.from({ length: 8 }, (_, row) => Array.from({ length: 14 }, (_, column) => {
    const point = { x: 34 + column * 47, y: 38 + row * 40 }
    const vector = localMagneticVector(source, point, sourcePosition, reversed)
    const angle = Math.atan2(vector.y, vector.x) * 180 / Math.PI
    const influence = relativeMagneticStrength(source, strength, point, sourcePosition)
    return { ...point, angle, influence }
  })).flat(), [reversed, source, sourcePosition, strength])

  useEffect(() => { setSourcePosition({ x: 340, y: 180 }) }, [source])

  function svgPoint(clientX: number, clientY: number, svg: SVGSVGElement): Vector2 {
    const bounds = svg.getBoundingClientRect()
    return { x: (clientX - bounds.left) / bounds.width * 680, y: (clientY - bounds.top) / bounds.height * 360 }
  }
  function rawEventPoint(event: PointerEvent<SVGSVGElement>): Vector2 {
    return svgPoint(event.clientX, event.clientY, event.currentTarget)
  }
  function eventPoint(event: PointerEvent<SVGSVGElement>): Vector2 {
    const raw = rawEventPoint(event)
    return { x: (raw.x - viewport.x) / viewport.zoom, y: (raw.y - viewport.y) / viewport.zoom }
  }
  function updateDraggedItem(event: PointerEvent<SVGSVGElement>) {
    if (dragTarget.current === 'viewport') {
      const raw = rawEventPoint(event)
      const dx = raw.x - panOrigin.current.pointer.x, dy = raw.y - panOrigin.current.pointer.y
      if (Math.hypot(dx, dy) > 2) dragMoved.current = true
      setViewport((current) => ({ ...current, x: panOrigin.current.position.x + dx, y: panOrigin.current.position.y + dy }))
      return
    }
    const pointer = eventPoint(event)
    const next = { x: pointer.x + dragOffset.current.x, y: pointer.y + dragOffset.current.y }
    if (dragTarget.current === 'source' && draggableSource) {
      setSourcePosition({ x: Math.max(105, Math.min(575, next.x)), y: Math.max(70, Math.min(290, next.y)) })
      return
    }
    if (dragTarget.current !== 'probe' || Math.hypot(next.x - sourcePosition.x, next.y - sourcePosition.y) < 58) return
    setProbe({ x: Math.max(28, Math.min(652, next.x)), y: Math.max(28, Math.min(318, next.y)) })
  }
  function beginDrag(event: PointerEvent<SVGSVGElement>) {
    const requestedTarget = (event.target as Element).closest('[data-drag-target]')?.getAttribute('data-drag-target')
    dragTarget.current = requestedTarget === 'source' && draggableSource ? 'source' : requestedTarget === 'probe' ? 'probe' : 'viewport'
    dragMoved.current = false
    const rawPointer = rawEventPoint(event)
    panOrigin.current = { pointer: rawPointer, position: { x: viewport.x, y: viewport.y } }
    const pointer = eventPoint(event)
    dragOffset.current = requestedTarget === 'source' && draggableSource
      ? { x: sourcePosition.x - pointer.x, y: sourcePosition.y - pointer.y }
      : requestedTarget === 'probe'
        ? { x: probe.x - pointer.x, y: probe.y - pointer.y }
        : { x: 0, y: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (dragTarget.current !== 'viewport') updateDraggedItem(event)
  }
  function moveDraggedItem(event: PointerEvent<SVGSVGElement>) {
    if (dragTarget.current) updateDraggedItem(event)
  }
  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (dragTarget.current === 'viewport' && !dragMoved.current) {
      const next = eventPoint(event)
      if (Math.hypot(next.x - sourcePosition.x, next.y - sourcePosition.y) >= 48) setProbe({ x: Math.max(28, Math.min(652, next.x)), y: Math.max(28, Math.min(318, next.y)) })
    }
    dragTarget.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function changeZoom(nextZoom: number, anchor = { x: 340, y: 180 }) {
    setViewport((current) => {
      const zoom = Math.max(.5, Math.min(4, nextZoom))
      const worldAtAnchor = { x: (anchor.x - current.x) / current.zoom, y: (anchor.y - current.y) / current.zoom }
      return { zoom, x: anchor.x - worldAtAnchor.x * zoom, y: anchor.y - worldAtAnchor.y * zoom }
    })
  }
  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    const anchor = svgPoint(event.clientX, event.clientY, event.currentTarget)
    changeZoom(viewport.zoom * (event.deltaY < 0 ? 1.16 : .86), anchor)
  }
  function moveWithKeyboard(target: 'probe' | 'source', event: KeyboardEvent<SVGGElement>) {
    const movement: Record<string, Vector2> = {
      ArrowLeft: { x: -12, y: 0 }, ArrowRight: { x: 12, y: 0 }, ArrowUp: { x: 0, y: -12 }, ArrowDown: { x: 0, y: 12 },
    }
    const delta = movement[event.key]
    if (!delta) return
    event.preventDefault()
    if (target === 'source') setSourcePosition((current) => ({ x: Math.max(105, Math.min(575, current.x + delta.x)), y: Math.max(70, Math.min(290, current.y + delta.y)) }))
    else setProbe((current) => ({ x: Math.max(28, Math.min(652, current.x + delta.x)), y: Math.max(28, Math.min(318, current.y + delta.y)) }))
  }
  return <div className="magnetic-scene" style={{ '--field-opacity': opacity } as CSSProperties}>
    <svg viewBox="0 0 680 360" role="img" aria-label={`Campo de ${fieldSourceCopy[source].title}. Usa la rueda para ampliar, arrastra el fondo para navegar y arrastra los elementos para moverlos.`} onPointerDown={beginDrag} onPointerMove={moveDraggedItem} onPointerUp={endDrag} onPointerCancel={endDrag} onWheel={handleWheel}>
      <defs>
        <pattern id="mag-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#dfe8e3" /></pattern>
        <marker id="mag-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d={reversed ? 'M7 0L0 3.5 7 7' : 'M0 0L7 3.5 0 7'} fill="none" stroke="currentColor" strokeWidth="1.4" /></marker>
        <linearGradient id="influence-contour" x1="0" y1="0" x2="1" y2="0"><stop stopColor={source === 'electromagnet' ? '#d69545' : '#3e8e73'} stopOpacity=".12" /><stop offset=".5" stopColor={source === 'electromagnet' ? '#e0a85e' : '#58a88c'} stopOpacity=".8" /><stop offset="1" stopColor={source === 'electromagnet' ? '#d69545' : '#3e8e73'} stopOpacity=".12" /></linearGradient>
        <filter id="magnet-shadow" x="-25%" y="-50%" width="150%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#20352d" floodOpacity=".18" /></filter>
      </defs>
      <rect width="680" height="360" className="viewport-backdrop" />
      <g className="scene-world" transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
      <rect width="680" height="360" fill="url(#mag-grid)" className="world-surface" />
      <line x1="340" y1="22" x2="340" y2="338" className="axis-line" />
      <line x1="24" y1="180" x2="656" y2="180" className="axis-line" />
      <g className="field-intensity-contours" transform={`translate(${sourcePosition.x} ${sourcePosition.y})`} aria-label="Curvas de intensidad del campo">{[0, 1, 2, 3].map((level) => source === 'wire' ? <circle key={level} r={38 + level * 27 + strength * 2} style={{ opacity: .5 - level * .08 }} /> : <ellipse key={level} rx={48 + level * 30 + strength * 2.4} ry={28 + level * 17 + strength * 1.2} style={{ opacity: .54 - level * .09 }} />)}</g>
      <g className="field-vector-map" aria-label="Mapa vectorial del campo en tiempo real">{fieldSamples.map((sample, index) => { const length = 8 + sample.influence * .075; return <g key={index} transform={`translate(${sample.x} ${sample.y}) rotate(${sample.angle})`} opacity={.2 + sample.influence / 125}><circle r="1.25" className="vector-origin" /><line x1={-length * .42} y1="0" x2={length * .42} y2="0" /><path d={`M${length * .18} -3L${length * .48} 0 ${length * .18} 3`} /></g> })}</g>
      {(source === 'magnet' || source === 'electromagnet') && <g transform={`translate(${sourcePosition.x - 340} ${sourcePosition.y - 180})`}>
        {[0, 1, 2, 3, 4].map((index) => <path key={`top-${index}`} className="field-path" markerEnd="url(#mag-arrow)" d={`M${296 - index * 6},176 C${250 - index * 19},${112 - index * 19} ${430 + index * 19},${112 - index * 19} ${384 + index * 6},176`} />)}
        {[0, 1, 2, 3, 4].map((index) => <path key={`bottom-${index}`} className="field-path" markerEnd="url(#mag-arrow)" d={`M${296 - index * 6},184 C${250 - index * 19},${248 + index * 19} ${430 + index * 19},${248 + index * 19} ${384 + index * 6},184`} />)}
        {source === 'magnet' ? <g data-drag-target="source" transform={reversed ? 'rotate(180 340 180)' : undefined} className="bar-magnet source-draggable" role="button" tabIndex={0} aria-label="Imán de barra móvil" onKeyDown={(event) => moveWithKeyboard('source', event)} filter="url(#magnet-shadow)"><path d="M299 164h41v32h-41a7 7 0 0 1-7-7v-18a7 7 0 0 1 7-7Z" className="north" /><path d="M340 164h41a7 7 0 0 1 7 7v18a7 7 0 0 1-7 7h-41Z" className="south" /><line x1="340" y1="166" x2="340" y2="194" className="magnet-divider" /><text x="318" y="185" className="pole-letter">N</text><text x="362" y="185" className="pole-letter">S</text><text x="340" y="207" className="magnet-label">ARRASTRA</text></g> : <g data-drag-target="source" transform={reversed ? 'rotate(180 340 180)' : undefined} className="electromagnet source-draggable" role="button" tabIndex={0} aria-label="Electroimán móvil" onKeyDown={(event) => moveWithKeyboard('source', event)}><rect x="286" y="163" width="108" height="34" rx="5" className="iron-core" /><rect x="288" y="166" width="24" height="28" rx="4" className="north" /><rect x="368" y="166" width="24" height="28" rx="4" className="south" />{Array.from({ length: 7 }, (_, index) => <ellipse key={index} cx={316 + index * 8} cy="180" rx="6" ry="26" className="coil-turn" />)}<path d="M310 207v13h60v-13" className="coil-wire" /><circle cx="340" cy="220" r="4" className="current-dot" /><text x="300" y="184">N</text><text x="380" y="184">S</text><text x="340" y="238" className="source-caption">bobina + núcleo</text></g>}
      </g>}
      {source === 'wire' && <>
        {[42, 72, 106, 142].map((radius, index) => <circle key={radius} cx="340" cy="180" r={radius} className="field-path" markerEnd="url(#mag-arrow)" strokeDasharray={index === 3 ? '5 5' : undefined} />)}
        <circle cx="340" cy="180" r="27" className="wire-core" /><circle cx="340" cy="180" r="5" className="current-dot" />
        {reversed && <><line x1="329" y1="169" x2="351" y2="191" className="current-cross" /><line x1="351" y1="169" x2="329" y2="191" className="current-cross" /></>}
        <text x="340" y="224" className="source-caption">I {reversed ? 'entra' : 'sale'} del plano</text>
      </>}
      {source === 'loop' && <>
        {[0, 1, 2, 3].map((index) => <path key={index} className="field-path" markerEnd="url(#mag-arrow)" d={`M${298 - index * 16},${180 - index * 5} C${210 - index * 14},${75 - index * 8} ${470 + index * 14},${75 - index * 8} ${382 + index * 16},${180 - index * 5}`} />)}
        {[0, 1, 2, 3].map((index) => <path key={`l-${index}`} className="field-path" markerEnd="url(#mag-arrow)" d={`M${298 - index * 16},${180 + index * 5} C${210 - index * 14},${285 + index * 8} ${470 + index * 14},${285 + index * 8} ${382 + index * 16},${180 + index * 5}`} />)}
        <ellipse cx="340" cy="180" rx="54" ry="115" className="current-loop" />
        <path d={direction > 0 ? 'M326 72l14-9 14 9' : 'M326 288l14 9 14-9'} className="loop-arrow" />
        <text x="340" y="326" className="source-caption">Corriente {reversed ? 'horaria' : 'antihoraria'}</text>
      </>}
      <g data-drag-target="probe" className="compass-probe movable" transform={`translate(${probe.x} ${probe.y})`} role="button" tabIndex={0} aria-label="Brújula magnética móvil" onKeyDown={(event) => moveWithKeyboard('probe', event)}><circle r="25" /><circle r="19" className="compass-inner-ring" /><g transform={`rotate(${probeAngle})`}><path className="compass-north-needle" d="M20 0L-2-6V6Z" /><path className="compass-south-needle" d="M-20 0L2-6V6Z" /></g><circle r="3" className="compass-pivot" /><text y="40">BRÚJULA</text></g>
      </g>
    </svg>
    <div className="scene-navigation" aria-label="Navegación del espacio"><button onClick={() => changeZoom(viewport.zoom / 1.35)} aria-label="Alejar">−</button><output>{Math.round(viewport.zoom * 100)}%</output><button onClick={() => changeZoom(viewport.zoom * 1.35)} aria-label="Acercar">+</button><button className="fit-view" onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}>Centrar</button></div>
    <div className="scene-scale"><span>Influencia en la brújula</span><i><b style={{ width: `${relativeField}%` }} /></i><strong>{influenceLabel} · {relativeField.toFixed(0)}%</strong><small>{sourceDistance.toFixed(0)} px</small></div>
  </div>
}

function Range({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  const range = ((value - min) / (max - min)) * 100
  return <label className="mag-range"><span>{label}<output>{value.toFixed(step < .1 ? 2 : 1)} {unit}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ '--mag-range': `${range}%` } as CSSProperties} /></label>
}

function LorentzScene({ states, frame, electricField, magneticField, charge }: { states: ReturnType<typeof simulateLorentzTrajectory>; frame: number; electricField: Vector2; magneticField: number; charge: number }) {
  const visible = states.slice(0, Math.max(1, frame + 1))
  const trail = visible.slice(-90)
  const allX = states.map((state) => state.position.x), allY = states.map((state) => state.position.y)
  const minX = Math.min(...allX, -1), maxX = Math.max(...allX, 1), minY = Math.min(...allY, -1), maxY = Math.max(...allY, 1)
  const spanX = Math.max(maxX - minX, 2), spanY = Math.max(maxY - minY, 2)
  const scale = Math.min(530 / spanX, 265 / spanY)
  const map = (point: Vector2) => ({ x: 340 + (point.x - (minX + maxX) / 2) * scale, y: 180 - (point.y - (minY + maxY) / 2) * scale })
  const points = visible.map((state) => { const point = map(state.position); return `${point.x.toFixed(1)},${point.y.toFixed(1)}` }).join(' ')
  const current = visible.at(-1) ?? states[0]
  const particle = map(current.position)
  const chargeCoulombs = charge * 1e-6
  const electricForce = { x: chargeCoulombs * electricField.x, y: chargeCoulombs * electricField.y }
  const magneticForce = { x: current.force.x - electricForce.x, y: current.force.y - electricForce.y }
  const totalForceMagnitude = Math.hypot(current.force.x, current.force.y)
  const electricForceMagnitude = Math.hypot(electricForce.x, electricForce.y)
  const magneticForceMagnitude = Math.hypot(magneticForce.x, magneticForce.y)
  const forceScale = 42 / Math.max(totalForceMagnitude * 1e6, electricForceMagnitude * 1e6, magneticForceMagnitude * 1e6, .25)
  const velocityScale = 40 / Math.max(Math.hypot(current.velocity.x, current.velocity.y), .25)
  const vectorEnd = (vector: Vector2, multiplier: number) => ({ x: particle.x + vector.x * multiplier, y: particle.y - vector.y * multiplier })
  const velocityEnd = vectorEnd(current.velocity, velocityScale)
  const electricEnd = vectorEnd(electricForce, forceScale * 1e6)
  const magneticEnd = vectorEnd(magneticForce, forceScale * 1e6)
  const forceEnd = vectorEnd(current.force, forceScale * 1e6)
  const electricDirection = electricField.y >= 0 ? -1 : 1
  const motionDescription = totalForceMagnitude < 1e-9 ? 'Movimiento casi uniforme' : Math.abs(magneticField) < .02 ? 'Aceleración por el campo E' : 'Trayectoria curvada por E y B'
  return <div className="lorentz-scene">
    <svg viewBox="0 0 680 360" role="img" aria-label="Trayectoria de una partícula cargada en campos eléctrico y magnético cruzados">
      <defs><pattern id="lorentz-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#e7ece9" strokeWidth="1" /></pattern><radialGradient id="particleGlow"><stop stopColor={charge >= 0 ? '#ff8c87' : '#7fb4ff'} stopOpacity=".5" /><stop offset="1" stopColor={charge >= 0 ? '#ff8c87' : '#7fb4ff'} stopOpacity="0" /></radialGradient><marker id="vector-arrow-green" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5 0 7Z" fill="#377f69" /></marker><marker id="vector-arrow-blue" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5 0 7Z" fill="#4387c8" /></marker><marker id="vector-arrow-purple" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5 0 7Z" fill="#8b68c7" /></marker><marker id="vector-arrow-orange" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5 0 7Z" fill="#d47d42" /></marker></defs>
      <rect width="680" height="360" fill="url(#lorentz-grid)" />
      <g className="magnetic-field-layer" style={{ opacity: .12 + Math.abs(magneticField) * .22 }}>{Array.from({ length: 7 }, (_, row) => Array.from({ length: 12 }, (_, column) => <g key={`${row}-${column}`} className="b-symbol" transform={`translate(${30 + column * 57} ${48 + row * 43})`}>{magneticField >= 0 ? <><circle r="5" /><circle r="1.6" className="filled" /></> : <><circle r="5" /><line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" /><line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" /></>}</g>))}</g>
      {Math.abs(electricField.y) > .01 && <g className="electric-field-layer" style={{ opacity: .18 + Math.abs(electricField.y) * .16 }}>{Array.from({ length: 5 }, (_, row) => Array.from({ length: 10 }, (_, column) => <line key={`${row}-${column}`} x1={57 + column * 63} y1={76 + row * 55} x2={57 + column * 63} y2={76 + row * 55 + electricDirection * 15} markerEnd="url(#vector-arrow-blue)" />))}</g>}
      <polyline points={points} className="particle-path" />
      <g className="particle-trail">{trail.map((state, index) => { const point = map(state.position); return <circle key={`${state.time}-${index}`} cx={point.x} cy={point.y} r={1.2 + index / trail.length * 2.2} opacity={.06 + index / trail.length * .48} /> })}</g>
      <circle cx={particle.x} cy={particle.y} r="22" fill="url(#particleGlow)" className="particle-glow" /><circle cx={particle.x} cy={particle.y} r="12" className="particle-pulse" /><circle cx={particle.x} cy={particle.y} r="9" className={charge >= 0 ? 'particle-positive' : 'particle-negative'} /><text x={particle.x} y={particle.y + 3.4} className="particle-sign">{charge >= 0 ? '+' : '−'}</text>
      <line x1={particle.x} y1={particle.y} x2={velocityEnd.x} y2={velocityEnd.y} className="velocity-vector" markerEnd="url(#vector-arrow-green)" />
      {electricForceMagnitude > 1e-10 && <><line x1={particle.x} y1={particle.y} x2={electricEnd.x} y2={electricEnd.y} className="electric-force-vector" markerEnd="url(#vector-arrow-blue)" /><text x={electricEnd.x + 5} y={electricEnd.y} className="vector-label electric-label">Fᴱ</text></>}
      {magneticForceMagnitude > 1e-10 && <><line x1={particle.x} y1={particle.y} x2={magneticEnd.x} y2={magneticEnd.y} className="magnetic-force-vector" markerEnd="url(#vector-arrow-purple)" /><text x={magneticEnd.x + 5} y={magneticEnd.y} className="vector-label magnetic-label">Fᴮ</text></>}
      {totalForceMagnitude > 1e-10 && <><line x1={particle.x} y1={particle.y} x2={forceEnd.x} y2={forceEnd.y} className="force-vector" markerEnd="url(#vector-arrow-orange)" /><text x={forceEnd.x + 5} y={forceEnd.y} className="vector-label total-label">F</text></>}
      <text x={velocityEnd.x + 5} y={velocityEnd.y} className="vector-label velocity-label">v</text>
    </svg>
    <div className="lorentz-field-badges"><span className="electric-badge">E {electricField.y >= 0 ? '↑' : '↓'} {Math.abs(electricField.y).toFixed(1)} V/m</span><span className="magnetic-badge">{magneticField >= 0 ? '⊙' : '⊗'} B {Math.abs(magneticField).toFixed(1)} T</span><span className={`charge-badge ${charge >= 0 ? 'positive' : 'negative'}`}>q {charge >= 0 ? 'positiva' : 'negativa'}</span></div>
    <div className="lorentz-legend"><span><i className="velocity-swatch" />v</span><span><i className="electric-force-swatch" />F eléctrica</span><span><i className="magnetic-force-swatch" />F magnética</span><span><i className="force-swatch" />F total</span></div>
    <div className="lorentz-motion-state"><strong>{motionDescription}</strong><span>{magneticField >= 0 ? 'B sale del plano ⊙' : 'B entra al plano ⊗'}</span></div>
  </div>
}

export default function MagneticLab() {
  const [tool, setTool] = useState<Tool>('field')
  const [source, setSource] = useState<Source>('magnet')
  const [strength, setStrength] = useState(5)
  const [reversed, setReversed] = useState(false)
  const [electric, setElectric] = useState(1.2)
  const [magnetic, setMagnetic] = useState(.8)
  const [velocity, setVelocity] = useState(3)
  const [charge, setCharge] = useState(1)
  const [mass, setMass] = useState(1)
  const [duration, setDuration] = useState(10)
  const [playing, setPlaying] = useState(false)
  const [frame, setFrame] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const parameters = useMemo(() => ({
    chargeCoulombs: charge * 1e-6, massKg: mass * 1e-6,
    electricField: { x: 0, y: electric }, magneticFieldTesla: magnetic,
    initialPosition: { x: 0, y: 0 }, initialVelocity: { x: velocity, y: 0 },
    durationSeconds: duration, steps: 650,
  }), [charge, duration, electric, magnetic, mass, velocity])
  const states = useMemo(() => simulateLorentzTrajectory(parameters), [parameters])
  const current = states[Math.min(frame, states.length - 1)] ?? states[0]
  const drift = crossedFieldDrift(parameters.electricField, magnetic)
  const period = cyclotronPeriod(parameters.massKg, parameters.chargeCoulombs, magnetic)
  const electricForceNow = { x: parameters.chargeCoulombs * parameters.electricField.x, y: parameters.chargeCoulombs * parameters.electricField.y }
  const magneticForceNow = { x: current.force.x - electricForceNow.x, y: current.force.y - electricForceNow.y }

  useEffect(() => { setFrame(0); setPlaying(false) }, [parameters])
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setFrame((previous) => {
      const next = previous + Math.max(1, Math.round(5 * playbackSpeed))
      if (next >= states.length - 1) { setPlaying(false); return states.length - 1 }
      return next
    }), 30)
    return () => window.clearInterval(timer)
  }, [playbackSpeed, playing, states.length])

  const resetLorentz = () => { setElectric(1.2); setMagnetic(.8); setVelocity(3); setCharge(1); setMass(1); setDuration(10); setFrame(0); setPlaying(false) }
  const applyLorentzPreset = (preset: 'circular' | 'crossed' | 'selector' | 'negative') => {
    if (preset === 'circular') { setElectric(0); setMagnetic(1); setVelocity(3); setCharge(1); setMass(1); setDuration(10) }
    if (preset === 'crossed') { setElectric(1.2); setMagnetic(.8); setVelocity(3); setCharge(1); setMass(1); setDuration(10) }
    if (preset === 'selector') { setElectric(1.2); setMagnetic(.8); setVelocity(1.5); setCharge(1); setMass(1); setDuration(10) }
    if (preset === 'negative') { setElectric(1.2); setMagnetic(.8); setVelocity(3); setCharge(-1); setMass(1); setDuration(10) }
    setFrame(0); setPlaying(false)
  }

  return <div className="magnetic-lab">
    <nav className="magnetic-tools" aria-label="Herramientas del módulo">
      <button className={tool === 'field' ? 'active' : ''} onClick={() => setTool('field')}><Compass size={14} />Campo magnético</button>
      <button className={tool === 'lorentz' ? 'active' : ''} onClick={() => setTool('lorentz')}><Zap size={14} />Fuerza de Lorentz</button>
    </nav>

    {tool === 'field' ? <div className="magnetic-layout">
      <section className="magnetic-visual"><FieldScene source={source} strength={strength} reversed={reversed} /><div className="magnetic-caption"><span><CircleDot size={12} />Las flechas indican la dirección de B</span><span>Representación cualitativa</span></div></section>
      <aside className="magnetic-panel">
        <div className="mag-panel-heading"><span>FUENTE DEL CAMPO</span><strong>{fieldSourceCopy[source].title}</strong><p>{fieldSourceCopy[source].subtitle}</p></div>
        <div className="source-picker">{(['magnet', 'electromagnet', 'wire', 'loop'] as Source[]).map((item) => <button key={item} className={source === item ? 'selected' : ''} onClick={() => setSource(item)}><i>{item === 'magnet' ? 'N·S' : item === 'electromagnet' ? '⚡▥' : item === 'wire' ? '⊙' : '◯'}</i><span>{fieldSourceCopy[item].title}</span></button>)}</div>
        <Range label={source === 'magnet' ? 'Momento magnético' : source === 'electromagnet' ? 'Corriente de la bobina' : 'Intensidad de corriente'} value={strength} min={1} max={10} step={.5} unit={source === 'magnet' ? '×' : 'A'} onChange={setStrength} />
        <button className="direction-button" onClick={() => setReversed(!reversed)}><RotateCcw size={14} /><span><strong>Invertir dirección</strong><small>{source === 'magnet' ? 'Intercambia los polos N y S' : source === 'electromagnet' ? 'Invierte la corriente y los polos' : 'Cambia el sentido de la corriente'}</small></span><ArrowRight size={13} /></button>
        <div className="field-summary"><Compass size={14} /><span>Intensidad relativa</span><strong>{strength.toFixed(1)}×</strong></div>
      </aside>
    </div> : <div className="lorentz-layout">
      <section className="lorentz-left"><LorentzScene states={states} frame={frame} electricField={parameters.electricField} magneticField={magnetic} charge={charge} />
        <div className="lorentz-playback"><button className="lorentz-play" onClick={() => { if (frame >= states.length - 1) setFrame(0); setPlaying(!playing) }}>{playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}{playing ? 'Pausar' : frame > 0 ? 'Continuar' : 'Iniciar'}</button><button onClick={() => { setFrame(0); setPlaying(false) }}><RotateCcw size={13} />Volver al inicio</button><div className="playback-speed" aria-label="Velocidad de reproducción">{[.5, 1, 2].map((speed) => <button key={speed} className={playbackSpeed === speed ? 'active' : ''} onClick={() => setPlaybackSpeed(speed)}>{speed}×</button>)}</div><div className="timeline"><span>t = {current.time.toFixed(2)} s</span><input type="range" min="0" max={states.length - 1} value={frame} onChange={(event) => { setFrame(Number(event.target.value)); setPlaying(false) }} /></div></div>
      </section>
      <aside className="lorentz-panel">
        <div className="lorentz-panel-title"><div><span>PARÁMETROS</span><strong>Campos E y B cruzados</strong></div><button onClick={resetLorentz} aria-label="Restablecer parámetros"><RotateCcw size={14} /></button></div>
        <div className="lorentz-presets"><span>ESCENARIOS RÁPIDOS</span><div><button onClick={() => applyLorentzPreset('circular')}>Órbita circular</button><button onClick={() => applyLorentzPreset('crossed')}>Campos cruzados</button><button onClick={() => applyLorentzPreset('selector')}>Selector v = E/B</button><button onClick={() => applyLorentzPreset('negative')}>Carga negativa</button></div></div>
        <Range label="Campo eléctrico Eᵧ" value={electric} min={-3} max={3} step={.1} unit="V/m" onChange={setElectric} />
        <Range label="Campo magnético Bᶻ" value={magnetic} min={-2} max={2} step={.1} unit="T" onChange={setMagnetic} />
        <Range label="Velocidad inicial vₓ" value={velocity} min={.5} max={8} step={.1} unit="m/s" onChange={setVelocity} />
        <div className="charge-switch" aria-label="Signo de la carga"><button className={charge > 0 ? 'active positive' : ''} onClick={() => setCharge(Math.max(.5, Math.abs(charge)))}>+ Positiva</button><button className={charge < 0 ? 'active negative' : ''} onClick={() => setCharge(-Math.max(.5, Math.abs(charge)))}>− Negativa</button></div>
        <div className="particle-inputs"><label>Carga q<div><NumericInput min={-5} max={5} step={0.5} value={charge} onValueChange={setCharge} /><span>µC</span></div></label><label>Masa m<div><NumericInput min={0.1} max={10} step={0.1} value={mass} onValueChange={setMass} /><span>mg</span></div></label></div>
        <Range label="Duración" value={duration} min={2} max={20} step={1} unit="s" onChange={setDuration} />
        <div className="lorentz-readouts"><div className="total-reading"><span>|F TOTAL|</span><strong>{(Math.hypot(current.force.x, current.force.y) * 1e6).toFixed(2)} <small>µN</small></strong></div><div><span>|F ELÉCTRICA|</span><strong>{(Math.hypot(electricForceNow.x, electricForceNow.y) * 1e6).toFixed(2)} <small>µN</small></strong></div><div><span>|F MAGNÉTICA|</span><strong>{(Math.hypot(magneticForceNow.x, magneticForceNow.y) * 1e6).toFixed(2)} <small>µN</small></strong></div><div><span>|v| ACTUAL</span><strong>{Math.hypot(current.velocity.x, current.velocity.y).toFixed(2)} <small>m/s</small></strong></div><div><span>DERIVA E×B</span><strong>{Math.hypot(drift.x, drift.y).toFixed(2)} <small>m/s</small></strong></div><div><span>PERIODO</span><strong>{Number.isFinite(period) ? period.toFixed(2) : '∞'} <small>s</small></strong></div></div>
        <div className="lorentz-equation"><span>DESCOMPOSICIÓN DE LA FUERZA</span><strong>F⃗ = F⃗ᴱ + F⃗ᴮ</strong><div><code>F⃗ᴱ = qE⃗</code><code>F⃗ᴮ = q(v⃗ × B⃗)</code></div><p><b>Fᴱ</b> puede cambiar la rapidez. <b>Fᴮ</b> es perpendicular a v y curva la trayectoria.</p></div>
      </aside>
    </div>}
  </div>
}
