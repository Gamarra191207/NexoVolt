use serde::{Deserialize, Serialize};

const VACUUM_PERMITTIVITY: f64 = 8.854_187_812_8e-12;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParallelPlateInput {
    pub area_square_meters: f64,
    pub distance_meters: f64,
    pub relative_permittivity: f64,
    pub voltage_volts: f64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParallelPlateResult {
    pub capacitance_farads: f64,
    pub charge_coulombs: f64,
    pub electric_field_volts_per_meter: f64,
    pub energy_joules: f64,
    pub energy_density_joules_per_cubic_meter: f64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapacitorEnergyResult {
    pub energy_joules: f64,
}

fn require_finite(value: f64, field_name: &str) -> Result<(), String> {
    if value.is_finite() {
        Ok(())
    } else {
        Err(format!("{field_name} debe ser un número finito."))
    }
}

#[tauri::command]
pub fn parallel_plate_capacitor(input: ParallelPlateInput) -> Result<ParallelPlateResult, String> {
    require_finite(input.area_square_meters, "El área")?;
    require_finite(input.distance_meters, "La distancia")?;
    require_finite(input.relative_permittivity, "La permitividad relativa")?;
    require_finite(input.voltage_volts, "El voltaje")?;

    if input.area_square_meters <= 0.0 {
        return Err("El área de las placas debe ser mayor que cero.".to_string());
    }
    if input.distance_meters <= 0.0 {
        return Err("La separación entre placas debe ser mayor que cero.".to_string());
    }
    if input.relative_permittivity < 1.0 {
        return Err("La permitividad relativa no puede ser menor que 1.".to_string());
    }

    let permittivity = VACUUM_PERMITTIVITY * input.relative_permittivity;
    let capacitance_farads = permittivity * input.area_square_meters / input.distance_meters;
    let electric_field_volts_per_meter = input.voltage_volts / input.distance_meters;
    let charge_coulombs = capacitance_farads * input.voltage_volts;
    let energy_joules = 0.5 * capacitance_farads * input.voltage_volts.powi(2);
    let energy_density_joules_per_cubic_meter =
        0.5 * permittivity * electric_field_volts_per_meter.powi(2);

    Ok(ParallelPlateResult {
        capacitance_farads,
        charge_coulombs,
        electric_field_volts_per_meter,
        energy_joules,
        energy_density_joules_per_cubic_meter,
    })
}

#[tauri::command]
pub fn capacitor_energy(
    capacitance_farads: f64,
    voltage_volts: f64,
) -> Result<CapacitorEnergyResult, String> {
    require_finite(capacitance_farads, "La capacitancia")?;
    require_finite(voltage_volts, "El voltaje")?;
    if capacitance_farads < 0.0 {
        return Err("La capacitancia no puede ser negativa.".to_string());
    }

    Ok(CapacitorEnergyResult {
        energy_joules: 0.5 * capacitance_farads * voltage_volts.powi(2),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculates_parallel_plate_capacitor_in_vacuum() {
        let result = parallel_plate_capacitor(ParallelPlateInput {
            area_square_meters: 0.01,
            distance_meters: 0.001,
            relative_permittivity: 1.0,
            voltage_volts: 12.0,
        })
        .expect("valid capacitor input");

        assert!((result.capacitance_farads - 8.854_187_812_8e-11).abs() < 1e-22);
        assert!((result.electric_field_volts_per_meter - 12_000.0).abs() < 1e-9);
        assert!((result.charge_coulombs - result.capacitance_farads * 12.0).abs() < 1e-22);
    }

    #[test]
    fn dielectric_increases_capacitance() {
        let vacuum = parallel_plate_capacitor(ParallelPlateInput {
            area_square_meters: 0.02,
            distance_meters: 0.002,
            relative_permittivity: 1.0,
            voltage_volts: 5.0,
        })
        .expect("vacuum case");
        let dielectric = parallel_plate_capacitor(ParallelPlateInput {
            relative_permittivity: 4.0,
            ..ParallelPlateInput {
                area_square_meters: 0.02,
                distance_meters: 0.002,
                relative_permittivity: 1.0,
                voltage_volts: 5.0,
            }
        })
        .expect("dielectric case");

        assert!((dielectric.capacitance_farads / vacuum.capacitance_farads - 4.0).abs() < 1e-12);
    }

    #[test]
    fn calculates_stored_energy() {
        let result = capacitor_energy(2e-6, 10.0).expect("valid energy input");
        assert!((result.energy_joules - 1e-4).abs() < 1e-15);
    }

    #[test]
    fn rejects_zero_plate_distance() {
        let result = parallel_plate_capacitor(ParallelPlateInput {
            area_square_meters: 0.01,
            distance_meters: 0.0,
            relative_permittivity: 1.0,
            voltage_volts: 12.0,
        });
        assert!(result.is_err());
    }
}
