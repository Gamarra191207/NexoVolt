export const COULOMB_CONSTANT = 8.9875517923e9

export type Point2D = { x: number; y: number }
export type Point3D = Point2D & { z: number }
export type PointCharge = Point3D & { id: number; chargeCoulombs: number }
export type ElectricField = Point3D

const meters = (centimeters: number) => centimeters / 100

export function calculateElectricField(point: Point3D, charges: PointCharge[]): ElectricField {
  return charges.reduce<ElectricField>((field, charge) => {
    const dx = meters(point.x - charge.x)
    const dy = meters(point.y - charge.y)
    const dz = meters(point.z - charge.z)
    const radiusSquared = dx * dx + dy * dy + dz * dz
    if (radiusSquared < 1e-12) return field

    const scale = COULOMB_CONSTANT * charge.chargeCoulombs / (radiusSquared * Math.sqrt(radiusSquared))
    return { x: field.x + scale * dx, y: field.y + scale * dy, z: field.z + scale * dz }
  }, { x: 0, y: 0, z: 0 })
}

export function calculateElectricPotential(point: Point3D, charges: PointCharge[]): number {
  return charges.reduce((potential, charge) => {
    const dx = meters(point.x - charge.x)
    const dy = meters(point.y - charge.y)
    const dz = meters(point.z - charge.z)
    const radius = Math.hypot(dx, dy, dz)
    if (radius < 1e-6) return potential
    return potential + COULOMB_CONSTANT * charge.chargeCoulombs / radius
  }, 0)
}

export function fieldAt(point: Point3D, charges: PointCharge[]): ElectricField {
  return calculateElectricField(point, charges)
}

export function potentialAt(point: Point3D, charges: PointCharge[]): number {
  return calculateElectricPotential(point, charges)
}

export function isAtCharge(point: Point3D, charges: PointCharge[], toleranceMeters = 1e-6): boolean {
  return charges.some((charge) => Math.hypot(
    meters(point.x - charge.x),
    meters(point.y - charge.y),
    meters(point.z - charge.z),
  ) < toleranceMeters)
}

export type TrajectoryState = { position: Point3D; velocity: Point3D; time: number }

export function simulateTrajectory(
  charges: PointCharge[],
  initialPosition: Point3D,
  initialVelocity: Point3D,
  particleChargeCoulombs: number,
  particleMassKg: number,
  durationSeconds: number,
  timeStepSeconds: number,
): TrajectoryState[] {
  if (particleMassKg <= 0 || timeStepSeconds <= 0 || durationSeconds <= 0) return []
  const acceleration = (position: Point3D): Point3D => {
    const field = fieldAt({ x: position.x * 100, y: position.y * 100, z: position.z * 100 }, charges)
    const ratio = particleChargeCoulombs / particleMassKg
    return { x: field.x * ratio, y: field.y * ratio, z: field.z * ratio }
  }
  const derivative = (statePosition: Point3D, stateVelocity: Point3D) => ({ position: stateVelocity, velocity: acceleration(statePosition) })
  let position = { ...initialPosition }
  let velocity = { ...initialVelocity }
  const states: TrajectoryState[] = [{ position, velocity, time: 0 }]
  const count = Math.min(5000, Math.ceil(durationSeconds / timeStepSeconds))
  const dt = durationSeconds / count

  for (let index = 1; index <= count; index++) {
    const k1 = derivative(position, velocity)
    const p2 = { x: position.x + k1.position.x * dt / 2, y: position.y + k1.position.y * dt / 2, z: position.z + k1.position.z * dt / 2 }
    const v2 = { x: velocity.x + k1.velocity.x * dt / 2, y: velocity.y + k1.velocity.y * dt / 2, z: velocity.z + k1.velocity.z * dt / 2 }
    const k2 = derivative(p2, v2)
    const p3 = { x: position.x + k2.position.x * dt / 2, y: position.y + k2.position.y * dt / 2, z: position.z + k2.position.z * dt / 2 }
    const v3 = { x: velocity.x + k2.velocity.x * dt / 2, y: velocity.y + k2.velocity.y * dt / 2, z: velocity.z + k2.velocity.z * dt / 2 }
    const k3 = derivative(p3, v3)
    const p4 = { x: position.x + k3.position.x * dt, y: position.y + k3.position.y * dt, z: position.z + k3.position.z * dt }
    const v4 = { x: velocity.x + k3.velocity.x * dt, y: velocity.y + k3.velocity.y * dt, z: velocity.z + k3.velocity.z * dt }
    const k4 = derivative(p4, v4)
    position = {
      x: position.x + (k1.position.x + 2 * k2.position.x + 2 * k3.position.x + k4.position.x) * dt / 6,
      y: position.y + (k1.position.y + 2 * k2.position.y + 2 * k3.position.y + k4.position.y) * dt / 6,
      z: position.z + (k1.position.z + 2 * k2.position.z + 2 * k3.position.z + k4.position.z) * dt / 6,
    }
    velocity = {
      x: velocity.x + (k1.velocity.x + 2 * k2.velocity.x + 2 * k3.velocity.x + k4.velocity.x) * dt / 6,
      y: velocity.y + (k1.velocity.y + 2 * k2.velocity.y + 2 * k3.velocity.y + k4.velocity.y) * dt / 6,
      z: velocity.z + (k1.velocity.z + 2 * k2.velocity.z + 2 * k3.velocity.z + k4.velocity.z) * dt / 6,
    }
    if (![position.x, position.y, position.z, velocity.x, velocity.y, velocity.z].every(Number.isFinite)) break
    states.push({ position: { ...position }, velocity: { ...velocity }, time: index * dt })
    if (Math.hypot(position.x, position.y, position.z) > 1e4 || Math.hypot(velocity.x, velocity.y, velocity.z) > 1e9) break
  }
  return states
}
