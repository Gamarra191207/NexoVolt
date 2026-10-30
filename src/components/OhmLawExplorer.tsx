import { useMemo, useState, type CSSProperties } from 'react'
import { Activity, BatteryCharging, Gauge, Shield } from 'lucide-react'
import './ohm-law-explorer.css'

const format = (value: number, decimals = 1) => Number(value.toFixed(decimals)).toString()

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
  const resistanceLevel = ((resistance - 4) / 36) * 100
  const currentLevel = Math.min(100, (current / 6) * 100)
  const flowDuration = Math.max(.55, Math.min(4, 2.7 / Math.max(current, .15)))

  const tendency = useMemo(() => {
    if (current > 2.5) return { word: 'Alto', className: 'high', dots: 9 }
    if (current > .8) return { word: 'Medio', className: 'medium', dots: 6 }
    return { word: 'Bajo', className: 'low', dots: 3 }
  }, [current])

  const indicators = [
    { symbol: 'V', name: 'Voltaje', caption: 'Empuje eléctrico', value: voltageLevel, reading: `${voltage} V`, icon: <BatteryCharging size={17} />, tone: 'voltage' },
    { symbol: 'I', name: 'Corriente', caption: 'Flujo de carga', value: currentLevel, reading: `${format(current, 2)} A`, icon: <Activity size={17} />, tone: 'current' },
    { symbol: 'R', name: 'Resistencia', caption: 'Oposición al paso', value: resistanceLevel, reading: `${resistance} Ω`, icon: <Shield size={17} />, tone: 'resistance' },
  ]

  return <div className="ohm-explorer">
    <section className="relation-header">
      <div><span className="section-kicker">RELACIÓN ENTRE VARIABLES</span><h3>Ley de Ohm</h3></div>
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
          <div className="gauge-body"><div className="gauge-fill" style={{ height: `${Math.max(5, indicator.value)}%` }} /><div className="gauge-lines"><i /><i /><i /><i /></div></div>
          <strong>{indicator.reading}</strong>
          {index < indicators.length - 1 && <span className={`variable-link ${index === 0 ? 'same' : 'opposite'}`} aria-hidden="true"><i>↕</i></span>}
        </div>)}
      </div>

      <div className="relationship-summary">
        <div className="same"><span>V</span><i>↑</i><span>I</span><strong>Mismo sentido</strong><small>Si aumenta el empuje, aumenta el flujo.</small></div>
        <div className="opposite"><span>R</span><i>↑</i><span>I</span><i>↓</i><strong>Sentido contrario</strong><small>Si aumenta la oposición, disminuye el flujo.</small></div>
      </div>
    </section>

    <section className="relation-circuit">
      <div className="relation-circuit-heading"><div><Gauge size={16} /><span><b>Flujo en el circuito</b><small>Las partículas se mueven más rápido cuando la corriente aumenta.</small></span></div><span className={`flow-state ${tendency.className}`}><i />Flujo {tendency.word}</span></div>
      <svg viewBox="0 0 760 230" role="img" aria-label={`Circuito con voltaje de ${voltage} voltios, resistencia de ${resistance} ohmios y flujo ${tendency.word.toLowerCase()}`}>
        <path className="relation-wire" d="M102 58H650V174H102V58" />
        <g className="relation-battery" transform="translate(76 88)"><rect width="52" height="56" rx="11"/><path d="M16 19h20M26 10v18M17 40h18"/><text x="26" y="75" textAnchor="middle">{voltage} V</text></g>
        <g className="relation-resistor" transform="translate(322 35)"><rect width="142" height="46" rx="11"/><path d="M15 23h15l9-13 16 26 16-26 16 26 16-26 10 13h14"/><text x="71" y="-9" textAnchor="middle">{resistance} Ω</text></g>
        <g className="relation-charge-flow">{Array.from({ length: tendency.dots }, (_, index) => <circle key={index} r="6"><animateMotion dur={`${flowDuration}s`} repeatCount="indefinite" begin={`${index * -.34}s`} path="M135 174H650V58H135" /></circle>)}</g>
        <g className="relation-current-label"><path d="M164 34h76"/><path d="m230 26 11 8-11 8"/><text x="187" y="21">Corriente {tendency.word.toLowerCase()}</text></g>
      </svg>
    </section>
  </div>
}
