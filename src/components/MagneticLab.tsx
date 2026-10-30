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
  Cable,
  CircleDot,
  Compass,
  Crosshair,
  Gauge,
  Magnet,
  Maximize2,
  Move,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ScanLine,
  Waves,
  Zap,
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
import './magnetic-lab.css'

type Tool = 'field' | 'lorentz'
type Source = 'magnet' | 'electromagnet' | 'wire' | 'loop'
type DragTarget = 'probe' | 'source' | 'viewport' | null

const FIELD_WIDTH = 760
const FIELD_HEIGHT = 480

const fieldSourceCopy: Record<Source, { title: string; subtitle: string; model: string }> = {
  magnet: {
    title: 'Imán de barra',
    subtitle: 'Mueve el imán y observa cómo el mapa completo se reorganiza.',
    model: 'Dipolo magnético',
  },
  electromagnet: {
    title: 'Electroimán',
    subtitle: 'La corriente de la bobina controla la intensidad del campo.',
    model: 'Núcleo y solenoide',
  },
  wire: {
    title: 'Conductor recto',
    subtitle: 'El campo forma anillos alrededor de la dirección de corriente.',
    model: 'Biot-Savart ideal',
  },
  loop: {
    title: 'Espira de corriente',
    subtitle: 'La espira concentra el flujo magnético a lo largo de su eje.',
    model: 'Espira circular',
  },
}

function sourceIcon(source: Source) {
  if (source === 'magnet') return <Magnet size={18} />
  if (source === 'electromagnet') return <Radio size={18} />
  if (source === 'wire') return <Cable size={18} />
  return <CircleDot size={18} />
}

function localMagneticVector(
  source: Source,
  point: Vector2,
  sourcePosition: Vector2,
  reversed: boolean,
): Vector2 {
  const dx = point.x - sourcePosition.x
  const dy = point.y - sourcePosition.y
  const radius = Math.max(32, Math.hypot(dx, dy))
  const direction = reversed ? -1 : 1

  if (source === 'wire') {
    return { x: direction * dy / radius, y: -direction * dx / radius }
  }

  const moment = source === 'loop' ? direction : -direction
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
  const distance = Math.max(46, Math.hypot(point.x - sourcePosition.x, point.y - sourcePosition.y))
  const sourceGain = source === 'electromagnet' ? 1.65 : source === 'wire' ? .78 : source === 'loop' ? 1.12 : 1
  return Math.min(100, Math.max(2, 7200 * strength * sourceGain / distance ** 1.45))
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
    if (current.x < -90 || current.x > FIELD_WIDTH + 90 || current.y < -90 || current.y > FIELD_HEIGHT + 90) break
    points.push(current)

    if (index > 32 && Math.hypot(current.x - seed.x, current.y - seed.y) < 7) break
  }
  return points
}

function createStreamline(
  source: Source,
  seed: Vector2,
  sourcePosition: Vector2,
  reversed: boolean,
) {
  const backward = integrateFieldLine(source, seed, sourcePosition, reversed, -1).reverse()
  const forward = integrateFieldLine(source, seed, sourcePosition, reversed, 1)
  const points = [...backward, seed, ...forward]
  if (points.length < 4) return ''
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
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
  const influenceLabel = relativeField > 66 ? 'zona intensa' : relativeField > 32 ? 'zona media' : 'zona débil'

  const fieldSamples = useMemo(() => Array.from({ length: 9 }, (_, row) => (
    Array.from({ length: 15 }, (_, column) => {
      const point = { x: 36 + column * 49, y: 42 + row * 48 }
      const vector = localMagneticVector(source, point, sourcePosition, reversed)
      const angle = Math.atan2(vector.y, vector.x) * 180 / Math.PI
      const influence = relativeMagneticStrength(source, strength, point, sourcePosition)
      return { ...point, angle, influence }
    })
  )).flat(), [reversed, source, sourcePosition, strength])

  const streamlines = useMemo(() => {
    if (source === 'wire') return []
    const offsets = [-94, -72, -52, -34, -18, 18, 34, 52, 72, 94]
    return offsets
      .map((offset) => createStreamline(source, {
        x: sourcePosition.x + (source === 'loop' ? 48 : 66),
        y: sourcePosition.y + offset,
      }, sourcePosition, reversed))
      .filter(Boolean)
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
        x: Math.max(90, Math.min(FIELD_WIDTH - 90, next.x)),
        y: Math.max(78, Math.min(FIELD_HEIGHT - 78, next.y)),
      })
      return
    }
    if (dragTarget.current !== 'probe' || Math.hypot(next.x - sourcePosition.x, next.y - sourcePosition.y) < 70) return
    setProbe({
      x: Math.max(35, Math.min(FIELD_WIDTH - 35, next.x)),
      y: Math.max(35, Math.min(FIELD_HEIGHT - 42, next.y)),
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
          x: Math.max(35, Math.min(FIELD_WIDTH - 35, next.x)),
          y: Math.max(35, Math.min(FIELD_HEIGHT - 42, next.y)),
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
      const zoom = Math.max(.55, Math.min(3.5, nextZoom))
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
      x: Math.max(45, Math.min(FIELD_WIDTH - 45, current.x + delta.x)),
      y: Math.max(45, Math.min(FIELD_HEIGHT - 45, current.y + delta.y)),
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
        <filter id="source-shadow" x="-35%" y="-70%" width="170%" height="240%">
          <feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#000" floodOpacity=".48" />
        </filter>
        <filter id="field-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.8" />
        </filter>
      </defs>

      <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} className="viewport-backdrop" />
      <g className="scene-world" transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
        <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="url(#instrument-grid-major)" />
        <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="url(#field-vignette)" />
        <line x1={FIELD_WIDTH / 2} y1="0" x2={FIELD_WIDTH / 2} y2={FIELD_HEIGHT} className="axis-line" />
        <line x1="0" y1={FIELD_HEIGHT / 2} x2={FIELD_WIDTH} y2={FIELD_HEIGHT / 2} className="axis-line" />

        {source === 'wire' ? <g className="wire-field-lines" transform={`translate(${sourcePosition.x} ${sourcePosition.y})`}>
          {[54, 94, 138, 186].map((radius, index) => <g key={radius}>
            <circle r={radius + strength * 2.4} className="field-flow-glow" />
            <circle r={radius + strength * 2.4} className="field-flow-line" />
            <circle r={radius + strength * 2.4} className="field-flow-pulse" style={{ animationDelay: `${index * -.35}s` }} />
          </g>)}
        </g> : <g className="procedural-field-lines">
          {streamlines.map((path, index) => <g key={`${source}-${index}`}>
            <path d={path} className="field-flow-glow" />
            <path d={path} className="field-flow-line" />
            <path d={path} className="field-flow-pulse" style={{ animationDelay: `${index * -.22}s` }} />
          </g>)}
        </g>}

        <g className="field-vector-map" aria-label="Mapa vectorial recalculado en tiempo real">
          {fieldSamples.map((sample, index) => {
            const length = 6 + sample.influence * .08
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
          transform={`translate(${sourcePosition.x} ${sourcePosition.y}) rotate(${reversed ? 180 : 0})`}
          role="button"
          tabIndex={0}
          aria-label="Imán de barra móvil"
          onKeyDown={(event) => moveWithKeyboard('source', event)}
          filter="url(#source-shadow)"
        >
          <rect x="-84" y="-35" width="168" height="70" rx="13" className="magnet-shell" />
          <path d="M-70-29H-7V29H-70a9 9 0 0 1-9-9v-40a9 9 0 0 1 9-9Z" className="north" />
          <path d="M7-29H70a9 9 0 0 1 9 9v40a9 9 0 0 1-9 9H7Z" className="south" />
          <rect x="-7" y="-32" width="14" height="64" rx="3" className="magnet-collar" />
          <path d="M-68-22H-13" className="magnet-highlight" />
          <path d="M13-22H68" className="magnet-highlight" />
          {[-58, -50, 50, 58].map((x) => <line key={x} x1={x} y1="-18" x2={x} y2="18" className="magnet-grip" />)}
          <text x="-40" y="8" className="pole-letter">N</text>
          <text x="40" y="8" className="pole-letter">S</text>
          <circle cx="-72" cy="0" r="3" className="magnet-fastener" />
          <circle cx="72" cy="0" r="3" className="magnet-fastener" />
          <text x="0" y="54" className="source-tag">FUENTE MÓVIL</text>
        </g>}

        {source === 'electromagnet' && <g
          data-drag-target="source"
          className="electromagnet source-draggable"
          transform={`translate(${sourcePosition.x} ${sourcePosition.y}) rotate(${reversed ? 180 : 0})`}
          role="button"
          tabIndex={0}
          aria-label="Electroimán móvil"
          onKeyDown={(event) => moveWithKeyboard('source', event)}
          filter="url(#source-shadow)"
        >
          <rect x="-82" y="-24" width="164" height="48" rx="8" className="iron-core" />
          <rect x="-78" y="-20" width="30" height="40" rx="6" className="north" />
          <rect x="48" y="-20" width="30" height="40" rx="6" className="south" />
          {Array.from({ length: 11 }, (_, index) => <ellipse key={index} cx={-40 + index * 8} cy="0" rx="7" ry="35" className="coil-turn" />)}
          <path d="M-42 34v18h84V34" className="coil-wire" />
          <circle cx="0" cy="52" r="5" className="current-dot" />
          <text x="-63" y="6">N</text><text x="63" y="6">S</text>
          <text x="0" y="71" className="source-tag">BOBINA ACTIVA</text>
        </g>}

        {source === 'wire' && <g
          data-drag-target="source"
          className="wire-source source-draggable"
          transform={`translate(${sourcePosition.x} ${sourcePosition.y})`}
          role="button"
          tabIndex={0}
          aria-label="Conductor móvil"
          onKeyDown={(event) => moveWithKeyboard('source', event)}
        >
          <circle r="34" className="wire-halo" />
          <circle r="25" className="wire-core" />
          {reversed
            ? <><line x1="-9" y1="-9" x2="9" y2="9" className="current-cross" /><line x1="9" y1="-9" x2="-9" y2="9" className="current-cross" /></>
            : <circle r="6" className="current-dot" />}
          <text y="50" className="source-tag">I {reversed ? 'ENTRA' : 'SALE'}</text>
        </g>}

        {source === 'loop' && <g
          data-drag-target="source"
          className="loop-source source-draggable"
          transform={`translate(${sourcePosition.x} ${sourcePosition.y})`}
          role="button"
          tabIndex={0}
          aria-label="Espira móvil"
          onKeyDown={(event) => moveWithKeyboard('source', event)}
        >
          <ellipse rx="72" ry="112" className="current-loop-shadow" />
          <ellipse rx="72" ry="112" className="current-loop" />
          <path d={reversed ? 'M-16 106L0 116 16 106' : 'M-16-106L0-116 16-106'} className="loop-arrow" />
          <circle cx="0" cy="-112" r="5" className="loop-terminal" />
          <text y="140" className="source-tag">ESPIRA {reversed ? 'HORARIA' : 'ANTIHORARIA'}</text>
        </g>}

        <g
          data-drag-target="probe"
          className="compass-probe"
          transform={`translate(${probe.x} ${probe.y})`}
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

    <div className="scene-live-indicator"><i />CAMPO EN VIVO</div>
    <div className="scene-readout">
      <span>SONDA P-01</span>
      <strong>{influenceLabel}</strong>
      <small>θ {probeAngle.toFixed(1)}° · Δ {sourceDistance.toFixed(0)} px</small>
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
      <strong>{relativeField.toFixed(0)}%</strong>
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
        <span><ScanLine size={14} />Las líneas se recalculan al mover la fuente</span>
        <span>Modelo cualitativo para exploración espacial</span>
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
          {(['magnet', 'electromagnet', 'wire', 'loop'] as Source[]).map((item) => <button
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

      <section className="console-section console-observation">
        <div className="console-section-heading"><span>03</span><div><strong>Experimenta</strong><small>No hay una única posición correcta.</small></div></div>
        <p>Acerca P-01 a un polo, desplaza la fuente y busca dónde cambia más rápido la dirección de la aguja.</p>
        <div><Waves size={15} /><span><b>{strength.toFixed(1)}×</b> excitación actual</span></div>
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
}: {
  states: ReturnType<typeof simulateLorentzTrajectory>
  frame: number
  electricField: Vector2
  magneticField: number
  charge: number
}) {
  const visible = states.slice(0, Math.max(1, frame + 1))
  const trail = visible.slice(-90)
  const allX = states.map((state) => state.position.x)
  const allY = states.map((state) => state.position.y)
  const minX = Math.min(...allX, -1)
  const maxX = Math.max(...allX, 1)
  const minY = Math.min(...allY, -1)
  const maxY = Math.max(...allY, 1)
  const spanX = Math.max(maxX - minX, 2)
  const spanY = Math.max(maxY - minY, 2)
  const scale = Math.min(610 / spanX, 350 / spanY)
  const map = (point: Vector2) => ({
    x: 380 + (point.x - (minX + maxX) / 2) * scale,
    y: 240 - (point.y - (minY + maxY) / 2) * scale,
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
  const motionDescription = totalForceMagnitude < 1e-9
    ? 'Movimiento casi uniforme'
    : Math.abs(magneticField) < .02 ? 'Aceleración por el campo E' : 'Trayectoria curvada por E y B'

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
      <g className="magnetic-field-layer" style={{ opacity: .12 + Math.abs(magneticField) * .22 }}>
        {Array.from({ length: 9 }, (_, row) => Array.from({ length: 14 }, (_, column) => <g key={`${row}-${column}`} className="b-symbol" transform={`translate(${35 + column * 54} ${48 + row * 48})`}>
          {magneticField >= 0
            ? <><circle r="5" /><circle r="1.6" className="filled" /></>
            : <><circle r="5" /><line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" /><line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" /></>}
        </g>))}
      </g>
      {Math.abs(electricField.y) > .01 && <g className="electric-field-layer" style={{ opacity: .18 + Math.abs(electricField.y) * .16 }}>
        {Array.from({ length: 7 }, (_, row) => Array.from({ length: 12 }, (_, column) => <line key={`${row}-${column}`} x1={55 + column * 60} y1={78 + row * 55} x2={55 + column * 60} y2={78 + row * 55 + electricDirection * 15} markerEnd="url(#vector-arrow-blue)" />))}
      </g>}
      <polyline points={points} className="particle-path" />
      <g className="particle-trail">{trail.map((state, index) => {
        const point = map(state.position)
        return <circle key={`${state.time}-${index}`} cx={point.x} cy={point.y} r={1.2 + index / trail.length * 2.4} opacity={.06 + index / trail.length * .48} />
      })}</g>
      <circle cx={particle.x} cy={particle.y} r="28" fill="url(#particleGlow)" className="particle-glow" />
      <circle cx={particle.x} cy={particle.y} r="14" className="particle-pulse" />
      <circle cx={particle.x} cy={particle.y} r="10" className={charge >= 0 ? 'particle-positive' : 'particle-negative'} />
      <text x={particle.x} y={particle.y + 3.5} className="particle-sign">{charge >= 0 ? '+' : '−'}</text>
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
    chargeCoulombs: charge * 1e-6,
    massKg: mass * 1e-6,
    electricField: { x: 0, y: electric },
    magneticFieldTesla: magnetic,
    initialPosition: { x: 0, y: 0 },
    initialVelocity: { x: velocity, y: 0 },
    durationSeconds: duration,
    steps: 650,
  }), [charge, duration, electric, magnetic, mass, velocity])
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
    setFrame(0)
    setPlaying(false)
  }

  const applyLorentzPreset = (preset: 'circular' | 'crossed' | 'selector' | 'negative') => {
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
    <div className="magnetic-workbench">
      <aside className="experiment-rail">
        <div className="rail-heading"><span>UNIDAD 04</span><strong>Banco de magnetismo</strong><small>Dos estaciones de experimentación conectadas.</small></div>
        <nav aria-label="Estaciones del módulo 4">
          <button className={tool === 'field' ? 'active' : ''} onClick={() => setTool('field')} aria-current={tool === 'field' ? 'page' : undefined}>
            <span className="rail-index">01</span><Compass size={20} /><span><strong>Cartografía de B</strong><small>Fuente, líneas y sonda</small></span>
          </button>
          <button className={tool === 'lorentz' ? 'active' : ''} onClick={() => setTool('lorentz')} aria-current={tool === 'lorentz' ? 'page' : undefined}>
            <span className="rail-index">02</span><Zap size={20} /><span><strong>Cámara de Lorentz</strong><small>Trayectoria y fuerzas</small></span>
          </button>
        </nav>
        <div className="rail-gestures"><Move size={16} /><span><strong>Espacio manipulable</strong><small>Arrastra, amplía, desplaza y cambia los parámetros.</small></span></div>
        <div className="rail-engine"><i /><span>Motor físico activo</span></div>
      </aside>

      <section className="workbench-main">
        <header className="workbench-header">
          <div><span>EXPERIMENTO {tool === 'field' ? '01 · MAPA VECTORIAL' : '02 · DINÁMICA DE PARTÍCULAS'}</span><h3>{tool === 'field' ? 'Cartografía interactiva del campo magnético' : 'Cámara de movimiento bajo fuerza de Lorentz'}</h3><p>{tool === 'field' ? 'El espacio de trabajo se recalcula con cada movimiento de la fuente y la sonda.' : 'Modifica E, B, q, m y v; después controla la simulación sobre la línea de tiempo.'}</p></div>
          <div className="workbench-badges"><span><ScanLine size={14} />Tiempo real</span><span><Maximize2 size={14} />Lienzo ampliable</span></div>
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
            <LorentzScene states={states} frame={frame} electricField={parameters.electricField} magneticField={magnetic} charge={charge} />
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
            <div className="lorentz-presets"><span>ESCENARIOS DE REFERENCIA</span><div><button onClick={() => applyLorentzPreset('circular')}>Órbita circular</button><button onClick={() => applyLorentzPreset('crossed')}>Campos cruzados</button><button onClick={() => applyLorentzPreset('selector')}>Selector v = E/B</button><button onClick={() => applyLorentzPreset('negative')}>Carga negativa</button></div></div>
            <Range label="Campo eléctrico Eᵧ" value={electric} min={-3} max={3} step={.1} unit="V/m" onChange={setElectric} />
            <Range label="Campo magnético Bᶻ" value={magnetic} min={-2} max={2} step={.1} unit="T" onChange={setMagnetic} />
            <Range label="Velocidad inicial vₓ" value={velocity} min={.5} max={8} step={.1} unit="m/s" onChange={setVelocity} />
            <div className="charge-switch" aria-label="Signo de la carga"><button className={charge > 0 ? 'active positive' : ''} onClick={() => setCharge(Math.max(.5, Math.abs(charge)))}>+ Positiva</button><button className={charge < 0 ? 'active negative' : ''} onClick={() => setCharge(-Math.max(.5, Math.abs(charge)))}>− Negativa</button></div>
            <div className="particle-inputs"><label>Carga q<div><NumericInput min={-5} max={5} step={0.5} value={charge} onValueChange={setCharge} /><span>µC</span></div></label><label>Masa m<div><NumericInput min={0.1} max={10} step={0.1} value={mass} onValueChange={setMass} /><span>mg</span></div></label></div>
            <Range label="Duración" value={duration} min={2} max={20} step={1} unit="s" onChange={setDuration} />
            <div className="lorentz-readouts"><div className="total-reading"><span>|F TOTAL|</span><strong>{(Math.hypot(current.force.x, current.force.y) * 1e6).toFixed(2)} <small>µN</small></strong></div><div><span>|F ELÉCTRICA|</span><strong>{(Math.hypot(electricForceNow.x, electricForceNow.y) * 1e6).toFixed(2)} <small>µN</small></strong></div><div><span>|F MAGNÉTICA|</span><strong>{(Math.hypot(magneticForceNow.x, magneticForceNow.y) * 1e6).toFixed(2)} <small>µN</small></strong></div><div><span>|v| ACTUAL</span><strong>{Math.hypot(current.velocity.x, current.velocity.y).toFixed(2)} <small>m/s</small></strong></div><div><span>DERIVA E×B</span><strong>{Math.hypot(drift.x, drift.y).toFixed(2)} <small>m/s</small></strong></div><div><span>PERIODO</span><strong>{Number.isFinite(period) ? period.toFixed(2) : '∞'} <small>s</small></strong></div></div>
            <div className="lorentz-equation"><span>DESCOMPOSICIÓN DE LA FUERZA</span><strong>F⃗ = F⃗ᴱ + F⃗ᴮ</strong><div><code>F⃗ᴱ = qE⃗</code><code>F⃗ᴮ = q(v⃗ × B⃗)</code></div><p><b>Fᴱ</b> cambia la rapidez. <b>Fᴮ</b> actúa perpendicularmente y curva la trayectoria.</p></div>
          </aside>
        </div>}
      </section>
    </div>
  </div>
}
