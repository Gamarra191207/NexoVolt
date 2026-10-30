mod physics;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            physics::electrostatics::electric_field_at,
            physics::electrostatics::electric_potential_at,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Laboratorio EM");
}
