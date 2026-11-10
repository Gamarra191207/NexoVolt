import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react'
import {
  Crosshair,
  Gauge,
  Magnet,
  Move,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  crossedFieldDrift,
  cyclotronPeriod,
  simulateLorentzTrajectory,
  type Vector2,
} from '../physics/magnetism'
import NumericInput from './NumericInput'
import ExperimentNav from './ExperimentNav'
import ResultPanel from './ResultPanel'
import './magnetic-lab.css'

type Tool = 'field' | 'lorentz'
type Source = 'magnet' | 'electromagnet'
type DragTarget = 'probe' | 'source' | 'viewport' | null
type Streamline = { path: string; arrows: Array<Vector2 & { angle: number }> }

const FIELD_WIDTH = 760
const FIELD_HEIGHT = 480
const FIELD_WORLD_LIMIT = 10_000
const FIELD_ZOOM_MIN = .2
const FIELD_ZOOM_MAX = 8

const fieldSourceCopy: Record<Source, { title: string; subtitle: string; model: string }> = {
  magnet: {
    title: 'Imán de barra',
    subtitle: 'Mueve el imán y observa cómo el mapa completo se reorganiza.',
    model: 'Polos equivalentes N–S',
  },
  electromagnet: {
    title: 'Electroimán',
    subtitle: 'La corriente de la bobina controla la intensidad del campo.',
    model: 'Núcleo y solenoide',
  },
}

function sourceIcon(source: Source) {
  if (source === 'magnet') return <Magnet size={18} />
  if (source === 'electromagnet') return <Radio size={18} />
  return <Radio size={18} />
}

function poleHalfSeparation(source: Source) {
  return source === 'electromagnet' ? 92 : 86
}

function localMagneticVector(
  source: Source,
  point: Vector2,
  sourcePosition: Vector2,
  reversed: boolean,
): Vector2 {
  const dx = point.x - sourcePosition.x
  const dy = point.y - sourcePosition.y
  const radiusSquared = Math.max(1, dx ** 2 + dy ** 2)
  const radius = Math.sqrt(radiusSquared)
  const direction = reversed ? -1 : 1

  if (source === 'magnet' || source === 'electromagnet') {
    const halfSeparation = poleHalfSeparation(source)
    const softening = source === 'electromagnet' ? 20 : 17
    const leftDx = dx + halfSeparation
    const rightDx = dx - halfSeparation
    const leftScale = (leftDx ** 2 + dy ** 2 + softening ** 2) ** 1.5
    const rightScale = (rightDx ** 2 + dy ** 2 + softening ** 2) ** 1.5
    // En la orientación normal N está a la izquierda y S a la derecha.
    return {
      x: direction * (leftDx / leftScale - rightDx / rightScale),
      y: direction * (dy / leftScale - dy / rightScale),
    }
  }

  // La espira se representa por su dipolo equivalente, con eje horizontal.
  const moment = direction
  const dot = moment * dx
  const scale = radius ** 5
  return {
    x: (3 * dot * dx - moment * radius ** 2) / scale,
    y: 3 * dot * dy / scale,
  }
}

function relativeMagneticStrength(
  source: Source,
  strength: number,
  point: Vector2,
  sourcePosition: Vector2,
) {
  const model = source === 'electromagnet'
      ? { referenceRadius: 145 }
      : { referenceRadius: 120 }
  const excitationScale = .65 + .55 * Math.sqrt(Math.max(.1, strength) / 5)
  const influenceRadius = model.referenceRadius * excitationScale
  const vector = localMagneticVector(source, point, sourcePosition, false)
  const vectorMagnitude = Math.hypot(vector.x, vector.y)
  const relativeMagnitude = vectorMagnitude * influenceRadius ** 3 / (2 * poleHalfSeparation(source))
  if (!Number.isFinite(relativeMagnitude)) return 100
  // Compresión suave: conserva la caída física sin saturar la lectura cerca de la fuente.
  return 100 * relativeMagnitude / (1 + relativeMagnitude)
}

function integrateFieldLine(
  source: Source,
  seed: Vector2,
  sourcePosition: Vector2,
  reversed: boolean,
  stepDirection: 1 | -1,
) {
  const points: Vector2[] = []
  let current = { ...seed }

  for (let index = 0; index < 150; index += 1) {
    const vector = localMagneticVector(source, current, sourcePosition, reversed)
    const magnitude = Math.hypot(vector.x, vector.y)
    if (!Number.isFinite(magnitude) || magnitude < 1e-12) break

    const step = (4.6 + Math.min(2.4, index * .025)) * stepDirection
    current = {
      x: current.x + vector.x / magnitude * step,
      y: current.y + vector.y / magnitude * step,
    }
    if (Math.abs(current.x) > FIELD_WORLD_LIMIT || Math.abs(current.y) > FIELD_WORLD_LIMIT) break
    points.push(current)

    if (source === 'magnet' || source === 'electromagnet') {
      const halfSeparation = poleHalfSeparation(source)
      const leftPoleDistance = Math.hypot(current.x - (sourcePosition.x - halfSeparation), current.y - sourcePosition.y)
      const rightPoleDistance = Math.hypot(current.x - (sourcePosition.x + halfSeparation), current.y - sourcePosition.y)
      if (index > 2 && Math.min(leftPoleDistance, rightPoleDistance) < 12) break
    }

    if (index > 32 && Math.hypot(current.x - seed.x, current.y - seed.y) < 7) break
  }
  return points
}

function createStreamline(
  source: Source,
  seed: Vector2,
  sourcePosition: Vector2,
  reversed: boolean,
): Streamline | null {
  const backward = integrateFieldLine(source, seed, sourcePosition, reversed, -1).reverse()
  const forward = integrateFieldLine(source, seed, sourcePosition, reversed, 1)
  const points = [...backward, seed, ...forward]
  if (points.length < 4) return null
  const arrows = [.34, .66].map((fraction) => {
    const index = Math.min(points.length - 2, Math.max(0, Math.round((points.length - 1) * fraction)))
    const point = points[index]
    const next = points[index + 1]
    return { ...point, angle: Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI }
  })
  return {
    path: points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '),
    arrows,
  }
}

function createReferencePoleStreamlines(
  source: 'magnet' | 'electromagnet',
  sourcePosition: Vector2,
  reversed: boolean,
): Streamline[] {
  const halfSeparation = poleHalfSeparation(source)
  const northSign = reversed ? 1 : -1
  const northX = sourcePosition.x + northSign * halfSeparation
  const southX = sourcePosition.x - northSign * halfSeparation
  // Arcos anchos y concéntricos como los de una visualización clásica de
  // limaduras: salen de N, rodean el imán y entran en S. El último se cierra
  // apenas fuera del encuadre para que los laterales formen un abanico suave.
  const profiles = [
    { attach: 31, height: 70, spread: 45 },
    { attach: 25, height: 105, spread: 80 },
    { attach: 19, height: 145, spread: 125 },
    { attach: 13, height: 195, spread: 180 },
    { attach: 7, height: 255, spread: 245 },
    { attach: 1, height: 330, spread: 320 },
  ]

  const cubicArrow = (start: Vector2, controlA: Vector2, controlB: Vector2, end: Vector2, t: number) => {
    const oneMinusT = 1 - t
    const point = {
      x: oneMinusT ** 3 * start.x + 3 * oneMinusT ** 2 * t * controlA.x + 3 * oneMinusT * t ** 2 * controlB.x + t ** 3 * end.x,
      y: oneMinusT ** 3 * start.y + 3 * oneMinusT ** 2 * t * controlA.y + 3 * oneMinusT * t ** 2 * controlB.y + t ** 3 * end.y,
    }
    const tangent = {
      x: 3 * oneMinusT ** 2 * (controlA.x - start.x) + 6 * oneMinusT * t * (controlB.x - controlA.x) + 3 * t ** 2 * (end.x - controlB.x),
      y: 3 * oneMinusT ** 2 * (controlA.y - start.y) + 6 * oneMinusT * t * (controlB.y - controlA.y) + 3 * t ** 2 * (end.y - controlB.y),
    }
    return { ...point, angle: Math.atan2(tangent.y, tangent.x) * 180 / Math.PI }
  }

  return profiles.flatMap(({ attach, height, spread }, profileIndex) => ([-1, 1] as const).map((verticalSign) => {
    const endpointY = sourcePosition.y + verticalSign * attach
    const controlY = sourcePosition.y + verticalSign * height
    const start = { x: northX, y: endpointY }
    const firstControl = { x: northX + northSign * spread, y: controlY }
    const lastControl = { x: southX - northSign * spread, y: controlY }
    const end = { x: southX, y: endpointY }
    const arrows = profileIndex < 4
      ? [cubicArrow(start, firstControl, lastControl, end, .5)]
      : [
          cubicArrow(start, firstControl, lastControl, end, .22),
          cubicArrow(start, firstControl, lastControl, end, .78),
        ]
    return {
      path: [
        `M${northX.toFixed(1)} ${endpointY.toFixed(1)}`,
        `C${firstControl.x.toFixed(1)} ${controlY.toFixed(1)} ${lastControl.x.toFixed(1)} ${controlY.toFixed(1)} ${southX.toFixed(1)} ${endpointY.toFixed(1)}`,
      ].join(' '),
      arrows,
    }
  }))
}

function Range({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}) {
  const range = ((value - min) / (max - min)) * 100
  return <label className="mag-range">
    <span>{label}<output>{value.toFixed(step < .1 ? 2 : 1)} {unit}</output></span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      style={{ '--mag-range': `${range}%` } as CSSProperties}
    />
  </label>
}

function FieldScene({ source, strength, reversed }: { source: Source; strength: number; reversed: boolean }) {
  const [probe, setProbe] = useState<Vector2>({ x: 628, y: 100 })
  const [sourcePosition, setSourcePosition] = useState<Vector2>({ x: 380, y: 240 })
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })
  const dragTarget = useRef<DragTarget>(null)
  const dragOffset = useRef<Vector2>({ x: 0, y: 0 })
  const panOrigin = useRef({ pointer: { x: 0, y: 0 }, position: { x: 0, y: 0 } })
  const dragMoved = useRef(false)

  const probeField = localMagneticVector(source, probe, sourcePosition, reversed)
  const probeAngle = Math.atan2(probeField.y, probeField.x) * 180 / Math.PI
  const relativeField = relativeMagneticStrength(source, strength, probe, sourcePosition)
  const sourceDistance = Math.hypot(probe.x - sourcePosition.x, probe.y - sourcePosition.y)
  const influenceLabel = relativeField >= 65
    ? 'zona intensa'
    : relativeField >= 30
      ? 'zona media'
      : relativeField >= 5
        ? 'zona débil'
        : 'zona residual'
  const relativeFieldDisplay = relativeField < 10 ? relativeField.toFixed(1) : relativeField.toFixed(0)

  const visibleWorld = useMemo(() => ({
    left: -viewport.x / viewport.zoom,
    top: -viewport.y / viewport.zoom,
    width: FIELD_WIDTH / viewport.zoom,
    height: FIELD_HEIGHT / viewport.zoom,
  }), [viewport])

  const fieldSamples = useMemo(() => Array.from({ length: 9 }, (_, row) => (
    Array.from({ length: 15 }, (_, column) => {
      const point = {
        x: visibleWorld.left + (column + .5) * visibleWorld.width / 15,
        y: visibleWorld.top + (row + .5) * visibleWorld.height / 9,
      }
      const vector = localMagneticVector(source, point, sourcePosition, reversed)
      const angle = Math.atan2(vector.y, vector.x) * 180 / Math.PI
      const influence = relativeMagneticStrength(source, strength, point, sourcePosition)
      return { ...point, angle, influence }
    })
  )).flat(), [reversed, source, sourcePosition, strength, visibleWorld])

  const streamlines = useMemo(() => {
    if (source === 'magnet' || source === 'electromagnet') {
      return createReferencePoleStreamlines(source, sourcePosition, reversed)
    }
    const offsets = [-94, -72, -52, -34, -18, 18, 34, 52, 72, 94]
    return offsets
      .map((offset) => createStreamline(source, {
        x: sourcePosition.x + poleHalfSeparation(source) + 8,
        y: sourcePosition.y + offset,
      }, sourcePosition, reversed))
      .filter((streamline): streamline is Streamline => Boolean(streamline))
  }, [reversed, source, sourcePosition])

  useEffect(() => {
    setSourcePosition({ x: 380, y: 240 })
    setProbe({ x: 628, y: 100 })
    setViewport({ x: 0, y: 0, zoom: 1 })
  }, [source])

  function svgPoint(clientX: number, clientY: number, svg: SVGSVGElement): Vector2 {
    const bounds = svg.getBoundingClientRect()
    return {
      x: (clientX - bounds.left) / bounds.width * FIELD_WIDTH,
      y: (clientY - bounds.top) / bounds.height * FIELD_HEIGHT,
    }
  }

  function rawEventPoint(event: PointerEvent<SVGSVGElement>) {
    return svgPoint(event.clientX, event.clientY, event.currentTarget)
  }

  function eventPoint(event: PointerEvent<SVGSVGElement>): Vector2 {
    const raw = rawEventPoint(event)
    return {
      x: (raw.x - viewport.x) / viewport.zoom,
      y: (raw.y - viewport.y) / viewport.zoom,
    }
  }

  function updateDraggedItem(event: PointerEvent<SVGSVGElement>) {
    if (dragTarget.current === 'viewport') {
      const raw = rawEventPoint(event)
      const dx = raw.x - panOrigin.current.pointer.x
      const dy = raw.y - panOrigin.current.pointer.y
      if (Math.hypot(dx, dy) > 2) dragMoved.current = true
      setViewport((current) => ({
        ...current,
        x: panOrigin.current.position.x + dx,
        y: panOrigin.current.position.y + dy,
      }))
      return
    }

    const pointer = eventPoint(event)
    const next = { x: pointer.x + dragOffset.current.x, y: pointer.y + dragOffset.current.y }
    if (dragTarget.current === 'source') {
      setSourcePosition({
        x: Math.max(-FIELD_WORLD_LIMIT, Math.min(FIELD_WORLD_LIMIT, next.x)),
        y: Math.max(-FIELD_WORLD_LIMIT, Math.min(FIELD_WORLD_LIMIT, next.y)),
      })
      return
    }
    if (dragTarget.current !== 'probe' || Math.hypot(next.x - sourcePosition.x, next.y - sourcePosition.y) < 70) return
    setProbe({
      x: Math.max(-FIELD_WORLD_LIMIT, Math.min(FIELD_WORLD_LIMIT, next.x)),
      y: Math.max(-FIELD_WORLD_LIMIT, Math.min(FIELD_WORLD_LIMIT, next.y)),
    })
  }

  function beginDrag(event: PointerEvent<SVGSVGElement>) {
    const requestedTarget = (event.target as Element).closest('[data-drag-target]')?.getAttribute('data-drag-target')
    dragTarget.current = requestedTarget === 'source' ? 'source' : requestedTarget === 'probe' ? 'probe' : 'viewport'
    dragMoved.current = false

    const rawPointer = rawEventPoint(event)
    panOrigin.current = { pointer: rawPointer, position: { x: viewport.x, y: viewport.y } }
    const pointer = eventPoint(event)
    dragOffset.current = requestedTarget === 'source'
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
      if (Math.hypot(next.x - sourcePosition.x, next.y - sourcePosition.y) >= 70) {
        setProbe({
          x: Math.max(-FIELD_WORLD_LIMIT, Math.min(FIELD_WORLD_LIMIT, next.x)),
          y: Math.max(-FIELD_WORLD_LIMIT, Math.min(FIELD_WORLD_LIMIT, next.y)),
        })
      }
    }
    dragTarget.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function changeZoom(nextZoom: number, anchor = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 }) {
    setViewport((current) => {
      const zoom = Math.max(FIELD_ZOOM_MIN, Math.min(FIELD_ZOOM_MAX, nextZoom))
      const worldAtAnchor = {
        x: (anchor.x - current.x) / current.zoom,
        y: (anchor.y - current.y) / current.zoom,
      }
      return {
        zoom,
        x: anchor.x - worldAtAnchor.x * zoom,
        y: anchor.y - worldAtAnchor.y * zoom,
      }
    })
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    const anchor = svgPoint(event.clientX, event.clientY, event.currentTarget)
    changeZoom(viewport.zoom * (event.deltaY < 0 ? 1.15 : .87), anchor)
  }

  function moveWithKeyboard(target: 'probe' | 'source', event: KeyboardEvent<SVGGElement>) {
    const movement: Record<string, Vector2> = {
      ArrowLeft: { x: -12, y: 0 },
      ArrowRight: { x: 12, y: 0 },
      ArrowUp: { x: 0, y: -12 },
      ArrowDown: { x: 0, y: 12 },
    }
    const delta = movement[event.key]
    if (!delta) return
    event.preventDefault()
    const update = (current: Vector2) => ({
      x: Math.max(-FIELD_WORLD_LIMIT, Math.min(FIELD_WORLD_LIMIT, current.x + delta.x)),
      y: Math.max(-FIELD_WORLD_LIMIT, Math.min(FIELD_WORLD_LIMIT, current.y + delta.y)),
    })
    if (target === 'source') setSourcePosition(update)
    else setProbe(update)
  }

  const sceneStyle = {
    '--field-energy': Math.min(1, .35 + strength * .065),
    '--flow-speed': `${Math.max(1.2, 4.2 - strength * .22)}s`,
    '--flow-direction': reversed ? 'reverse' : 'normal',
  } as CSSProperties

  return <div className="magnetic-scene" style={sceneStyle}>
    <svg
      viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Campo interactivo de ${fieldSourceCopy[source].title}. Arrastra la fuente y la sonda, desplaza el fondo y usa la rueda para ampliar.`}
      onPointerDown={beginDrag}
      onPointerMove={moveDraggedItem}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={handleWheel}
    >
      <defs>
        <pattern id="instrument-grid-minor" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#173446" strokeWidth=".65" />
        </pattern>
        <pattern id="instrument-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#instrument-grid-minor)" />
          <path d="M100 0H0V100" fill="none" stroke="#245168" strokeWidth="1" />
        </pattern>
        <radialGradient id="field-vignette" cx="50%" cy="46%" r="74%">
          <stop offset="0" stopColor="#123447" stopOpacity=".18" />
          <stop offset=".72" stopColor="#06131c" stopOpacity=".28" />
          <stop offset="1" stopColor="#020910" stopOpacity=".88" />
        </radialGradient>
        <linearGradient id="magnet-north" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ff8790" />
          <stop offset=".45" stopColor="#e84f60" />
          <stop offset="1" stopColor="#982b3d" />
        </linearGradient>
        <linearGradient id="magnet-south" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#7aa7ff" />
          <stop offset=".45" stopColor="#4777dc" />
          <stop offset="1" stopColor="#24459b" />
        </linearGradient>
        <linearGradient id="magnet-metal" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#758899" />
          <stop offset=".25" stopColor="#d8e0e5" />
          <stop offset=".5" stopColor="#8497a6" />
          <stop offset=".75" stopColor="#edf2f5" />
          <stop offset="1" stopColor="#687b8c" />
        </linearGradient>
        <linearGradient id="core-steel" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#d8e4e9" />
          <stop offset=".32" stopColor="#8fa4ae" />
          <stop offset=".68" stopColor="#5f737e" />
          <stop offset="1" stopColor="#b9c8ce" />
        </linearGradient>
        <linearGradient id="coil-copper" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ffd29a" />
          <stop offset=".28" stopColor="#e98a35" />
          <stop offset=".7" stopColor="#a94716" />
          <stop offset="1" stopColor="#f2a958" />
        </linearGradient>
        <filter id="source-shadow" x="-35%" y="-70%" width="170%" height="240%">
          <feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#000" floodOpacity=".48" />
        </filter>
        <filter id="field-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.8" />
        </filter>
      </defs>

      <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} className="viewport-backdrop" />
      <g className="scene-world" transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
        <rect
          x={visibleWorld.left - visibleWorld.width * .1}
          y={visibleWorld.top - visibleWorld.height * .1}
          width={visibleWorld.width * 1.2}
          height={visibleWorld.height * 1.2}
          fill="url(#instrument-grid-major)"
        />
        <line x1="0" y1={-FIELD_WORLD_LIMIT} x2="0" y2={FIELD_WORLD_LIMIT} className="axis-line" />
        <line x1={-FIELD_WORLD_LIMIT} y1="0" x2={FIELD_WORLD_LIMIT} y2="0" className="axis-line" />

        <g className="procedural-field-lines">
          {streamlines.map((streamline, index) => <g key={`${source}-${index}`}>
            <path d={streamline.path} className="field-flow-glow" />
            <path d={streamline.path} className="field-flow-line" />
            <path d={streamline.path} className="field-flow-pulse" style={{ animationDelay: `${index * -.22}s` }} />
            {streamline.arrows.map((arrow, arrowIndex) => <path
              key={arrowIndex}
              d="M-5.5-3.2L0 0L-5.5 3.2"
              className="field-direction-arrow"
              transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle}) scale(${1 / viewport.zoom})`}
            />)}
          </g>)}
        </g>

        <g className="field-vector-map" aria-label="Mapa vectorial recalculado en tiempo real">
          {fieldSamples.map((sample, index) => {
            const length = (6 + sample.influence * .08) / viewport.zoom
            return <g
              key={index}
              transform={`translate(${sample.x} ${sample.y}) rotate(${sample.angle})`}
              opacity={.15 + sample.influence / 118}
            >
              <line x1={-length * .38} y1="0" x2={length * .38} y2="0" />
              <path d={`M${length * .12} -2.7L${length * .46} 0 ${length * .12} 2.7`} />
            </g>
          })}
        </g>

        {source === 'magnet' && <g
          data-drag-target="source"
          className="bar-magnet source-draggable"
          transform={`translate(${sourcePosition.x} ${sourcePosition.y})`}
          role="button"
          tabIndex={0}
          aria-label="Imán de barra móvil"
          onKeyDown={(event) => moveWithKeyboard('source', event)}
          filter="url(#source-shadow)"
        >
          <rect x="-94" y="-40" width="188" height="80" rx="17" className="magnet-frame" />
          <path d="M-76-34H-3V34H-76a12 12 0 0 1-12-12v-44a12 12 0 0 1 12-12Z" className={reversed ? 'south' : 'north'} />
          <path d="M3-34H76a12 12 0 0 1 12 12v44a12 12 0 0 1-12 12H3Z" className={reversed ? 'north' : 'south'} />
          <rect x="-4" y="-36" width="8" height="72" rx="2" className="magnet-collar" />
          <path d="M-74-27H-12M12-27H74" className="magnet-highlight" />
          <path d="M-78 28H-10M10 28H78" className="magnet-lower-edge" />
          <text x="-44" y="11" className="pole-letter">{reversed ? 'S' : 'N'}</text>
          <text x="44" y="11" className="pole-letter">{reversed ? 'N' : 'S'}</text>
          <text x="0" y="59" className="source-tag">IMÁN DE BARRA · N → S</text>
        </g>}

        {source === 'electromagnet' && <g
          data-drag-target="source"
          className="electromagnet source-draggable"
          transform={`translate(${sourcePosition.x} ${sourcePosition.y})`}
          role="button"
          tabIndex={0}
          aria-label="Electroimán móvil"
          onKeyDown={(event) => moveWithKeyboard('source', event)}
          filter="url(#source-shadow)"
        >
          <rect x="-96" y="-17" width="192" height="34" rx="10" className="iron-core" />
          <rect x="-94" y="-15" width="24" height="30" rx="7" className={reversed ? 'south' : 'north'} />
          <rect x="70" y="-15" width="24" height="30" rx="7" className={reversed ? 'north' : 'south'} />
          <rect x="-68" y="-39" width="136" height="78" rx="13" className="coil-bobbin" />
          <rect x="-61" y="-32" width="122" height="64" rx="9" className="coil-pack" />
          {Array.from({ length: 13 }, (_, index) => {
            const x = -55 + index * 9.2
            return <path key={index} d={`M${x} -30C${x + 7} -16 ${x + 7} 16 ${x} 30`} className="coil-turn" />
          })}
          <rect x="-70" y="-43" width="10" height="86" rx="4" className="coil-flange" />
          <rect x="60" y="-43" width="10" height="86" rx="4" className="coil-flange" />
          <path d="M-48 32v18h22M48 32v18H26" className="coil-wire" />
          <circle cx="-26" cy="50" r="6" className="coil-terminal" />
          <circle cx="26" cy="50" r="6" className="coil-terminal" />
          <text x="-82" y="6" className="electromagnet-pole">{reversed ? 'S' : 'N'}</text>
          <text x="82" y="6" className="electromagnet-pole">{reversed ? 'N' : 'S'}</text>
          <text x="-26" y="53" className="terminal-sign">−</text>
          <text x="26" y="53" className="terminal-sign">+</text>
          <path d={reversed ? 'M18-49H-18l7-6M-18-49l7 6' : 'M-18-49H18l-7-6M18-49l-7 6'} className="current-arrow" />
          <text x="0" y="72" className="source-tag">NÚCLEO DE HIERRO · BOBINA DE COBRE</text>
        </g>}

        <g
          data-drag-target="probe"
          className="compass-probe"
          transform={`translate(${probe.x} ${probe.y}) scale(1.3)`}
          role="button"
          tabIndex={0}
          aria-label="Sonda de brújula móvil"
          onKeyDown={(event) => moveWithKeyboard('probe', event)}
        >
          <circle r="31" className="probe-halo" />
          <circle r="24" className="probe-body" />
          <circle r="19" className="compass-inner-ring" />
          <g transform={`rotate(${probeAngle})`}>
            <path className="compass-north-needle" d="M22 0L-3-7V7Z" />
            <path className="compass-south-needle" d="M-22 0L3-7V7Z" />
          </g>
          <circle r="3.5" className="compass-pivot" />
          <text y="46">SONDA P-01</text>
        </g>
      </g>
    </svg>

    <div className="scene-readout">
      <strong>{influenceLabel}</strong>
      <small>{relativeFieldDisplay}% · θ {probeAngle.toFixed(1)}° · Δ {sourceDistance.toFixed(0)} u</small>
    </div>
    <div className="scene-navigation" aria-label="Navegación del espacio">
      <button onClick={() => changeZoom(viewport.zoom * 1.28)} aria-label="Acercar"><ZoomIn size={17} /></button>
      <output>{Math.round(viewport.zoom * 100)}%</output>
      <button onClick={() => changeZoom(viewport.zoom / 1.28)} aria-label="Alejar"><ZoomOut size={17} /></button>
      <button onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })} aria-label="Centrar vista"><Crosshair size={17} /></button>
    </div>
    <div className="interaction-guide"><Move size={14} /><span>Arrastra la fuente y la sonda</span><b>Rueda para zoom · fondo para navegar</b></div>
    <div className="scene-scale">
      <span>INTENSIDAD RELATIVA EN P-01</span>
      <i><b style={{ width: `${relativeField}%` }} /></i>
      <strong>{relativeFieldDisplay}%</strong>
    </div>
  </div>
}

function FieldExperiment({
  source,
  strength,
  reversed,
  onSourceChange,
  onStrengthChange,
  onReverse,
}: {
  source: Source
  strength: number
  reversed: boolean
  onSourceChange: (source: Source) => void
  onStrengthChange: (strength: number) => void
  onReverse: () => void
}) {
  return <div className="field-workspace">
    <section className="field-canvas-shell">
      <FieldScene source={source} strength={strength} reversed={reversed} />
      <footer className="field-canvas-footer">
        <span>Campo magnético · {fieldSourceCopy[source].title}</span>
      </footer>
    </section>

    <aside className="field-console">
      <header className="console-header">
        <div><span>CONSOLA DE FUENTE</span><strong>{fieldSourceCopy[source].title}</strong></div>
        <Gauge size={20} />
      </header>

      <section className="console-section source-section">
        <div className="console-section-heading"><span>01</span><div><strong>Selecciona una fuente</strong><small>El visor conserva la sonda y recalcula el campo.</small></div></div>
        <div className="source-picker">
          {(['magnet', 'electromagnet'] as Source[]).map((item) => <button
            key={item}
            className={source === item ? 'selected' : ''}
            onClick={() => onSourceChange(item)}
            aria-pressed={source === item}
          >
            <i>{sourceIcon(item)}</i>
            <span>{fieldSourceCopy[item].title}<small>{fieldSourceCopy[item].model}</small></span>
          </button>)}
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-heading"><span>02</span><div><strong>Ajusta la excitación</strong><small>Observa densidad, dirección y respuesta de P-01.</small></div></div>
        <Range
          label={source === 'magnet' ? 'Momento magnético relativo' : source === 'electromagnet' ? 'Corriente de bobina' : 'Intensidad de corriente'}
          value={strength}
          min={1}
          max={10}
          step={.5}
          unit={source === 'magnet' ? '×' : 'A'}
          onChange={onStrengthChange}
        />
        <button className="direction-button" onClick={onReverse}>
          <RotateCcw size={16} />
          <span><strong>Invertir orientación</strong><small>{source === 'magnet' ? 'Intercambia polos N y S' : 'Invierte el sentido de corriente'}</small></span>
          <b>{reversed ? 'INVERTIDA' : 'NORMAL'}</b>
        </button>
      </section>

    </aside>
  </div>
}

function LorentzScene({
  states,
  frame,
  electricField,
  magneticField,
  charge,
  initialPosition,
  onInitialPositionChange,
}: {
  states: ReturnType<typeof simulateLorentzTrajectory>
  frame: number
  electricField: Vector2
  magneticField: number
  charge: number
  initialPosition: Vector2
  onInitialPositionChange: (position: Vector2) => void
}) {
  const positionDrag = useRef<{ scale: number } | null>(null)
  const visible = states.slice(0, Math.max(1, frame + 1))
  const trail = visible.slice(-90)
  const allX = states.map((state) => state.position.x)
  const allY = states.map((state) => state.position.y)
  const extentX = Math.max(4, ...allX.map(Math.abs), Math.abs(initialPosition.x)) * 1.16
  const extentY = Math.max(4, ...allY.map(Math.abs), Math.abs(initialPosition.y)) * 1.16
  const scale = Math.min(610 / (extentX * 2), 350 / (extentY * 2))
  const map = (point: Vector2) => ({
    x: 380 + point.x * scale,
    y: 240 - point.y * scale,
  })
  const points = visible.map((state) => {
    const point = map(state.position)
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
  }).join(' ')
  const current = visible.at(-1) ?? states[0]
  const particle = map(current.position)
  const chargeCoulombs = charge * 1e-6
  const electricForce = { x: chargeCoulombs * electricField.x, y: chargeCoulombs * electricField.y }
  const magneticForce = { x: current.force.x - electricForce.x, y: current.force.y - electricForce.y }
  const totalForceMagnitude = Math.hypot(current.force.x, current.force.y)
  const electricForceMagnitude = Math.hypot(electricForce.x, electricForce.y)
  const magneticForceMagnitude = Math.hypot(magneticForce.x, magneticForce.y)
  const forceScale = 52 / Math.max(totalForceMagnitude * 1e6, electricForceMagnitude * 1e6, magneticForceMagnitude * 1e6, .25)
  const velocityScale = 48 / Math.max(Math.hypot(current.velocity.x, current.velocity.y), .25)
  const vectorEnd = (vector: Vector2, multiplier: number) => ({
    x: particle.x + vector.x * multiplier,
    y: particle.y - vector.y * multiplier,
  })
  const velocityEnd = vectorEnd(current.velocity, velocityScale)
  const electricEnd = vectorEnd(electricForce, forceScale * 1e6)
  const magneticEnd = vectorEnd(magneticForce, forceScale * 1e6)
  const forceEnd = vectorEnd(current.force, forceScale * 1e6)
  const electricDirection = electricField.y >= 0 ? -1 : 1
  const electricFieldDirection = Math.abs(electricField.y) <= .01
    ? 'apagado'
    : electricField.y > 0 ? 'hacia arriba' : 'hacia abajo'
  const electricRailStart = electricField.y >= 0 ? 390 : 90
  const electricRailEnd = electricField.y >= 0 ? 90 : 390
  const vectorLabelPosition = (end: Vector2, start: Vector2) => ({
    x: end.x + (end.x >= start.x ? 8 : -8),
    y: end.y + (end.y >= start.y ? 14 : -8),
    anchor: (end.x >= start.x ? 'start' : 'end') as 'start' | 'end',
  })
  const velocityLabel = vectorLabelPosition(velocityEnd, particle)
  const electricLabel = vectorLabelPosition(electricEnd, particle)
  const magneticLabel = vectorLabelPosition(magneticEnd, particle)
  const totalLabel = vectorLabelPosition(forceEnd, particle)
  const initialMarker = map(initialPosition)
  const pointerPosition = (event: PointerEvent<SVGGElement>) => {
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return initialPosition
    const bounds = svg.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width * FIELD_WIDTH
    const y = (event.clientY - bounds.top) / bounds.height * FIELD_HEIGHT
    const dragScale = positionDrag.current?.scale ?? scale
    return {
      x: Math.max(-20, Math.min(20, Math.round((x - 380) / dragScale * 10) / 10)),
      y: Math.max(-20, Math.min(20, Math.round((240 - y) / dragScale * 10) / 10)),
    }
  }
  const beginPositionDrag = (event: PointerEvent<SVGGElement>) => {
    if (frame > 0) return
    event.stopPropagation()
    positionDrag.current = { scale }
    event.currentTarget.setPointerCapture(event.pointerId)
    onInitialPositionChange(pointerPosition(event))
  }
  const movePositionDrag = (event: PointerEvent<SVGGElement>) => {
    if (!positionDrag.current) return
    onInitialPositionChange(pointerPosition(event))
  }
  const endPositionDrag = (event: PointerEvent<SVGGElement>) => {
    positionDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return <div className="lorentz-scene">
    <svg viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`} role="img" aria-label="Cámara de trayectoria de una partícula cargada">
      <defs>
        <pattern id="lorentz-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#173446" strokeWidth=".7" /></pattern>
        <radialGradient id="particleGlow"><stop stopColor={charge >= 0 ? '#ff7b82' : '#69a7ff'} stopOpacity=".64" /><stop offset="1" stopColor={charge >= 0 ? '#ff7b82' : '#69a7ff'} stopOpacity="0" /></radialGradient>
        <marker id="vector-arrow-green" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5 0 7Z" fill="#69e0ba" /></marker>
        <marker id="vector-arrow-blue" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5 0 7Z" fill="#67b8ff" /></marker>
        <marker id="vector-arrow-purple" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5 0 7Z" fill="#b693ff" /></marker>
        <marker id="vector-arrow-orange" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5 0 7Z" fill="#ffae67" /></marker>
      </defs>
      <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="#07141d" />
      <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="url(#lorentz-grid)" />
      <g className="lorentz-coordinate-plane">
        <line x1="54" y1="240" x2="706" y2="240" />
        <line x1="380" y1="44" x2="380" y2="436" />
        <circle cx="380" cy="240" r="3" />
        <text x="710" y="236">+x</text><text x="385" y="42">+y</text><text x="388" y="254">0</text>
      </g>
      <g className="magnetic-field-layer" style={{ opacity: .12 + Math.abs(magneticField) * .22 }}>
        {Array.from({ length: 9 }, (_, row) => Array.from({ length: 14 }, (_, column) => <g key={`${row}-${column}`} className="b-symbol" transform={`translate(${35 + column * 54} ${48 + row * 48})`}>
          {magneticField >= 0
            ? <><circle r="5" /><circle r="1.6" className="filled" /></>
            : <><circle r="5" /><line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" /><line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" /></>}
        </g>))}
      </g>
      {Math.abs(electricField.y) > .01 && <g className="electric-field-layer" style={{ opacity: .28 + Math.abs(electricField.y) * .16 }}>
        {Array.from({ length: 7 }, (_, row) => Array.from({ length: 12 }, (_, column) => <line key={`${row}-${column}`} x1={55 + column * 60} y1={78 + row * 55} x2={55 + column * 60} y2={78 + row * 55 + electricDirection * 15} markerEnd="url(#vector-arrow-blue)" />))}
        <g className="electric-field-streams">
          {[120, 250, 380, 510, 640].map((x) => <line key={x} x1={x} y1={electricRailStart} x2={x} y2={electricRailEnd} markerEnd="url(#vector-arrow-blue)" />)}
        </g>
        <g className="electric-direction-rails">
          <line x1="28" y1={electricRailStart} x2="28" y2={electricRailEnd} markerEnd="url(#vector-arrow-blue)" />
          <line x1="732" y1={electricRailStart} x2="732" y2={electricRailEnd} markerEnd="url(#vector-arrow-blue)" />
          <text x="45" y="240" transform="rotate(-90 45 240)">CAMPO ELÉCTRICO E · {electricFieldDirection.toUpperCase()}</text>
        </g>
      </g>}
      {Math.abs(magneticField) > .01 && <g className="magnetic-depth-label">
        <rect x="536" y="18" width="205" height="34" rx="5" />
        <text x="550" y="39">{magneticField > 0 ? '⊙  CAMPO B · SALE DE LA PANTALLA' : '⊗  CAMPO B · ENTRA EN LA PANTALLA'}</text>
      </g>}
      <g className="lorentz-start-marker" transform={`translate(${initialMarker.x} ${initialMarker.y})`}>
        <circle r="12" /><path d="M-17 0H17M0-17V17" /><text x="16" y="-13">INICIO ({initialPosition.x.toFixed(1)}, {initialPosition.y.toFixed(1)}) m</text>
      </g>
      <polyline points={points} className="particle-path" />
      <g className="particle-trail">{trail.map((state, index) => {
        const point = map(state.position)
        return <circle key={`${state.time}-${index}`} cx={point.x} cy={point.y} r={1.2 + index / trail.length * 2.4} opacity={.06 + index / trail.length * .48} />
      })}</g>
      <circle cx={particle.x} cy={particle.y} r="28" fill="url(#particleGlow)" className="particle-glow" />
      <circle cx={particle.x} cy={particle.y} r="14" className="particle-pulse" />
      <g
        className={`lorentz-particle-positioner ${frame === 0 ? 'is-draggable' : ''}`}
        transform={`translate(${particle.x} ${particle.y})`}
        onPointerDown={beginPositionDrag}
        onPointerMove={movePositionDrag}
        onPointerUp={endPositionDrag}
        onPointerCancel={endPositionDrag}
      ><circle r="27" /></g>
      <circle cx={particle.x} cy={particle.y} r="10" className={charge >= 0 ? 'particle-positive' : 'particle-negative'} />
      <text x={particle.x} y={particle.y + 3.5} className="particle-sign">{charge >= 0 ? '+' : '−'}</text>
      <text x={particle.x} y={particle.y + 25} className="particle-identity">PARTÍCULA {charge >= 0 ? 'POSITIVA' : 'NEGATIVA'}</text>
      <line x1={particle.x} y1={particle.y} x2={velocityEnd.x} y2={velocityEnd.y} className="velocity-vector" markerEnd="url(#vector-arrow-green)" />
      {electricForceMagnitude > 1e-10 && <><line x1={particle.x - 4} y1={particle.y} x2={electricEnd.x - 4} y2={electricEnd.y} className="electric-force-vector" markerEnd="url(#vector-arrow-blue)" /><text x={electricLabel.x - 7} y={electricLabel.y} textAnchor={electricLabel.anchor} className="vector-label electric-label">EFECTO DEL CAMPO E</text></>}
      {magneticForceMagnitude > 1e-10 && <><line x1={particle.x + 4} y1={particle.y} x2={magneticEnd.x + 4} y2={magneticEnd.y} className="magnetic-force-vector" markerEnd="url(#vector-arrow-purple)" /><text x={magneticLabel.x + 7} y={magneticLabel.y} textAnchor={magneticLabel.anchor} className="vector-label magnetic-label">EFECTO DEL CAMPO B</text></>}
      {totalForceMagnitude > 1e-10 && <><line x1={particle.x} y1={particle.y} x2={forceEnd.x} y2={forceEnd.y} className="force-vector" markerEnd="url(#vector-arrow-orange)" /><text x={totalLabel.x} y={totalLabel.y} textAnchor={totalLabel.anchor} className="vector-label total-label">RESULTADO</text></>}
      <text x={velocityLabel.x} y={velocityLabel.y} textAnchor={velocityLabel.anchor} className="vector-label velocity-label">MOVIMIENTO</text>
    </svg>
    <div className="lorentz-field-badges"><span className="electric-badge">E {Math.abs(electricField.y) <= .01 ? '—' : electricField.y >= 0 ? '↑' : '↓'} {Math.abs(electricField.y).toFixed(1)} V/m</span><span className="magnetic-badge">{Math.abs(magneticField) <= .01 ? '—' : magneticField >= 0 ? '⊙' : '⊗'} B {Math.abs(magneticField).toFixed(1)} T</span><span className={`charge-badge ${charge >= 0 ? 'positive' : 'negative'}`}>q {charge >= 0 ? 'positiva' : 'negativa'}</span></div>
    <div className="lorentz-legend"><span><i className="velocity-swatch" />velocidad</span><span><i className="electric-force-swatch" />fuerza E</span><span><i className="magnetic-force-swatch" />fuerza B</span><span><i className="force-swatch" />resultado</span></div>
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
  const [initialPosition, setInitialPosition] = useState<Vector2>({ x: 0, y: 0 })
  const [playing, setPlaying] = useState(false)
  const [frame, setFrame] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const parameters = useMemo(() => ({
    chargeCoulombs: charge * 1e-6,
    massKg: mass * 1e-6,
    electricField: { x: 0, y: electric },
    magneticFieldTesla: magnetic,
    initialPosition,
    initialVelocity: { x: velocity, y: 0 },
    durationSeconds: duration,
    steps: 650,
  }), [charge, duration, electric, initialPosition, magnetic, mass, velocity])
  const states = useMemo(() => simulateLorentzTrajectory(parameters), [parameters])
  const current = states[Math.min(frame, states.length - 1)] ?? states[0]
  const drift = crossedFieldDrift(parameters.electricField, magnetic)
  const period = cyclotronPeriod(parameters.massKg, parameters.chargeCoulombs, magnetic)
  const electricForceNow = {
    x: parameters.chargeCoulombs * parameters.electricField.x,
    y: parameters.chargeCoulombs * parameters.electricField.y,
  }
  const magneticForceNow = {
    x: current.force.x - electricForceNow.x,
    y: current.force.y - electricForceNow.y,
  }

  useEffect(() => {
    setFrame(0)
    setPlaying(false)
  }, [parameters])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setFrame((previous) => {
      const next = previous + Math.max(1, Math.round(5 * playbackSpeed))
      if (next >= states.length - 1) {
        setPlaying(false)
        return states.length - 1
      }
      return next
    }), 30)
    return () => window.clearInterval(timer)
  }, [playbackSpeed, playing, states.length])

  const resetLorentz = () => {
    setElectric(1.2)
    setMagnetic(.8)
    setVelocity(3)
    setCharge(1)
    setMass(1)
    setDuration(10)
    setInitialPosition({ x: 0, y: 0 })
    setFrame(0)
    setPlaying(false)
  }

  const applyLorentzPreset = (preset: 'circular' | 'crossed' | 'selector' | 'negative') => {
    setInitialPosition({ x: 0, y: 0 })
    if (preset === 'circular') {
      setElectric(0); setMagnetic(1); setVelocity(3); setCharge(1); setMass(1); setDuration(10)
    }
    if (preset === 'crossed') {
      setElectric(1.2); setMagnetic(.8); setVelocity(3); setCharge(1); setMass(1); setDuration(10)
    }
    if (preset === 'selector') {
      setElectric(1.2); setMagnetic(.8); setVelocity(1.5); setCharge(1); setMass(1); setDuration(10)
    }
    if (preset === 'negative') {
      setElectric(1.2); setMagnetic(.8); setVelocity(3); setCharge(-1); setMass(1); setDuration(10)
    }
    setFrame(0)
    setPlaying(false)
  }

  return <div className="magnetic-lab">
    <ExperimentNav activeId={tool} ariaLabel="Experiencias de magnetismo" onSelect={setTool} items={[
      { id: 'field', title: 'Cartografía de campo', description: 'Fuentes, líneas y sonda magnética' },
      { id: 'lorentz', title: 'Cámara de Lorentz', description: 'Trayectoria y descomposición de fuerzas' },
    ]} />
    <div className="magnetic-workbench">
      <section className="workbench-main">
        <header className="workbench-header">
          <div><h3>{tool === 'field' ? 'Cartografía interactiva del campo magnético' : 'Cámara de movimiento bajo fuerza de Lorentz'}</h3></div>
        </header>

        {tool === 'field' ? <FieldExperiment
          source={source}
          strength={strength}
          reversed={reversed}
          onSourceChange={setSource}
          onStrengthChange={setStrength}
          onReverse={() => setReversed((currentDirection) => !currentDirection)}
        /> : <div className="lorentz-layout">
          <section className="lorentz-left">
            <LorentzScene states={states} frame={frame} electricField={parameters.electricField} magneticField={magnetic} charge={charge} initialPosition={initialPosition} onInitialPositionChange={setInitialPosition} />
            <div className="lorentz-playback">
              <button className="lorentz-play" onClick={() => { if (frame >= states.length - 1) setFrame(0); setPlaying(!playing) }}>
                {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                {playing ? 'Pausar' : frame > 0 ? 'Continuar' : 'Iniciar experimento'}
              </button>
              <button onClick={() => { setFrame(0); setPlaying(false) }}><RotateCcw size={14} />Reiniciar</button>
              <div className="playback-speed" aria-label="Velocidad de reproducción">{[.5, 1, 2].map((speed) => <button key={speed} className={playbackSpeed === speed ? 'active' : ''} onClick={() => setPlaybackSpeed(speed)}>{speed}×</button>)}</div>
              <div className="timeline"><span>t = {current.time.toFixed(2)} s</span><input type="range" min="0" max={states.length - 1} value={frame} onChange={(event) => { setFrame(Number(event.target.value)); setPlaying(false) }} /></div>
            </div>
          </section>

          <aside className="lorentz-panel">
            <div className="lorentz-panel-title"><div><span>CONSOLA DE PARTÍCULA</span><strong>Campos E y B cruzados</strong></div><button onClick={resetLorentz} aria-label="Restablecer parámetros"><RotateCcw size={15} /></button></div>
            <div className="lorentz-presets"><span>ESCENARIOS</span><div><button onClick={() => applyLorentzPreset('circular')}>Órbita circular</button><button onClick={() => applyLorentzPreset('crossed')}>Campos cruzados</button><button onClick={() => applyLorentzPreset('selector')}>Selector de velocidad</button><button onClick={() => applyLorentzPreset('negative')}>Carga negativa</button></div></div>
            <Range label="Campo eléctrico Eᵧ" value={electric} min={-3} max={3} step={.1} unit="V/m" onChange={setElectric} />
            <Range label="Campo magnético Bᶻ" value={magnetic} min={-2} max={2} step={.1} unit="T" onChange={setMagnetic} />
            <Range label="Velocidad inicial vₓ" value={velocity} min={.5} max={8} step={.1} unit="m/s" onChange={setVelocity} />
            <div className="lorentz-position-control">
              <div><span>POSICIÓN INICIAL</span><small>Arrastra la partícula en el plano o escribe sus coordenadas.</small></div>
              <div className="lorentz-position-inputs">
                <label>x₀ <span><NumericInput min={-20} max={20} step={.1} value={initialPosition.x} onValueChange={(value) => setInitialPosition((current) => ({ ...current, x: value }))} /><small>m</small></span></label>
                <label>y₀ <span><NumericInput min={-20} max={20} step={.1} value={initialPosition.y} onValueChange={(value) => setInitialPosition((current) => ({ ...current, y: value }))} /><small>m</small></span></label>
              </div>
            </div>
            <div className="charge-switch" aria-label="Signo de la carga"><button className={charge > 0 ? 'active positive' : ''} onClick={() => setCharge(Math.max(.5, Math.abs(charge)))}>+ Positiva</button><button className={charge < 0 ? 'active negative' : ''} onClick={() => setCharge(-Math.max(.5, Math.abs(charge)))}>− Negativa</button></div>
            <div className="particle-inputs"><label>Carga q<div><NumericInput min={-5} max={5} step={0.5} value={charge} onValueChange={setCharge} /><span>µC</span></div></label><label>Masa m<div><NumericInput min={0.1} max={10} step={0.1} value={mass} onValueChange={setMass} /><span>mg</span></div></label></div>
            <Range label="Duración" value={duration} min={2} max={20} step={1} unit="s" onChange={setDuration} />
            <ResultPanel
              className="lorentz-readouts"
              title="Resultados de la partícula"
              status="En vivo"
              primaryLabel="Fuerza total |F⃗|"
              primaryValue={<>{(Math.hypot(current.force.x, current.force.y) * 1e6).toFixed(2)} <small>µN</small></>}
              primaryDetail="Suma de las contribuciones eléctrica y magnética"
              metrics={[
                { label: 'Fuerza eléctrica', value: <>{(Math.hypot(electricForceNow.x, electricForceNow.y) * 1e6).toFixed(2)} <small>µN</small></> },
                { label: 'Fuerza magnética', value: <>{(Math.hypot(magneticForceNow.x, magneticForceNow.y) * 1e6).toFixed(2)} <small>µN</small></> },
                { label: 'Rapidez actual', value: <>{Math.hypot(current.velocity.x, current.velocity.y).toFixed(2)} <small>m/s</small></> },
                { label: 'Deriva E×B', value: <>{Math.hypot(drift.x, drift.y).toFixed(2)} <small>m/s</small></> },
                { label: 'Periodo', value: <>{Number.isFinite(period) ? period.toFixed(2) : '∞'} <small>s</small></>, wide: true },
              ]}
            />
          </aside>
        </div>}
      </section>
    </div>
  </div>
}
