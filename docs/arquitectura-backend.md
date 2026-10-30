# Arquitectura backend por unidades

NexoVolt mantiene la estructura de cuatro unidades definida para el proyecto y concentra los cálculos verificables en el backend Rust de Tauri. React y TypeScript gestionan la interacción, la animación y el respaldo para el modo navegador. El backend valida entradas, aplica los modelos físicos y devuelve resultados con unidades explícitas.

## Flujo de cálculo

1. El estudiante modifica una variable o construye un escenario en React.
2. `src/services/physicsBackend.ts` adapta los datos de la interfaz al contrato de la unidad.
3. En la aplicación de escritorio, el adaptador invoca el comando Rust correspondiente.
4. En el navegador de desarrollo, el adaptador usa el modelo TypeScript equivalente.
5. La interfaz actualiza resultados y visualizaciones sin interrumpir la interacción.

## Unidad 1 Electricidad campo eléctrico y potencial eléctrico

### Experiencias

- Distribución editable de hasta diez cargas puntuales en 2D y 3D.
- Consulta del campo eléctrico y potencial en un punto.
- Trayectoria de una partícula cargada bajo la distribución configurada.

### Contratos backend

- `electric_field_at`: recibe un punto en centímetros y cargas en culombios. Devuelve las componentes y la magnitud del campo en newtons por culombio.
- `electric_potential_at`: usa la misma distribución y devuelve el potencial en voltios.

El backend aplica superposición y la ley de Coulomb en vacío. Ignora contribuciones a menos de un micrómetro del centro de una carga para evitar singularidades numéricas.

## Unidad 2 Capacitores y dieléctricos

### Experiencias

- Capacitor de placas paralelas con área y separación variables.
- Comparación de materiales mediante permitividad relativa.
- Cálculo de carga, campo y energía almacenada.

### Contratos backend

- `parallel_plate_capacitor`: recibe área en metros cuadrados, distancia en metros, permitividad relativa y voltaje. Devuelve capacitancia, carga, campo, energía y densidad de energía.
- `capacitor_energy`: recibe capacitancia en faradios y voltaje en voltios. Devuelve energía en julios.

El modelo supone placas ideales, material lineal homogéneo e isotrópico y efectos de borde despreciables.

## Unidad 3 Corriente eléctrica y ley de Ohm

### Experiencias

- Construcción de circuitos con resistencias y elementos de control.
- Configuraciones en serie, paralelo y mixtas.
- Exploración en tiempo real de la relación entre voltaje, corriente, resistencia y potencia.

### Contratos backend

- `solve_resistor_circuit`: recibe topología, voltaje de fuente y resistencias en ohmios. Devuelve resistencia equivalente, corriente total, potencia total y resultados por resistencia.
- `solve_ohms_law`: recibe voltaje y resistencia. Devuelve corriente y potencia.

El solver admite hasta veinte resistencias positivas. La topología mixta usa la primera resistencia en serie con el paralelo de las restantes.

## Unidad 4 Fuerza y campo magnético

### Experiencias

- Visualización de campos producidos por imanes y corrientes.
- Brújula móvil para observar dirección e intensidad relativa.
- Movimiento de una carga en campos eléctricos y magnéticos cruzados.

### Contratos backend

- `magnetic_field_from_current`: calcula la magnitud del campo para un conductor rectilíneo infinito, el centro de una espira circular o un solenoide largo ideal.
- `lorentz_force`: recibe carga, masa, velocidad y campos vectoriales en tres dimensiones. Devuelve las contribuciones eléctrica y magnética, la fuerza total y la aceleración.

Los campos de fuentes se modelan con aproximaciones ideales. La dirección y la animación completa de la trayectoria se mantienen en la experiencia interactiva.

## Validación y límites

- Todos los valores numéricos que llegan al backend deben ser finitos.
- Las longitudes, masas, áreas y resistencias que representan magnitudes físicas deben ser mayores que cero.
- Las respuestas exponen la unidad en el nombre de cada campo para evitar conversiones implícitas.
- Quince pruebas unitarias en Rust cubren casos de referencia, combinaciones y entradas inválidas de las cuatro unidades.

## Distribución de ramas

- `backend/gamarra-unidades-1-2`: electrostática, capacitores y sus pruebas.
- `backend/suarez-unidades-3-4`: circuitos, magnetismo y sus pruebas; continúa desde Gamarra.
- `frontend/villaizan-integracion-unidades`: puente React-Tauri, estado del motor y organización visual; continúa desde Suarez.

Esta secuencia permite revisar cada responsabilidad por separado y conserva en la rama de Villaizan la integración completa del proyecto.
