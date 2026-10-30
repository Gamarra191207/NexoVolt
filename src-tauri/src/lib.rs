mod physics;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            physics::electrostatics::electric_field_at,
            physics::electrostatics::electric_potential_at,
            physics::capacitors::parallel_plate_capacitor,
            physics::capacitors::capacitor_energy,
            physics::circuits::solve_resistor_circuit,
            physics::circuits::solve_ohms_law,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Laboratorio EM");
}
