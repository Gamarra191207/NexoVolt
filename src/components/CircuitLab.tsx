import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import CustomCircuitBuilder from './CustomCircuitBuilder'
import OhmLawExplorer from './OhmLawExplorer'
import ExperimentNav from './ExperimentNav'
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
    <ExperimentNav activeId={tool} ariaLabel="Experiencias de circuitos" onSelect={setTool} items={[
      { id: 'custom', title: 'Constructor de circuitos', description: 'Serie, paralelo y configuraciones mixtas' },
      { id: 'ohm', title: 'Ley de Ohm', description: 'Relación entre voltaje, corriente y resistencia' },
    ]} />
    <div className="circuit-toolbar">
      <span className="circuit-context">HERRAMIENTAS DEL EXPERIMENTO</span>
      <button className="circuit-reset" onClick={reset}><RotateCcw size={13} />Reiniciar</button>
    </div>

    {tool === 'custom'
      ? <CustomCircuitBuilder key={customVersion} />
      : <OhmLawExplorer key={ohmVersion} />}
  </div>
}
