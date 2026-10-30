export type Vector2 = { x: number; y: number }

export type LorentzParameters = {
  chargeCoulombs: number
  massKg: number
  electricField: Vector2
  magneticFieldTesla: number
  initialPosition: Vector2
  initialVelocity: Vector2
  durationSeconds: number
  steps?: number
}

export type LorentzState = {
  position: Vector2
  velocity: Vector2
  force: Vector2
  time: number
  kineticEnergy: number
}

export function lorentzForce(
  chargeCoulombs: number,
  velocity: Vector2,
  electricField: Vector2,
  magneticFieldTesla: number,
): Vector2 {
  return {
    x: chargeCoulombs * (electricField.x + velocity.y * magneticFieldTesla),
    y: chargeCoulombs * (electricField.y - velocity.x * magneticFieldTesla),
  }
}

export function simulateLorentzTrajectory(parameters: LorentzParameters): LorentzState[] {
  const { chargeCoulombs, massKg, electricField, magneticFieldTesla, durationSeconds } = parameters
  if (massKg <= 0 || durationSeconds <= 0) return []

  const steps = Math.max(80, Math.min(1800, parameters.steps ?? 700))
  const dt = durationSeconds / steps
  let position = { ...parameters.initialPosition }
  let velocity = { ...parameters.initialVelocity }
  const result: LorentzState[] = []

  const acceleration = (candidateVelocity: Vector2): Vector2 => {
    const force = lorentzForce(chargeCoulombs, candidateVelocity, electricField, magneticFieldTesla)
    return { x: force.x / massKg, y: force.y / massKg }
  }

  for (let index = 0; index <= steps; index++) {
    const force = lorentzForce(chargeCoulombs, velocity, electricField, magneticFieldTesla)
    result.push({
      position: { ...position }, velocity: { ...velocity }, force, time: index * dt,
      kineticEnergy: .5 * massKg * (velocity.x ** 2 + velocity.y ** 2),
    })
    if (index === steps) break

    // Runge–Kutta 4 for the coupled position/velocity system.
    const a1 = acceleration(velocity)
    const v2 = { x: velocity.x + a1.x * dt / 2, y: velocity.y + a1.y * dt / 2 }
    const a2 = acceleration(v2)
    const v3 = { x: velocity.x + a2.x * dt / 2, y: velocity.y + a2.y * dt / 2 }
    const a3 = acceleration(v3)
    const v4 = { x: velocity.x + a3.x * dt, y: velocity.y + a3.y * dt }
    const a4 = acceleration(v4)

    position = {
      x: position.x + (velocity.x + 2 * v2.x + 2 * v3.x + v4.x) * dt / 6,
      y: position.y + (velocity.y + 2 * v2.y + 2 * v3.y + v4.y) * dt / 6,
    }
    velocity = {
      x: velocity.x + (a1.x + 2 * a2.x + 2 * a3.x + a4.x) * dt / 6,
      y: velocity.y + (a1.y + 2 * a2.y + 2 * a3.y + a4.y) * dt / 6,
    }
    if (![position.x, position.y, velocity.x, velocity.y].every(Number.isFinite)) break
  }
  return result
}

export function crossedFieldDrift(electricField: Vector2, magneticFieldTesla: number): Vector2 {
  if (Math.abs(magneticFieldTesla) < 1e-12) return { x: 0, y: 0 }
  return { x: electricField.y / magneticFieldTesla, y: -electricField.x / magneticFieldTesla }
}

export function cyclotronPeriod(massKg: number, chargeCoulombs: number, magneticFieldTesla: number): number {
  const denominator = Math.abs(chargeCoulombs * magneticFieldTesla)
  return denominator < 1e-20 ? Infinity : 2 * Math.PI * massKg / denominator
}
