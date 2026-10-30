use serde::{Deserialize, Serialize};

const COULOMB_CONSTANT: f64 = 8.987_551_792_3e9;
const MINIMUM_RADIUS_METERS: f64 = 1e-6;
const MAXIMUM_CHARGES: usize = 10;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Point3D {
    pub x_centimeters: f64,
    pub y_centimeters: f64,
    pub z_centimeters: f64,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointCharge {
    pub x_centimeters: f64,
    pub y_centimeters: f64,
    pub z_centimeters: f64,
    pub charge_coulombs: f64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElectricFieldResult {
    pub x_newtons_per_coulomb: f64,
    pub y_newtons_per_coulomb: f64,
    pub z_newtons_per_coulomb: f64,
    pub magnitude_newtons_per_coulomb: f64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElectricPotentialResult {
    pub potential_volts: f64,
}

fn centimeters_to_meters(value: f64) -> f64 {
    value / 100.0
}

fn validate(point: Point3D, charges: &[PointCharge]) -> Result<(), String> {
    if charges.len() > MAXIMUM_CHARGES {
        return Err(format!(
            "Se permiten como máximo {MAXIMUM_CHARGES} cargas puntuales."
        ));
    }

    let point_values = [
        point.x_centimeters,
        point.y_centimeters,
        point.z_centimeters,
    ];
    if point_values.iter().any(|value| !value.is_finite()) {
        return Err("El punto de evaluación contiene valores no finitos.".to_string());
    }

    if charges.iter().any(|charge| {
        [
            charge.x_centimeters,
            charge.y_centimeters,
            charge.z_centimeters,
            charge.charge_coulombs,
        ]
        .iter()
        .any(|value| !value.is_finite())
    }) {
        return Err("La distribución contiene una carga con valores no finitos.".to_string());
    }

    Ok(())
}

fn displacement(point: Point3D, charge: PointCharge) -> (f64, f64, f64, f64) {
    let dx = centimeters_to_meters(point.x_centimeters - charge.x_centimeters);
    let dy = centimeters_to_meters(point.y_centimeters - charge.y_centimeters);
    let dz = centimeters_to_meters(point.z_centimeters - charge.z_centimeters);
    let radius = (dx * dx + dy * dy + dz * dz).sqrt();
    (dx, dy, dz, radius)
}

#[tauri::command]
pub fn electric_field_at(
    point: Point3D,
    charges: Vec<PointCharge>,
) -> Result<ElectricFieldResult, String> {
    validate(point, &charges)?;

    let (x, y, z) = charges.iter().fold((0.0, 0.0, 0.0), |field, charge| {
        let (dx, dy, dz, radius) = displacement(point, *charge);
        if radius < MINIMUM_RADIUS_METERS {
            return field;
        }

        let scale = COULOMB_CONSTANT * charge.charge_coulombs / radius.powi(3);
        (
            field.0 + scale * dx,
            field.1 + scale * dy,
            field.2 + scale * dz,
        )
    });

    Ok(ElectricFieldResult {
        x_newtons_per_coulomb: x,
        y_newtons_per_coulomb: y,
        z_newtons_per_coulomb: z,
        magnitude_newtons_per_coulomb: (x * x + y * y + z * z).sqrt(),
    })
}

#[tauri::command]
pub fn electric_potential_at(
    point: Point3D,
    charges: Vec<PointCharge>,
) -> Result<ElectricPotentialResult, String> {
    validate(point, &charges)?;

    let potential_volts = charges.iter().fold(0.0, |potential, charge| {
        let (_, _, _, radius) = displacement(point, *charge);
        if radius < MINIMUM_RADIUS_METERS {
            potential
        } else {
            potential + COULOMB_CONSTANT * charge.charge_coulombs / radius
        }
    });

    Ok(ElectricPotentialResult { potential_volts })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn positive_microcoulomb_at_origin() -> PointCharge {
        PointCharge {
            x_centimeters: 0.0,
            y_centimeters: 0.0,
            z_centimeters: 0.0,
            charge_coulombs: 1e-6,
        }
    }

    #[test]
    fn calculates_field_one_meter_from_point_charge() {
        let result = electric_field_at(
            Point3D {
                x_centimeters: 100.0,
                y_centimeters: 0.0,
                z_centimeters: 0.0,
            },
            vec![positive_microcoulomb_at_origin()],
        )
        .expect("valid electrostatic input");

        assert!((result.x_newtons_per_coulomb - 8_987.551_792_3).abs() < 1e-6);
        assert!(result.y_newtons_per_coulomb.abs() < 1e-12);
        assert!(result.z_newtons_per_coulomb.abs() < 1e-12);
    }

    #[test]
    fn calculates_potential_one_meter_from_point_charge() {
        let result = electric_potential_at(
            Point3D {
                x_centimeters: 100.0,
                y_centimeters: 0.0,
                z_centimeters: 0.0,
            },
            vec![positive_microcoulomb_at_origin()],
        )
        .expect("valid electrostatic input");

        assert!((result.potential_volts - 8_987.551_792_3).abs() < 1e-6);
    }

    #[test]
    fn rejects_more_than_ten_charges() {
        let charges = vec![positive_microcoulomb_at_origin(); 11];
        let result = electric_field_at(
            Point3D {
                x_centimeters: 1.0,
                y_centimeters: 0.0,
                z_centimeters: 0.0,
            },
            charges,
        );

        assert!(result.is_err());
    }
}
