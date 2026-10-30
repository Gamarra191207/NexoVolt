use serde::{Deserialize, Serialize};

const VACUUM_PERMEABILITY: f64 = 4.0 * std::f64::consts::PI * 1e-7;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vector3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LorentzInput {
    pub charge_coulombs: f64,
    pub mass_kilograms: f64,
    pub velocity_meters_per_second: Vector3,
    pub electric_field_volts_per_meter: Vector3,
    pub magnetic_field_tesla: Vector3,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Vector3Result {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LorentzResult {
    pub electric_force_newtons: Vector3Result,
    pub magnetic_force_newtons: Vector3Result,
    pub total_force_newtons: Vector3Result,
    pub magnitude_newtons: f64,
    pub acceleration_meters_per_second_squared: Vector3Result,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CurrentSource {
    StraightWire,
    CircularLoop,
    Solenoid,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentFieldInput {
    pub source: CurrentSource,
    pub current_amperes: f64,
    pub distance_or_radius_meters: f64,
    pub turns: u32,
    pub solenoid_length_meters: f64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MagneticFieldResult {
    pub magnitude_tesla: f64,
    pub model: &'static str,
}

fn validate_vector(vector: Vector3, name: &str) -> Result<(), String> {
    if [vector.x, vector.y, vector.z]
        .iter()
        .all(|value| value.is_finite())
    {
        Ok(())
    } else {
        Err(format!("{name} contiene valores no finitos."))
    }
}

fn multiply(vector: Vector3, scalar: f64) -> Vector3Result {
    Vector3Result {
        x: vector.x * scalar,
        y: vector.y * scalar,
        z: vector.z * scalar,
    }
}

fn cross(left: Vector3, right: Vector3) -> Vector3 {
    Vector3 {
        x: left.y * right.z - left.z * right.y,
        y: left.z * right.x - left.x * right.z,
        z: left.x * right.y - left.y * right.x,
    }
}

#[tauri::command]
pub fn lorentz_force(input: LorentzInput) -> Result<LorentzResult, String> {
    if !input.charge_coulombs.is_finite() {
        return Err("La carga debe ser un número finito.".to_string());
    }
    if !input.mass_kilograms.is_finite() || input.mass_kilograms <= 0.0 {
        return Err("La masa debe ser finita y mayor que cero.".to_string());
    }
    validate_vector(input.velocity_meters_per_second, "La velocidad")?;
    validate_vector(input.electric_field_volts_per_meter, "El campo eléctrico")?;
    validate_vector(input.magnetic_field_tesla, "El campo magnético")?;

    let electric = multiply(input.electric_field_volts_per_meter, input.charge_coulombs);
    let magnetic_cross = cross(input.velocity_meters_per_second, input.magnetic_field_tesla);
    let magnetic = multiply(magnetic_cross, input.charge_coulombs);
    let total = Vector3Result {
        x: electric.x + magnetic.x,
        y: electric.y + magnetic.y,
        z: electric.z + magnetic.z,
    };
    let magnitude_newtons = (total.x.powi(2) + total.y.powi(2) + total.z.powi(2)).sqrt();

    Ok(LorentzResult {
        electric_force_newtons: electric,
        magnetic_force_newtons: magnetic,
        total_force_newtons: total,
        magnitude_newtons,
        acceleration_meters_per_second_squared: Vector3Result {
            x: total.x / input.mass_kilograms,
            y: total.y / input.mass_kilograms,
            z: total.z / input.mass_kilograms,
        },
    })
}

#[tauri::command]
pub fn magnetic_field_from_current(
    input: CurrentFieldInput,
) -> Result<MagneticFieldResult, String> {
    if !input.current_amperes.is_finite() {
        return Err("La corriente debe ser un número finito.".to_string());
    }
    if !input.distance_or_radius_meters.is_finite() || input.distance_or_radius_meters <= 0.0 {
        return Err("La distancia o radio debe ser finita y mayor que cero.".to_string());
    }

    let (magnitude_tesla, model) = match input.source {
        CurrentSource::StraightWire => (
            VACUUM_PERMEABILITY * input.current_amperes.abs()
                / (2.0 * std::f64::consts::PI * input.distance_or_radius_meters),
            "conductor rectilíneo infinito",
        ),
        CurrentSource::CircularLoop => {
            let turns = input.turns.max(1) as f64;
            (
                VACUUM_PERMEABILITY * turns * input.current_amperes.abs()
                    / (2.0 * input.distance_or_radius_meters),
                "centro de una espira circular",
            )
        }
        CurrentSource::Solenoid => {
            if !input.solenoid_length_meters.is_finite() || input.solenoid_length_meters <= 0.0 {
                return Err("La longitud del solenoide debe ser mayor que cero.".to_string());
            }
            let turns = input.turns.max(1) as f64;
            (
                VACUUM_PERMEABILITY * turns * input.current_amperes.abs()
                    / input.solenoid_length_meters,
                "solenoide largo ideal",
            )
        }
    };

    Ok(MagneticFieldResult {
        magnitude_tesla,
        model,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculates_force_for_crossed_velocity_and_field() {
        let result = lorentz_force(LorentzInput {
            charge_coulombs: 2.0,
            mass_kilograms: 4.0,
            velocity_meters_per_second: Vector3 {
                x: 3.0,
                y: 0.0,
                z: 0.0,
            },
            electric_field_volts_per_meter: Vector3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            magnetic_field_tesla: Vector3 {
                x: 0.0,
                y: 0.0,
                z: 5.0,
            },
        })
        .expect("valid Lorentz input");

        assert!((result.magnetic_force_newtons.y + 30.0).abs() < 1e-12);
        assert!((result.acceleration_meters_per_second_squared.y + 7.5).abs() < 1e-12);
    }

    #[test]
    fn electric_and_magnetic_forces_are_combined() {
        let result = lorentz_force(LorentzInput {
            charge_coulombs: 1.0,
            mass_kilograms: 1.0,
            velocity_meters_per_second: Vector3 {
                x: 1.0,
                y: 0.0,
                z: 0.0,
            },
            electric_field_volts_per_meter: Vector3 {
                x: 2.0,
                y: 3.0,
                z: 0.0,
            },
            magnetic_field_tesla: Vector3 {
                x: 0.0,
                y: 0.0,
                z: 4.0,
            },
        })
        .expect("valid combined fields");

        assert!((result.total_force_newtons.x - 2.0).abs() < 1e-12);
        assert!((result.total_force_newtons.y + 1.0).abs() < 1e-12);
    }

    #[test]
    fn calculates_straight_wire_field() {
        let result = magnetic_field_from_current(CurrentFieldInput {
            source: CurrentSource::StraightWire,
            current_amperes: 10.0,
            distance_or_radius_meters: 0.05,
            turns: 1,
            solenoid_length_meters: 1.0,
        })
        .expect("valid wire input");

        assert!((result.magnitude_tesla - 4e-5).abs() < 1e-15);
    }

    #[test]
    fn calculates_solenoid_field() {
        let result = magnetic_field_from_current(CurrentFieldInput {
            source: CurrentSource::Solenoid,
            current_amperes: 2.0,
            distance_or_radius_meters: 0.05,
            turns: 1_000,
            solenoid_length_meters: 0.5,
        })
        .expect("valid solenoid input");

        let expected = VACUUM_PERMEABILITY * 4_000.0;
        assert!((result.magnitude_tesla - expected).abs() < 1e-15);
    }
}
