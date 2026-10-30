import { useState } from 'react'
import { Calculator, Network, RotateCcw } from 'lucide-react'
import CustomCircuitBuilder from './CustomCircuitBuilder'
import OhmLawExplorer from './OhmLawExplorer'
import './circuit-lab.css'

type Tool = 'custom' | 'ohm'

export default function CircuitLab() {
  const [tool, setTool] = useState<Tool>('custom')
  const [customVersion, setCustomVersion] = useState(0)
  const [ohmVersion, setOhmVersion] = useState(0)

  const reset = () => {
    if (tool === 'custom') setCustomVersion((version) => version + 1)
    else setOhmVersion((version) => version + 1)
  }

  return <div className="circuit-lab">
    <div className="circuit-toolbar">
      <div className="circuit-tabs" role="tablist" aria-label="Herramientas del módulo">
        <button role="tab" aria-selected={tool === 'custom'} className={tool === 'custom' ? 'active' : ''} onClick={() => setTool('custom')}>
          <Network size={14} />Constructor libre
        </button>
        <button role="tab" aria-selected={tool === 'ohm'} className={tool === 'ohm' ? 'active' : ''} onClick={() => setTool('ohm')}>
          <Calculator size={14} />Visualizador de la ley de Ohm
        </button>
      </div>
      <button className="circuit-reset" onClick={reset}><RotateCcw size={13} />Reiniciar</button>
    </div>

    {tool === 'custom'
      ? <CustomCircuitBuilder key={customVersion} />
      : <OhmLawExplorer key={ohmVersion} />}
  </div>
}
