export type CircuitTopology = 'series' | 'parallel' | 'mixed'

export type ResistorResult = {
  resistance: number
  voltage: number
  current: number
  power: number
}

export type CircuitResult = {
  equivalentResistance: number
  totalCurrent: number
  totalPower: number
  resistors: ResistorResult[]
}

export type CustomComponentKind = 'resistor' | 'lamp' | 'switch'

export type CustomCircuitComponent = {
  id: string
  kind: CustomComponentKind
  resistance: number
  closed?: boolean
  label: string
}

export type CustomCircuitBranch = {
  id: string
  components: CustomCircuitComponent[]
}

export type CustomBranchResult = {
  resistance: number
  current: number
  power: number
  isOpen: boolean
  componentVoltages: number[]
}

export type CustomCircuitResult = {
  equivalentResistance: number
  totalCurrent: number
  totalPower: number
  activeBranches: number
  isComplete: boolean
  branches: CustomBranchResult[]
}

export type ConstructedCircuitResult = CustomCircuitResult & {
  seriesResistance: number
  parallelResistance: number
  parallelVoltage: number
  seriesComponents: ResistorResult[]
}

const safeResistance = (value: number) => Math.max(0.1, value)
const safeVoltage = (value: number) => Math.max(0, value)

export function solveCircuit(
  topology: CircuitTopology,
  sourceVoltage: number,
  resistanceValues: [number, number, number],
): CircuitResult {
  const voltage = safeVoltage(sourceVoltage)
  const [r1, r2, r3] = resistanceValues.map(safeResistance) as [number, number, number]

  if (topology === 'series') {
    const equivalentResistance = r1 + r2 + r3
    const totalCurrent = voltage / equivalentResistance
    const resistors = [r1, r2, r3].map((resistance) => ({
      resistance,
      voltage: totalCurrent * resistance,
      current: totalCurrent,
      power: totalCurrent ** 2 * resistance,
    }))
    return { equivalentResistance, totalCurrent, totalPower: voltage * totalCurrent, resistors }
  }

  if (topology === 'parallel') {
    const equivalentResistance = 1 / (1 / r1 + 1 / r2 + 1 / r3)
    const totalCurrent = voltage / equivalentResistance
    const resistors = [r1, r2, r3].map((resistance) => ({
      resistance,
      voltage,
      current: voltage / resistance,
      power: voltage ** 2 / resistance,
    }))
    return { equivalentResistance, totalCurrent, totalPower: voltage * totalCurrent, resistors }
  }

  const parallelResistance = 1 / (1 / r2 + 1 / r3)
  const equivalentResistance = r1 + parallelResistance
  const totalCurrent = voltage / equivalentResistance
  const parallelVoltage = totalCurrent * parallelResistance
  const resistors = [
    { resistance: r1, voltage: totalCurrent * r1, current: totalCurrent, power: totalCurrent ** 2 * r1 },
    { resistance: r2, voltage: parallelVoltage, current: parallelVoltage / r2, power: parallelVoltage ** 2 / r2 },
    { resistance: r3, voltage: parallelVoltage, current: parallelVoltage / r3, power: parallelVoltage ** 2 / r3 },
  ]
  return { equivalentResistance, totalCurrent, totalPower: voltage * totalCurrent, resistors }
}

export function ohmsLaw(voltage: number, resistance: number) {
  const safeR = safeResistance(resistance)
  const current = safeVoltage(voltage) / safeR
  return { voltage: safeVoltage(voltage), resistance: safeR, current, power: current * safeVoltage(voltage) }
}

export function solveCustomCircuit(sourceVoltage: number, branches: CustomCircuitBranch[]): CustomCircuitResult {
  const voltage = safeVoltage(sourceVoltage)
  const branchResults = branches.map((branch): CustomBranchResult => {
    const isOpen = branch.components.length === 0 || branch.components.some((component) => component.kind === 'switch' && component.closed === false)
    const resistance = branch.components.reduce((sum, component) => component.kind === 'switch' ? sum : sum + safeResistance(component.resistance), 0)
    if (isOpen || resistance <= 0) return { resistance, current: 0, power: 0, isOpen: true, componentVoltages: branch.components.map(() => 0) }
    const current = voltage / resistance
    return {
      resistance,
      current,
      power: voltage * current,
      isOpen: false,
      componentVoltages: branch.components.map((component) => component.kind === 'switch' ? 0 : current * safeResistance(component.resistance)),
    }
  })
  const conducting = branchResults.filter((branch) => !branch.isOpen)
  const conductance = conducting.reduce((sum, branch) => sum + 1 / branch.resistance, 0)
  const equivalentResistance = conductance > 0 ? 1 / conductance : Number.POSITIVE_INFINITY
  const totalCurrent = conductance > 0 ? voltage / equivalentResistance : 0
  return {
    equivalentResistance,
    totalCurrent,
    totalPower: voltage * totalCurrent,
    activeBranches: conducting.length,
    isComplete: conducting.length > 0,
    branches: branchResults,
  }
}

export function solveConstructedCircuit(
  sourceVoltage: number,
  seriesComponents: CustomCircuitComponent[],
  branches: CustomCircuitBranch[],
): ConstructedCircuitResult {
  const voltage = safeVoltage(sourceVoltage)
  const seriesOpen = seriesComponents.some((component) => component.kind === 'switch' && component.closed === false)
  const seriesResistance = seriesComponents.reduce((sum, component) => component.kind === 'switch' ? sum : sum + safeResistance(component.resistance), 0)
  const branchResults = branches.map((branch): CustomBranchResult => {
    const isOpen = branch.components.length === 0 || branch.components.some((component) => component.kind === 'switch' && component.closed === false)
    const resistance = branch.components.reduce((sum, component) => component.kind === 'switch' ? sum : sum + safeResistance(component.resistance), 0)
    return { resistance, current: 0, power: 0, isOpen, componentVoltages: branch.components.map(() => 0) }
  })
  const conductingBranches = branchResults.filter((branch) => !branch.isOpen && branch.resistance > 0)
  const hasParallelNetwork = branches.length > 0
  const parallelConductance = conductingBranches.reduce((sum, branch) => sum + 1 / branch.resistance, 0)
  const parallelResistance = parallelConductance > 0 ? 1 / parallelConductance : 0
  const hasSeriesPath = seriesComponents.length > 0 && seriesResistance > 0
  const isComplete = !seriesOpen && (hasParallelNetwork ? conductingBranches.length > 0 : hasSeriesPath)
  const equivalentResistance = isComplete ? seriesResistance + parallelResistance : Number.POSITIVE_INFINITY
  const totalCurrent = isComplete ? voltage / equivalentResistance : 0
  const parallelVoltage = isComplete ? totalCurrent * parallelResistance : 0

  const solvedBranches = branchResults.map((branch, branchIndex): CustomBranchResult => {
    if (branch.isOpen || !isComplete) return branch
    const current = parallelVoltage / branch.resistance
    return {
      ...branch,
      current,
      power: parallelVoltage * current,
      componentVoltages: branches[branchIndex].components.map((component) => component.kind === 'switch' ? 0 : current * safeResistance(component.resistance)),
    }
  })
  const solvedSeries = seriesComponents.map((component): ResistorResult => {
    const resistance = component.kind === 'switch' ? 0 : safeResistance(component.resistance)
    return { resistance, current: totalCurrent, voltage: totalCurrent * resistance, power: totalCurrent ** 2 * resistance }
  })

  return {
    equivalentResistance,
    totalCurrent,
    totalPower: voltage * totalCurrent,
    activeBranches: hasParallelNetwork ? conductingBranches.length : isComplete ? 1 : 0,
    isComplete,
    branches: solvedBranches,
    seriesResistance,
    parallelResistance,
    parallelVoltage,
    seriesComponents: solvedSeries,
  }
}
