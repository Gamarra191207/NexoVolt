import { invoke } from '@tauri-apps/api/core'
import { calculateElectricField, calculateElectricPotential, type PointCharge } from '../physics/electrostatics'
import { VACUUM_PERMITTIVITY } from '../physics/capacitors'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

export type BackendMode = 'tauri' | 'browser'
export type ElectricPoint = { xCentimeters: number; yCentimeters: number; zCentimeters: number }
export type BackendPointCharge = ElectricPoint & { chargeCoulombs: number }
export type ElectricFieldResult = { xNewtonsPerCoulomb: number; yNewtonsPerCoulomb: number; zNewtonsPerCoulomb: number; magnitudeNewtonsPerCoulomb: number }
export type ElectricPotentialResult = { potentialVolts: number }
export type ParallelPlateInput = { areaSquareMeters: number; distanceMeters: number; relativePermittivity: number; voltageVolts: number }
export type ParallelPlateResult = { capacitanceFarads: number; chargeCoulombs: number; electricFieldVoltsPerMeter: number; energyJoules: number; energyDensityJoulesPerCubicMeter: number }
export type CircuitTopology = 'series' | 'parallel' | 'mixed'
export type CircuitInput = { topology: CircuitTopology; sourceVoltageVolts: number; resistancesOhms: number[] }
export type ResistorResult = { resistanceOhms: number; voltageVolts: number; currentAmperes: number; powerWatts: number }
export type CircuitResult = { equivalentResistanceOhms: number; totalCurrentAmperes: number; totalPowerWatts: number; resistors: ResistorResult[] }
export type Vector3 = { x: number; y: number; z: number }
export type LorentzInput = { chargeCoulombs: number; massKilograms: number; velocityMetersPerSecond: Vector3; electricFieldVoltsPerMeter: Vector3; magneticFieldTesla: Vector3 }
export type LorentzResult = { electricForceNewtons: Vector3; magneticForceNewtons: Vector3; totalForceNewtons: Vector3; magnitudeNewtons: number; accelerationMetersPerSecondSquared: Vector3 }
export type CurrentFieldInput = { source: 'straightWire' | 'circularLoop' | 'solenoid'; currentAmperes: number; distanceOrRadiusMeters: number; turns: number; solenoidLengthMeters: number }
export type MagneticFieldResult = { magnitudeTesla: number; model: string }
export type BackendCheck = { mode: BackendMode; unitChecks: Array<{ unit: 1 | 2 | 3 | 4; label: string }> }

const inTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)

async function callBackend<T>(command: string, args: Record<string, unknown>, fallback: () => T): Promise<T> {
  if (!inTauri()) return fallback()
  return invoke<T>(command, args)
}

const toLocalCharges = (charges: BackendPointCharge[]): PointCharge[] => charges.map((charge, index) => ({
  id: index,
  x: charge.xCentimeters,
  y: charge.yCentimeters,
  z: charge.zCentimeters,
  chargeCoulombs: charge.chargeCoulombs,
}))

export function electricFieldAt(point: ElectricPoint, charges: BackendPointCharge[]) {
  return callBackend<ElectricFieldResult>('electric_field_at', { point, charges }, () => {
    const field = calculateElectricField({ x: point.xCentimeters, y: point.yCentimeters, z: point.zCentimeters }, toLocalCharges(charges))
    return {
      xNewtonsPerCoulomb: field.x,
      yNewtonsPerCoulomb: field.y,
      zNewtonsPerCoulomb: field.z,
      magnitudeNewtonsPerCoulomb: Math.hypot(field.x, field.y, field.z),
    }
  })
}

export function electricPotentialAt(point: ElectricPoint, charges: BackendPointCharge[]) {
  return callBackend<ElectricPotentialResult>('electric_potential_at', { point, charges }, () => ({
    potentialVolts: calculateElectricPotential({ x: point.xCentimeters, y: point.yCentimeters, z: point.zCentimeters }, toLocalCharges(charges)),
  }))
}

export function parallelPlateCapacitor(input: ParallelPlateInput) {
  return callBackend<ParallelPlateResult>('parallel_plate_capacitor', { input }, () => {
    const permittivity = VACUUM_PERMITTIVITY * input.relativePermittivity
    const capacitanceFarads = permittivity * input.areaSquareMeters / input.distanceMeters
    const electricFieldVoltsPerMeter = input.voltageVolts / input.distanceMeters
    return {
      capacitanceFarads,
      chargeCoulombs: capacitanceFarads * input.voltageVolts,
      electricFieldVoltsPerMeter,
      energyJoules: .5 * capacitanceFarads * input.voltageVolts ** 2,
      energyDensityJoulesPerCubicMeter: .5 * permittivity * electricFieldVoltsPerMeter ** 2,
    }
  })
}

function localCircuit(input: CircuitInput): CircuitResult {
  const voltage = Math.max(0, input.sourceVoltageVolts)
  const resistances = input.resistancesOhms.map((resistance) => Math.max(.1, resistance))
  const parallel = (items: number[]) => 1 / items.reduce((sum, resistance) => sum + 1 / resistance, 0)
  let equivalentResistanceOhms = 0
  let resistors: ResistorResult[] = []

  if (input.topology === 'series') {
    equivalentResistanceOhms = resistances.reduce((sum, resistance) => sum + resistance, 0)
    const current = voltage / equivalentResistanceOhms
    resistors = resistances.map((resistanceOhms) => ({ resistanceOhms, currentAmperes: current, voltageVolts: current * resistanceOhms, powerWatts: current ** 2 * resistanceOhms }))
  } else if (input.topology === 'parallel') {
    equivalentResistanceOhms = parallel(resistances)
    resistors = resistances.map((resistanceOhms) => ({ resistanceOhms, voltageVolts: voltage, currentAmperes: voltage / resistanceOhms, powerWatts: voltage ** 2 / resistanceOhms }))
  } else {
    const parallelResistance = parallel(resistances.slice(1))
    equivalentResistanceOhms = resistances[0] + parallelResistance
    const totalCurrent = voltage / equivalentResistanceOhms
    const parallelVoltage = totalCurrent * parallelResistance
    resistors = [
      { resistanceOhms: resistances[0], voltageVolts: totalCurrent * resistances[0], currentAmperes: totalCurrent, powerWatts: totalCurrent ** 2 * resistances[0] },
      ...resistances.slice(1).map((resistanceOhms) => ({ resistanceOhms, voltageVolts: parallelVoltage, currentAmperes: parallelVoltage / resistanceOhms, powerWatts: parallelVoltage ** 2 / resistanceOhms })),
    ]
  }

  const totalCurrentAmperes = voltage / equivalentResistanceOhms
  return { equivalentResistanceOhms, totalCurrentAmperes, totalPowerWatts: voltage * totalCurrentAmperes, resistors }
}

export function solveResistorCircuit(input: CircuitInput) {
  return callBackend<CircuitResult>('solve_resistor_circuit', { input }, () => localCircuit(input))
}

export function solveOhmsLaw(voltageVolts: number, resistanceOhms: number) {
  return callBackend<{ voltageVolts: number; resistanceOhms: number; currentAmperes: number; powerWatts: number }>(
    'solve_ohms_law',
    { voltageVolts, resistanceOhms },
    () => {
      const currentAmperes = Math.max(0, voltageVolts) / Math.max(.1, resistanceOhms)
      return { voltageVolts, resistanceOhms, currentAmperes, powerWatts: voltageVolts * currentAmperes }
    },
  )
}

const cross = (left: Vector3, right: Vector3): Vector3 => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x,
})

export function calculateLorentzForce(input: LorentzInput) {
  return callBackend<LorentzResult>('lorentz_force', { input }, () => {
    const scale = (vector: Vector3, factor: number) => ({ x: vector.x * factor, y: vector.y * factor, z: vector.z * factor })
    const electricForceNewtons = scale(input.electricFieldVoltsPerMeter, input.chargeCoulombs)
    const magneticForceNewtons = scale(cross(input.velocityMetersPerSecond, input.magneticFieldTesla), input.chargeCoulombs)
    const totalForceNewtons = {
      x: electricForceNewtons.x + magneticForceNewtons.x,
      y: electricForceNewtons.y + magneticForceNewtons.y,
      z: electricForceNewtons.z + magneticForceNewtons.z,
    }
    return {
      electricForceNewtons,
      magneticForceNewtons,
      totalForceNewtons,
      magnitudeNewtons: Math.hypot(totalForceNewtons.x, totalForceNewtons.y, totalForceNewtons.z),
      accelerationMetersPerSecondSquared: scale(totalForceNewtons, 1 / input.massKilograms),
    }
  })
}

export function magneticFieldFromCurrent(input: CurrentFieldInput) {
  return callBackend<MagneticFieldResult>('magnetic_field_from_current', { input }, () => {
    const permeability = 4 * Math.PI * 1e-7
    if (input.source === 'straightWire') return { magnitudeTesla: permeability * Math.abs(input.currentAmperes) / (2 * Math.PI * input.distanceOrRadiusMeters), model: 'conductor rectilíneo infinito' }
    if (input.source === 'circularLoop') return { magnitudeTesla: permeability * Math.max(1, input.turns) * Math.abs(input.currentAmperes) / (2 * input.distanceOrRadiusMeters), model: 'centro de una espira circular' }
    return { magnitudeTesla: permeability * Math.max(1, input.turns) * Math.abs(input.currentAmperes) / input.solenoidLengthMeters, model: 'solenoide largo ideal' }
  })
}

export async function checkPhysicsBackend(): Promise<BackendCheck> {
  await Promise.all([
    electricFieldAt(
      { xCentimeters: 100, yCentimeters: 0, zCentimeters: 0 },
      [{ xCentimeters: 0, yCentimeters: 0, zCentimeters: 0, chargeCoulombs: 1e-6 }],
    ),
    parallelPlateCapacitor({ areaSquareMeters: .01, distanceMeters: .001, relativePermittivity: 2, voltageVolts: 12 }),
    solveResistorCircuit({ topology: 'mixed', sourceVoltageVolts: 12, resistancesOhms: [10, 20, 30] }),
    calculateLorentzForce({
      chargeCoulombs: 1e-6,
      massKilograms: 1e-6,
      velocityMetersPerSecond: { x: 3, y: 0, z: 0 },
      electricFieldVoltsPerMeter: { x: 0, y: 1, z: 0 },
      magneticFieldTesla: { x: 0, y: 0, z: .8 },
    }),
  ])

  return {
    mode: inTauri() ? 'tauri' : 'browser',
    unitChecks: [
      { unit: 1, label: 'Electrostática' },
      { unit: 2, label: 'Capacitores' },
      { unit: 3, label: 'Circuitos' },
      { unit: 4, label: 'Magnetismo' },
    ],
  }
}
