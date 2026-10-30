use serde::{Deserialize, Serialize};

const MAXIMUM_RESISTORS: usize = 20;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CircuitTopology {
    Series,
    Parallel,
    Mixed,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CircuitInput {
    pub topology: CircuitTopology,
    pub source_voltage_volts: f64,
    pub resistances_ohms: Vec<f64>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResistorResult {
    pub resistance_ohms: f64,
    pub voltage_volts: f64,
    pub current_amperes: f64,
    pub power_watts: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CircuitResult {
    pub equivalent_resistance_ohms: f64,
    pub total_current_amperes: f64,
    pub total_power_watts: f64,
    pub resistors: Vec<ResistorResult>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OhmsLawResult {
    pub voltage_volts: f64,
    pub resistance_ohms: f64,
    pub current_amperes: f64,
    pub power_watts: f64,
}

fn validate_voltage(voltage: f64) -> Result<(), String> {
    if !voltage.is_finite() || voltage < 0.0 {
        Err("El voltaje debe ser un número finito mayor o igual que cero.".to_string())
    } else {
        Ok(())
    }
}

fn validate_resistances(resistances: &[f64]) -> Result<(), String> {
    if resistances.is_empty() {
        return Err("El circuito debe incluir al menos una resistencia.".to_string());
    }
    if resistances.len() > MAXIMUM_RESISTORS {
        return Err(format!(
            "El circuito admite como máximo {MAXIMUM_RESISTORS} resistencias."
        ));
    }
    if resistances
        .iter()
        .any(|resistance| !resistance.is_finite() || *resistance <= 0.0)
    {
        return Err("Todas las resistencias deben ser finitas y mayores que cero.".to_string());
    }
    Ok(())
}

fn parallel_equivalent(resistances: &[f64]) -> f64 {
    1.0 / resistances
        .iter()
        .map(|resistance| 1.0 / resistance)
        .sum::<f64>()
}

#[tauri::command]
pub fn solve_resistor_circuit(input: CircuitInput) -> Result<CircuitResult, String> {
    validate_voltage(input.source_voltage_volts)?;
    validate_resistances(&input.resistances_ohms)?;

    if matches!(input.topology, CircuitTopology::Mixed) && input.resistances_ohms.len() < 3 {
        return Err(
            "La topología mixta requiere una resistencia en serie y al menos dos en paralelo."
                .to_string(),
        );
    }

    let voltage = input.source_voltage_volts;
    let (equivalent_resistance_ohms, resistors) = match input.topology {
        CircuitTopology::Series => {
            let equivalent = input.resistances_ohms.iter().sum::<f64>();
            let current = voltage / equivalent;
            let results = input
                .resistances_ohms
                .iter()
                .map(|resistance| ResistorResult {
                    resistance_ohms: *resistance,
                    voltage_volts: current * resistance,
                    current_amperes: current,
                    power_watts: current.powi(2) * resistance,
                })
                .collect();
            (equivalent, results)
        }
        CircuitTopology::Parallel => {
            let equivalent = parallel_equivalent(&input.resistances_ohms);
            let results = input
                .resistances_ohms
                .iter()
                .map(|resistance| {
                    let current = voltage / resistance;
                    ResistorResult {
                        resistance_ohms: *resistance,
                        voltage_volts: voltage,
                        current_amperes: current,
                        power_watts: voltage * current,
                    }
                })
                .collect();
            (equivalent, results)
        }
        CircuitTopology::Mixed => {
            let series_resistance = input.resistances_ohms[0];
            let parallel_resistance = parallel_equivalent(&input.resistances_ohms[1..]);
            let equivalent = series_resistance + parallel_resistance;
            let total_current = voltage / equivalent;
            let parallel_voltage = total_current * parallel_resistance;
            let mut results = vec![ResistorResult {
                resistance_ohms: series_resistance,
                voltage_volts: total_current * series_resistance,
                current_amperes: total_current,
                power_watts: total_current.powi(2) * series_resistance,
            }];
            results.extend(input.resistances_ohms[1..].iter().map(|resistance| {
                let current = parallel_voltage / resistance;
                ResistorResult {
                    resistance_ohms: *resistance,
                    voltage_volts: parallel_voltage,
                    current_amperes: current,
                    power_watts: parallel_voltage * current,
                }
            }));
            (equivalent, results)
        }
    };

    let total_current_amperes = voltage / equivalent_resistance_ohms;
    Ok(CircuitResult {
        equivalent_resistance_ohms,
        total_current_amperes,
        total_power_watts: voltage * total_current_amperes,
        resistors,
    })
}

#[tauri::command]
pub fn solve_ohms_law(voltage_volts: f64, resistance_ohms: f64) -> Result<OhmsLawResult, String> {
    validate_voltage(voltage_volts)?;
    validate_resistances(&[resistance_ohms])?;
    let current_amperes = voltage_volts / resistance_ohms;
    Ok(OhmsLawResult {
        voltage_volts,
        resistance_ohms,
        current_amperes,
        power_watts: voltage_volts * current_amperes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solve(topology: CircuitTopology) -> CircuitResult {
        solve_resistor_circuit(CircuitInput {
            topology,
            source_voltage_volts: 12.0,
            resistances_ohms: vec![10.0, 20.0, 30.0],
        })
        .expect("valid circuit")
    }

    #[test]
    fn solves_series_circuit() {
        let result = solve(CircuitTopology::Series);
        assert!((result.equivalent_resistance_ohms - 60.0).abs() < 1e-12);
        assert!((result.total_current_amperes - 0.2).abs() < 1e-12);
        assert!(
            (result
                .resistors
                .iter()
                .map(|item| item.voltage_volts)
                .sum::<f64>()
                - 12.0)
                .abs()
                < 1e-12
        );
    }

    #[test]
    fn solves_parallel_circuit() {
        let result = solve(CircuitTopology::Parallel);
        assert!((result.equivalent_resistance_ohms - 60.0 / 11.0).abs() < 1e-12);
        assert!(result
            .resistors
            .iter()
            .all(|resistor| (resistor.voltage_volts - 12.0).abs() < 1e-12));
    }

    #[test]
    fn solves_mixed_circuit() {
        let result = solve(CircuitTopology::Mixed);
        assert!((result.equivalent_resistance_ohms - 22.0).abs() < 1e-12);
        assert!(
            (result.resistors[1].voltage_volts - result.resistors[2].voltage_volts).abs() < 1e-12
        );
    }

    #[test]
    fn applies_ohms_law() {
        let result = solve_ohms_law(9.0, 3.0).expect("valid ohm input");
        assert!((result.current_amperes - 3.0).abs() < 1e-12);
        assert!((result.power_watts - 27.0).abs() < 1e-12);
    }
}
