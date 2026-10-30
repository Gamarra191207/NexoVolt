export const VACUUM_PERMITTIVITY = 8.8541878128e-12

export type NetworkNode =
  | { type: 'capacitor'; id: number; capacitanceMicrofarads: number }
  | { type: 'series' | 'parallel'; children: NetworkNode[] }

export type CapacitorState = {
  id: number
  capacitanceFarads: number
  chargeCoulombs: number
  voltageVolts: number
  energyJoules: number
}

export type NetworkResult = {
  equivalentCapacitanceFarads: number
  capacitors: CapacitorState[]
}

export function parallelCapacitance(capacitances: number[]): number {
  return capacitances.reduce((sum, value) => sum + value, 0)
}

export function seriesCapacitance(capacitances: number[]): number {
  if (capacitances.length === 0 || capacitances.some((value) => value <= 0)) return 0
  return 1 / capacitances.reduce((sum, value) => sum + 1 / value, 0)
}

function equivalent(node: NetworkNode): number {
  if (node.type === 'capacitor') return node.capacitanceMicrofarads * 1e-6
  const values = node.children.map(equivalent)
  return node.type === 'series' ? seriesCapacitance(values) : parallelCapacitance(values)
}

function distribute(node: NetworkNode, voltageVolts: number, output: CapacitorState[]) {
  if (node.type === 'capacitor') {
    const capacitanceFarads = node.capacitanceMicrofarads * 1e-6
    const chargeCoulombs = capacitanceFarads * voltageVolts
    output.push({
      id: node.id,
      capacitanceFarads,
      chargeCoulombs,
      voltageVolts,
      energyJoules: 0.5 * capacitanceFarads * voltageVolts ** 2,
    })
    return
  }

  const childCapacitances = node.children.map(equivalent)
  const totalEquivalent = equivalent(node)
  if (node.type === 'parallel') {
    node.children.forEach((child) => distribute(child, voltageVolts, output))
  } else {
    const seriesCharge = totalEquivalent * voltageVolts
    node.children.forEach((child, index) => {
      const childVoltage = childCapacitances[index] > 0 ? seriesCharge / childCapacitances[index] : 0
      distribute(child, childVoltage, output)
    })
  }
}

export function solveCapacitorNetwork(node: NetworkNode, sourceVoltageVolts: number): NetworkResult {
  const capacitors: CapacitorState[] = []
  distribute(node, sourceVoltageVolts, capacitors)
  return { equivalentCapacitanceFarads: equivalent(node), capacitors }
}
