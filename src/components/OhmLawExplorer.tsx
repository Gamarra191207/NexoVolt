import { useMemo, useState, type CSSProperties } from 'react'
import { Activity, BatteryCharging, Shield } from 'lucide-react'
import ResultPanel from './ResultPanel'
import './ohm-law-explorer.css'

const format = (value: number, decimals = 1) => Number(value.toFixed(decimals)).toString()
const MAX_CURRENT = 24 / 4
const CHARGE_MARKER_COUNT = 8
const FLOW_DURATION_AT_ONE_AMP = 3

function RelationControl({ label, value, unit, min, max, onChange }: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const progress = ((value - min) / (max - min)) * 100
  return <label className="relation-control">
    <span><b>{label}</b></span>
    <output>{value} {unit}</output>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      style={{ '--progress': `${progress}%` } as CSSProperties}
    />
    <span className="relation-scale"><i>Bajo</i><i>Alto</i></span>
  </label>
}

export default function OhmLawExplorer() {
  const [voltage, setVoltage] = useState(12)
  const [resistance, setResistance] = useState(12)
  const current = voltage / resistance
  const voltageLevel = (voltage / 24) * 100
  const resistanceLevel = (resistance / 40) * 100
  const currentLevel = (current / MAX_CURRENT) * 100
  // With the conductor geometry fixed, drift speed is proportional to I.
  // Therefore one circuit lap takes a time inversely proportional to V / R.
  const flowDuration = FLOW_DURATION_AT_ONE_AMP / current

  const tendency = useMemo(() => {
    if (current > 2.5) return { word: 'Alto' }
    if (current > .8) return { word: 'Medio' }
    return { word: 'Bajo' }
  }, [current])

  const indicators = [
    { symbol: 'V', name: 'Voltaje', caption: 'Empuje eléctrico', value: voltageLevel, reading: `${voltage} V`, icon: <BatteryCharging size={17} />, tone: 'voltage' },
    { symbol: 'I', name: 'Corriente', caption: 'Flujo de carga', value: currentLevel, reading: `${format(current, 2)} A`, icon: <Activity size={17} />, tone: 'current' },
    { symbol: 'R', name: 'Resistencia', caption: 'Oposición al paso', value: resistanceLevel, reading: `${resistance} Ω`, icon: <Shield size={17} />, tone: 'resistance' },
  ]

  return <div className="ohm-explorer">
    <section className="relation-header">
      <div><h3>Ley de Ohm</h3></div>
      <div className="relation-legend"><span><i className="same" />Cambian en el mismo sentido</span><span><i className="opposite" />Cambian en sentido contrario</span></div>
    </section>

    <section className="relation-controls" aria-label="Controles de las variables">
      <RelationControl label="Voltaje (V)" value={voltage} unit="V" min={1} max={24} onChange={setVoltage} />
      <RelationControl label="Resistencia (R)" value={resistance} unit="Ω" min={4} max={40} onChange={setResistance} />
    </section>

    <section className="relation-stage">
      <div className="variable-gauges">
        {indicators.map((indicator, index) => <div className={`variable-gauge ${indicator.tone}`} key={indicator.symbol}>
          <div className="gauge-heading"><span>{indicator.icon}</span><div><b>{indicator.symbol} · {indicator.name}</b><small>{indicator.caption}</small></div></div>
          <div className="gauge-body"><div className="gauge-fill" style={{ height: `${indicator.value}%` }} /><div className="gauge-lines"><i /><i /><i /><i /></div></div>
          <strong>{indicator.reading}</strong>
          {index < indicators.length - 1 && <span className={`variable-link ${index === 0 ? 'same' : 'opposite'}`} aria-hidden="true"><i>↕</i></span>}
        </div>)}
      </div>

      <ResultPanel
        className="ohm-result-summary"
        title="Resultado de la relación"
        status={`Flujo ${tendency.word.toLowerCase()}`}
        primaryLabel="Corriente calculada"
        primaryValue={<>{format(current, 2)} <small>A</small></>}
        metrics={[
          { label: 'Voltaje', value: `${voltage} V` },
          { label: 'Resistencia', value: `${resistance} Ω` },
          { label: 'Potencia', value: `${format(voltage * current, 2)} W`, wide: true },
        ]}
      />
    </section>

    <section className="relation-circuit" style={{ '--component-flow-period': `${flowDuration}s` } as CSSProperties}>
      <svg viewBox="0 0 760 230" role="img" aria-label={`Circuito con voltaje de ${voltage} voltios, resistencia de ${resistance} ohmios y flujo ${tendency.word.toLowerCase()}`}>
        <path className="relation-wire" d="M102 58H650V174H102V58" />
        <g className="relation-battery circuit-style-component" transform="translate(102 116)"><rect x="-32" y="-32" width="64" height="64" rx="8"/><circle className="source-terminal" cx="0" cy="-32" r="2.5"/><circle className="source-terminal" cx="0" cy="32" r="2.5"/><path className="relation-source-positive" d="M-10-10H10M0-20V0"/><path className="relation-source-negative" d="M-10 16H10"/><text y="49" textAnchor="middle">{voltage} V</text></g>
        <g className="relation-resistor circuit-style-component" transform="translate(393 58)"><rect x="-32" y="-32" width="64" height="64" rx="8"/><g className="svg-resistor horizontal is-energized"><path className="resistor-symbol" d="M-28 0h7l6-9 10 18L5-9l10 18 6-9h7"/><circle className="resistor-terminal" cx="-28" cy="0" r="2.5"/><circle className="resistor-terminal" cx="28" cy="0" r="2.5"/></g><text y="-41" textAnchor="middle">{resistance} Ω</text></g>
        <g className="relation-charge-flow">{Array.from({ length: CHARGE_MARKER_COUNT }, (_, index) => <circle key={index} r="6"><animateMotion dur={`${flowDuration}s`} repeatCount="indefinite" begin={index === 0 ? '0s' : `-${((flowDuration * index) / CHARGE_MARKER_COUNT).toFixed(3)}s`} calcMode="linear" path="M135 58H650V174H135" /></circle>)}</g>
        <g className="relation-current-label"><path d="M164 34h76"/><path d="m230 26 11 8-11 8"/><text x="187" y="21">Corriente {tendency.word.toLowerCase()}</text></g>
      </svg>
    </section>
  </div>
}
