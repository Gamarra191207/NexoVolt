import { Activity, BatteryCharging, Magnet, Zap, type LucideIcon } from 'lucide-react'

export type ModuleId = 'electric-field' | 'capacitors' | 'current' | 'magnetism'
export type ModuleColor = 'blue' | 'violet' | 'orange' | 'green'

export type UnitManifest = {
  id: ModuleId
  number: string
  title: string
  short: string
  description: string
  icon: LucideIcon
  color: ModuleColor
  topic: string
  formula: string
  experiences: string[]
  backendCommands: string[]
}

export const modules: UnitManifest[] = [
  {
    id: 'electric-field',
    number: '01',
    title: 'Electricidad, campo y potencial eléctrico',
    short: 'Campo eléctrico',
    description: 'Construye distribuciones de carga, inspecciona el potencial y lanza partículas de prueba.',
    icon: Zap,
    color: 'blue',
    topic: 'Electrostática',
    formula: 'E⃗ = kΣqᵢr̂ᵢ/rᵢ² · V = kΣqᵢ/rᵢ',
    experiences: ['Cargas puntuales 2D/3D', 'Calculadora de potencial', 'Trayectoria de partículas'],
    backendCommands: ['electric_field_at', 'electric_potential_at'],
  },
  {
    id: 'capacitors',
    number: '02',
    title: 'Capacitores y dieléctricos',
    short: 'Capacitores',
    description: 'Modifica placas y materiales para observar capacitancia, campo, carga y energía en vivo.',
    icon: BatteryCharging,
    color: 'violet',
    topic: 'Capacitancia',
    formula: 'C = ε · A / d',
    experiences: ['Placas paralelas', 'Materiales dieléctricos', 'Energía almacenada'],
    backendCommands: ['parallel_plate_capacitor', 'capacitor_energy'],
  },
  {
    id: 'current',
    number: '03',
    title: 'Corriente eléctrica y ley de Ohm',
    short: 'Corriente eléctrica',
    description: 'Arma circuitos y compara en tiempo real voltaje, corriente, resistencia y potencia.',
    icon: Activity,
    color: 'orange',
    topic: 'Circuitos',
    formula: 'V = I · R',
    experiences: ['Constructor de circuitos', 'Serie, paralelo y mixto', 'Visualizador de ley de Ohm'],
    backendCommands: ['solve_resistor_circuit', 'solve_ohms_law'],
  },
  {
    id: 'magnetism',
    number: '04',
    title: 'Fuerza y campo magnético',
    short: 'Magnetismo',
    description: 'Explora fuentes magnéticas y controla una partícula en campos eléctricos y magnéticos.',
    icon: Magnet,
    color: 'green',
    topic: 'Magnetismo',
    formula: 'F⃗ = q(E⃗ + v⃗ × B⃗)',
    experiences: ['Fuentes de campo magnético', 'Brújula interactiva', 'Fuerza de Lorentz'],
    backendCommands: ['magnetic_field_from_current', 'lorentz_force'],
  },
]
