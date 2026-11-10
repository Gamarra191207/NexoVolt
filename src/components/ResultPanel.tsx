import type { ReactNode } from 'react'

export type ResultMetric = {
  label: string
  value: ReactNode
  detail?: ReactNode
  wide?: boolean
}

type ResultPanelProps = {
  title: string
  status?: ReactNode
  statusTone?: 'ready' | 'warning'
  primaryLabel: string
  primaryValue: ReactNode
  primaryDetail?: ReactNode
  metrics: readonly ResultMetric[]
  note?: ReactNode
  className?: string
}

export default function ResultPanel({
  title,
  status,
  statusTone = 'ready',
  primaryLabel,
  primaryValue,
  primaryDetail,
  metrics,
  note,
  className = '',
}: ResultPanelProps) {
  return <section className={`result-panel ${className}`.trim()} aria-label={title}>
    <header className="result-panel-header">
      <div><i /><strong>{title}</strong></div>
      {status && <span className={`result-panel-status ${statusTone}`}>{status}</span>}
    </header>
    <div className="result-panel-primary">
      <span>{primaryLabel}</span>
      <strong>{primaryValue}</strong>
      {primaryDetail && <small>{primaryDetail}</small>}
    </div>
    <div className="result-panel-metrics">
      {metrics.map((metric, index) => <div className={metric.wide ? 'wide' : ''} key={`${metric.label}-${index}`}>
        <span>{metric.label}</span>
        <strong>{metric.value}</strong>
        {metric.detail && <small>{metric.detail}</small>}
      </div>)}
    </div>
    {note && <footer className="result-panel-note">{note}</footer>}
  </section>
}
