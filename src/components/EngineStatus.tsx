import { useEffect, useState } from 'react'
import { Cpu, LoaderCircle, TriangleAlert } from 'lucide-react'
import { checkPhysicsBackend, type BackendCheck } from '../services/physicsBackend'
import './engine-status.css'

type Status =
  | { state: 'loading' }
  | { state: 'ready'; check: BackendCheck }
  | { state: 'error'; message: string }

export default function EngineStatus() {
  const [status, setStatus] = useState<Status>({ state: 'loading' })

  useEffect(() => {
    let active = true
    checkPhysicsBackend()
      .then((check) => { if (active) setStatus({ state: 'ready', check }) })
      .catch((error: unknown) => {
        if (active) setStatus({ state: 'error', message: error instanceof Error ? error.message : 'No se pudo validar el motor.' })
      })
    return () => { active = false }
  }, [])

  if (status.state === 'loading') return <div className="engine-status loading"><LoaderCircle size={14} className="engine-spinner" /><span>Validando motor</span></div>
  if (status.state === 'error') return <div className="engine-status error" title={status.message}><TriangleAlert size={14} /><span>Motor no disponible</span></div>

  const isTauri = status.check.mode === 'tauri'
  return <div className={`engine-status ready ${isTauri ? 'tauri' : 'browser'}`} title={`${status.check.unitChecks.length} unidades verificadas`}>
    <Cpu size={14} />
    <span>{isTauri ? 'Motor Rust conectado' : 'Motor local de desarrollo'}</span>
    <i aria-hidden="true" />
  </div>
}
