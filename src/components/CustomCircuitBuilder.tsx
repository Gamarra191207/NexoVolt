import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import {
  BatteryCharging, GitBranch, Lightbulb, Plus, RotateCcw,
  ToggleRight, Trash2,
} from 'lucide-react'
import {
  solveConstructedCircuit,
  type CustomCircuitBranch,
  type CustomCircuitComponent,
  type CustomComponentKind,
} from '../physics/circuits'
import NumericInput from './NumericInput'
import ResultPanel from './ResultPanel'
import './custom-circuit-builder.css'

type Draft = Omit<CustomCircuitComponent, 'id'>
type Template = { id: string; name: string; description: string; series: Draft[]; branches: Draft[][] }
type Selection = { area: 'series' | 'branch'; branchId?: string; componentId: string }

const defaults: Record<CustomComponentKind, Draft> = {
  resistor: { kind: 'resistor', resistance: 20, label: 'Resistencia' },
  lamp: { kind: 'lamp', resistance: 40, label: 'Foco' },
  switch: { kind: 'switch', resistance: 0, closed: true, label: 'Interruptor' },
}

const templates: Template[] = [
  { id: 'blank', name: 'En blanco', description: 'Crea tu propio cableado.', series: [], branches: [] },
  { id: 'series', name: 'Serie', description: 'Una sola trayectoria.', series: [
    { kind: 'resistor', resistance: 10, label: 'R1' }, { kind: 'resistor', resistance: 20, label: 'R2' }, { kind: 'resistor', resistance: 30, label: 'R3' },
  ], branches: [] },
  { id: 'parallel', name: 'Paralelo', description: 'Tres caminos de corriente.', series: [], branches: [
    [{ kind: 'resistor', resistance: 10, label: 'R1' }], [{ kind: 'resistor', resistance: 20, label: 'R2' }], [{ kind: 'resistor', resistance: 30, label: 'R3' }],
  ] },
  { id: 'mixed', name: 'Mixto', description: 'Serie seguida de paralelo.', series: [
    { kind: 'resistor', resistance: 10, label: 'R1' },
  ], branches: [[{ kind: 'resistor', resistance: 20, label: 'R2' }], [{ kind: 'resistor', resistance: 30, label: 'R3' }]] },
  { id: 'lighting', name: 'Iluminación', description: 'Focos con control propio.', series: [], branches: [
    [{ kind: 'switch', resistance: 0, closed: true, label: 'S1' }, { kind: 'lamp', resistance: 40, label: 'Foco 1' }],
    [{ kind: 'switch', resistance: 0, closed: false, label: 'S2' }, { kind: 'lamp', resistance: 40, label: 'Foco 2' }],
  ] },
]

let idCounter = 1
const id = (prefix: string) => `${prefix}-${idCounter++}`
const componentFrom = (draft: Draft): CustomCircuitComponent => ({ ...draft, id: id(draft.kind) })
const branchFrom = (drafts: Draft[]): CustomCircuitBranch => ({ id: id('branch'), components: drafts.map(componentFrom) })
const instantiate = (template: Template) => ({ series: template.series.map(componentFrom), branches: template.branches.map(branchFrom) })
const format = (value: number, decimals = 2) => Number.isFinite(value) ? value.toFixed(decimals) : '∞'

function componentAnimationStyle(current: number, resistance = 0) {
  const amps = Number.isFinite(current) ? Math.abs(current) : 0
  const power = amps ** 2 * Math.max(0, resistance)
  const energyLevel = power / (power + 4)
  return {
    '--component-flow-period': `${amps > .0001 ? Math.max(.35, Math.min(3.2, 1.2 / amps)) : 3.2}s`,
    '--component-glow': (0.12 + energyLevel * 0.5).toFixed(3),
  } as CSSProperties
}

function MiniDiagram({ template }: { template: Template }) {
  return <span className="wire-template-icon"><i className="wire-template-top">{template.series.map((component, index) => <b className={component.kind} key={index} />)}</i>{template.branches.map((branch, branchIndex) => <i className="wire-template-branch" key={branchIndex}>{branch.map((component, index) => <b className={component.kind} key={index} />)}</i>)}</span>
}

function SchematicSymbol({ component, vertical = false, energized = false }: { component: CustomCircuitComponent; vertical?: boolean; energized?: boolean }) {
  if (component.kind === 'lamp') return <g className={`svg-lamp ${energized ? 'is-on' : 'is-off'}`}>
    <circle className="lamp-glow" cx="0" cy="0" r="23" />
    <circle className="lamp-bulb" cx="0" cy="0" r="17" />
    <path className="lamp-filament" d="M-10-10 10 10M10-10-10 10" />
    <path className="lamp-rays" d="M0-22v-4M22 0h4M0 22v4M-22 0h-4" />
  </g>
  if (component.kind === 'switch') return <g className={`svg-switch ${component.closed ? 'closed' : 'open'} ${energized ? 'is-energized' : ''}`}>
    <circle className="switch-contact" cx={vertical ? 0 : -20} cy={vertical ? -20 : 0} r="4" />
    <circle className="switch-contact" cx={vertical ? 0 : 20} cy={vertical ? 20 : 0} r="4" />
    <path className="switch-lever" d={vertical
      ? (component.closed ? 'M0-20V20' : 'M0-20L12 14')
      : (component.closed ? 'M-20 0H20' : 'M-20 0L14-12')
    } />
  </g>
  return <g className={`svg-resistor ${vertical ? 'vertical' : 'horizontal'} ${energized ? 'is-energized' : 'is-idle'}`}>
    <path className="resistor-symbol" d={vertical ? 'M0-28v7l-9 6 18 10-18 10 18 10-9 6v7' : 'M-28 0h7l6-9 10 18L5-9l10 18 6-9h7'} />
    <circle className="resistor-terminal" cx={vertical ? 0 : -28} cy={vertical ? -28 : 0} r="2.5" />
    <circle className="resistor-terminal" cx={vertical ? 0 : 28} cy={vertical ? 28 : 0} r="2.5" />
  </g>
}

function CircuitSchematic({ series, branches, selection, onSelect, voltage, totalCurrent, branchCurrents }: {
  series: CustomCircuitComponent[]
  branches: CustomCircuitBranch[]
  selection: Selection | null
  onSelect: (selection: Selection) => void
  voltage: number
  totalCurrent: number
  branchCurrents: number[]
}) {
  const left = 75, right = 705, top = 82, bottom = 326
  const seriesCenters = series.map((_, index) => 170 + index * 92)
  const split = series.length ? Math.min(475, 130 + series.length * 92) : 215
  const branchCenters = branches.map((_, index) => split + ((right - split) * (index + 1)) / (branches.length + 1))
  const isBlank = series.length === 0 && branches.length === 0
  const activate = (event: KeyboardEvent<SVGGElement>, next: Selection) => { if (event.key === 'Enter' || event.key === ' ') onSelect(next) }

  return <svg className={`construction-schematic ${Number.isFinite(totalCurrent) && totalCurrent > .0001 ? 'is-live' : 'is-idle'}`} style={componentAnimationStyle(totalCurrent)} viewBox="0 0 780 410" role="img" aria-label="Diagrama del circuito construido">
    <defs><marker id="current-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 8 4 0 8" /></marker></defs>
    <path className="schematic-wire" d={`M${left} 173V${top}H${seriesCenters[0] ? seriesCenters[0] - 32 : isBlank ? split - 30 : split}`} />
    {series.map((component, index) => {
      const center = seriesCenters[index]
      const selected = selection?.area === 'series' && selection.componentId === component.id
      const energized = Number.isFinite(totalCurrent) && totalCurrent > .0001
      const nextStart = index === series.length - 1 ? split : seriesCenters[index + 1] - 32
      return <g key={component.id}>
        <g className={`schematic-component horizontal ${component.kind} ${energized ? 'energized' : 'deenergized'} ${selected ? 'selected' : ''}`} style={componentAnimationStyle(totalCurrent, component.resistance)} role="button" tabIndex={0} onClick={() => onSelect({ area: 'series', componentId: component.id })} onKeyDown={(event) => activate(event, { area: 'series', componentId: component.id })} transform={`translate(${center} ${top})`}><rect x="-32" y="-32" width="64" height="64" rx="8" /><SchematicSymbol component={component} energized={energized} /><text y="-41" textAnchor="middle">{component.label} · {component.kind === 'switch' ? (component.closed ? 'cerrado' : 'abierto') : `${component.resistance} Ω`}</text></g>
        <path className="schematic-wire" d={`M${center + 32} ${top}H${nextStart}`} />
      </g>
    })}
    <path className="schematic-wire" d={`M${isBlank ? split + 30 : split} ${top}H${right}V${bottom}H${left}V237`} />
    <g className="schematic-battery circuit-style-source" transform={`translate(${left} 205)`}><rect x="-32" y="-32" width="64" height="64" rx="8" /><circle className="source-terminal" cx="0" cy="-32" r="2.5" /><circle className="source-terminal" cx="0" cy="32" r="2.5" /><path className="source-positive" d="M-10-10H10M0-20V0" /><path className="source-negative" d="M-10 16H10" /><text x="-42" y="4" textAnchor="end">Fuente</text><text className="source-voltage" x="0" y="49" textAnchor="middle">{voltage} V</text></g>
    <path className="total-current-arrow" d={`M110 ${top - 38}H165`} markerEnd="url(#current-arrow)" /><text className="current-label" x="137" y={top - 48} textAnchor="middle">I total · {format(totalCurrent, 3)} A</text>
    {isBlank ? <g className="blank-circuit-gap"><circle cx={split - 30} cy={top} r="4" /><circle cx={split + 30} cy={top} r="4" /><text x={split} y={top + 28} textAnchor="middle">Añade un componente</text></g> : <><circle className="junction-node" cx={split} cy={top} r="5" /><circle className="junction-node" cx={split} cy={bottom} r="5" /></>}

    {branches.map((branch, branchIndex) => {
      const x = branchCenters[branchIndex]
      const count = branch.components.length
      const centers = branch.components.map((_, index) => top + ((bottom - top) * (index + 1)) / (count + 1))
      return <g key={branch.id}>
        {count === 0 ? <g className="empty-branch-gap"><path className="schematic-wire branch-wire-svg inactive" d={`M${x} ${top}V${top + 75}M${x} ${bottom - 75}V${bottom}`} /><circle cx={x} cy={top + 75} r="4" /><circle cx={x} cy={bottom - 75} r="4" /><text x={x + 12} y={(top + bottom) / 2}>Rama vacía</text></g> : <path className={`schematic-wire branch-wire-svg ${branchCurrents[branchIndex] === 0 ? 'inactive' : ''}`} d={`M${x} ${top}V${centers[0] - 32}`} />}
        <circle className="junction-node" cx={x} cy={top} r="5" /><circle className="junction-node" cx={x} cy={bottom} r="5" />
        {branch.components.map((component, componentIndex) => {
          const y = centers[componentIndex]
          const selected = selection?.area === 'branch' && selection.branchId === branch.id && selection.componentId === component.id
          const energized = Number.isFinite(branchCurrents[branchIndex]) && branchCurrents[branchIndex] > .0001
          const next = componentIndex === count - 1 ? bottom : centers[componentIndex + 1] - 32
          const nextSelection: Selection = { area: 'branch', branchId: branch.id, componentId: component.id }
          return <g key={component.id}>
            <g className={`schematic-component vertical ${component.kind} ${energized ? 'energized' : 'deenergized'} ${selected ? 'selected' : ''}`} style={componentAnimationStyle(branchCurrents[branchIndex], component.resistance)} role="button" tabIndex={0} onClick={() => onSelect(nextSelection)} onKeyDown={(event) => activate(event, nextSelection)} transform={`translate(${x} ${y})`}><rect x="-32" y="-32" width="64" height="64" rx="8" /><SchematicSymbol component={component} vertical energized={energized} /><text transform="translate(42 0) rotate(90)" textAnchor="middle">{component.label} · {component.kind === 'switch' ? (component.closed ? 'cerrado' : 'abierto') : `${component.resistance} Ω`}</text></g>
            <path className={`schematic-wire branch-wire-svg ${branchCurrents[branchIndex] === 0 ? 'inactive' : ''}`} d={`M${x} ${y + 32}V${next}`} />
          </g>
        })}
        <text className="branch-current-label" x={x} y={bottom + 25} textAnchor="middle">I{branchIndex + 1} · {format(branchCurrents[branchIndex], 3)} A</text>
      </g>
    })}
    <text className="rail-label" x={right - 7} y={top - 13} textAnchor="end">Nodo de distribución</text><text className="rail-label" x={right - 7} y={bottom - 13} textAnchor="end">Retorno común</text>
  </svg>
}

export default function CustomCircuitBuilder() {
  const initial = templates.find((template) => template.id === 'mixed')!
  const [voltage, setVoltage] = useState(12)
  const [series, setSeries] = useState<CustomCircuitComponent[]>(() => instantiate(initial).series)
  const [branches, setBranches] = useState<CustomCircuitBranch[]>(() => instantiate(initial).branches)
  const [activeTemplate, setActiveTemplate] = useState(initial.id)
  const [target, setTarget] = useState('series')
  const [selection, setSelection] = useState<Selection | null>(null)
  const results = useMemo(() => solveConstructedCircuit(voltage, series, branches), [voltage, series, branches])

  const selectedComponent = selection?.area === 'series'
    ? series.find((component) => component.id === selection.componentId)
    : branches.find((branch) => branch.id === selection?.branchId)?.components.find((component) => component.id === selection?.componentId)
  const selectedBranchIndex = selection?.area === 'branch' ? branches.findIndex((branch) => branch.id === selection.branchId) : -1
  const selectedCurrent = selection?.area === 'series' ? results.totalCurrent : (results.branches[selectedBranchIndex]?.current ?? 0)
  const targetFull = target === 'series'
    ? series.length >= 3
    : (branches.find((branch) => branch.id === target)?.components.length ?? 3) >= 3

  const loadTemplate = (template: Template) => {
    const next = instantiate(template); setSeries(next.series); setBranches(next.branches); setActiveTemplate(template.id); setTarget('series'); setSelection(null)
  }
  const addBranch = () => {
    if (branches.length >= 4) return
    const branch = branchFrom([]); setBranches((current) => [...current, branch]); setTarget(branch.id); setActiveTemplate('')
  }
  const addComponent = (kind: CustomComponentKind) => {
    if (targetFull) return
    const component = componentFrom(defaults[kind])
    if (target === 'series') {
      if (series.length >= 3) return
      setSeries((current) => [...current, component]); setSelection({ area: 'series', componentId: component.id })
    } else {
      setBranches((current) => current.map((branch) => branch.id === target && branch.components.length < 3 ? { ...branch, components: [...branch.components, component] } : branch))
      setSelection({ area: 'branch', branchId: target, componentId: component.id })
    }
    setActiveTemplate('')
  }
  const updateSelected = (patch: Partial<CustomCircuitComponent>) => {
    if (!selection) return
    if (selection.area === 'series') setSeries((current) => current.map((component) => component.id === selection.componentId ? { ...component, ...patch } : component))
    else setBranches((current) => current.map((branch) => branch.id === selection.branchId ? { ...branch, components: branch.components.map((component) => component.id === selection.componentId ? { ...component, ...patch } : component) } : branch))
    setActiveTemplate('')
  }
  const removeSelected = () => {
    if (!selection) return
    if (selection.area === 'series') setSeries((current) => current.filter((component) => component.id !== selection.componentId))
    else setBranches((current) => current.map((branch) => branch.id === selection.branchId ? { ...branch, components: branch.components.filter((component) => component.id !== selection.componentId) } : branch))
    setSelection(null); setActiveTemplate('')
  }
  const removeBranch = (branchId: string) => {
    setBranches((current) => current.filter((branch) => branch.id !== branchId)); if (target === branchId) setTarget('series'); if (selection?.branchId === branchId) setSelection(null); setActiveTemplate('')
  }
  const moveSelected = (destination: string) => {
    if (!selectedComponent || !selection || destination === (selection.area === 'series' ? 'series' : selection.branchId)) return
    if (destination === 'series' && series.length >= 3) return
    if (destination !== 'series' && (branches.find((branch) => branch.id === destination)?.components.length ?? 3) >= 3) return
    const moving = selectedComponent
    if (selection.area === 'series') setSeries((current) => current.filter((component) => component.id !== moving.id))
    else setBranches((current) => current.map((branch) => branch.id === selection.branchId ? { ...branch, components: branch.components.filter((component) => component.id !== moving.id) } : branch))
    if (destination === 'series') { setSeries((current) => current.length < 3 ? [...current, moving] : current); setSelection({ area: 'series', componentId: moving.id }) }
    else { setBranches((current) => current.map((branch) => branch.id === destination && branch.components.length < 3 ? { ...branch, components: [...branch.components, moving] } : branch)); setSelection({ area: 'branch', branchId: destination, componentId: moving.id }) }
    setActiveTemplate('')
  }

  return <div className="wired-builder">
    <section className="wired-templates"><div className="wired-section-title"><strong>Circuitos</strong></div><div className="wired-template-list">{templates.map((template) => <button key={template.id} className={activeTemplate === template.id ? 'active' : ''} onClick={() => loadTemplate(template)}><MiniDiagram template={template} /><span><strong>{template.name}</strong><small>{template.description}</small></span></button>)}</div></section>

    <div className="wired-layout">
      <section className="wired-main-panel">
        <header className="wired-toolbar"><div><strong>Agregar componente en</strong><select value={target} onChange={(event) => setTarget(event.target.value)}><option value="series">Línea principal (serie)</option>{branches.map((branch, index) => <option value={branch.id} key={branch.id}>Rama {index + 1} (paralelo)</option>)}</select></div><span className="toolbar-divider" /><button className="component-tool resistor-tool" disabled={targetFull} onClick={() => addComponent('resistor')}><span className="toolbar-resistor">/\/\/</span>Resistencia</button><button className="component-tool lamp-tool" disabled={targetFull} onClick={() => addComponent('lamp')}><Lightbulb size={14} />Foco</button><button className="component-tool switch-tool" disabled={targetFull} onClick={() => addComponent('switch')}><ToggleRight size={14} />Interruptor</button><button className="toolbar-new" onClick={() => loadTemplate(templates[0])}><RotateCcw size={13} />Nuevo</button></header>
        <div className="wired-canvas"><div className="canvas-heading"><span><i />DIAGRAMA DEL CIRCUITO</span></div><CircuitSchematic series={series} branches={branches} selection={selection} onSelect={setSelection} voltage={voltage} totalCurrent={results.totalCurrent} branchCurrents={results.branches.map((branch) => branch.current)} /><div className="canvas-legend"><span><i className="wire-sample" />Conductor</span><span><i className="node-sample" />Nodo</span><span><i className="current-sample" />Corriente</span></div></div>
        <div className="branch-management"><div><GitBranch size={14} /><span><strong>Ramas en paralelo</strong><small>Cada rama conecta el nodo superior con el retorno</small></span></div><div className="branch-chips">{branches.map((branch, index) => <span key={branch.id}>Rama {index + 1}<button aria-label={`Eliminar rama ${index + 1}`} onClick={() => removeBranch(branch.id)}>×</button></span>)}<button onClick={addBranch} disabled={branches.length >= 4}><Plus size={12} />Añadir rama</button></div></div>

        {selectedComponent && selection && <section className="component-inspector"><div className={`inspector-icon ${selectedComponent.kind}`}><svg viewBox="-38 -30 76 60" style={componentAnimationStyle(selectedCurrent, selectedComponent.resistance)} aria-hidden="true"><SchematicSymbol component={selectedComponent} energized={Number.isFinite(selectedCurrent) && selectedCurrent > .0001} /></svg></div><div className="inspector-heading"><span>COMPONENTE SELECCIONADO</span><strong>{selectedComponent.label}</strong></div>{selectedComponent.kind === 'switch' ? <button className={`inspector-switch ${selectedComponent.closed ? 'closed' : ''}`} onClick={() => updateSelected({ closed: !selectedComponent.closed })}>{selectedComponent.closed ? 'Cerrado · circula corriente' : 'Abierto · interrumpe corriente'}</button> : <label className="inspector-value"><span>Resistencia</span><div><NumericInput min={1} max={500} value={selectedComponent.resistance} onValueChange={(resistance) => updateSelected({ resistance })} /><em>Ω</em></div></label>}<label className="inspector-move"><span>Ubicación</span><select value={selection.area === 'series' ? 'series' : selection.branchId} onChange={(event) => moveSelected(event.target.value)}><option value="series">Línea principal</option>{branches.map((branch, index) => <option value={branch.id} key={branch.id}>Rama {index + 1}</option>)}</select></label><button className="inspector-delete" onClick={removeSelected}><Trash2 size={13} />Eliminar</button></section>}
      </section>

      <aside className="wired-side-panel"><section className="wired-source-card"><div><BatteryCharging size={17} /><span><strong>Fuente DC</strong><small>Voltaje aplicado</small></span><output>{voltage} V</output></div><input type="range" min="1" max="48" value={voltage} aria-label="Voltaje de la fuente" style={{ '--range': `${((voltage - 1) / 47) * 100}%` } as CSSProperties} onChange={(event) => setVoltage(Number(event.target.value))} /></section><ResultPanel
        className="wired-results-card"
        title="Resultados del circuito"
        status={results.isComplete ? 'Circuito cerrado' : 'Circuito abierto'}
        statusTone={results.isComplete ? 'ready' : 'warning'}
        primaryLabel="Resistencia equivalente"
        primaryValue={<>{results.isComplete ? format(results.equivalentResistance) : '—'} {results.isComplete && <small>Ω</small>}</>}
        primaryDetail={results.isComplete ? 'Equivalente visto por la fuente' : 'Completa una trayectoria para calcular'}
        metrics={[
          { label: 'Corriente total', value: `${format(results.totalCurrent, 3)} A` },
          { label: 'Potencia total', value: `${format(results.totalPower)} W` },
          { label: 'Voltaje en paralelo', value: `${format(results.parallelVoltage)} V`, wide: true },
        ]}
      /></aside>
    </div>
  </div>
}
