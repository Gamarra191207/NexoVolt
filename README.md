# Laboratorio EM

Aplicación educativa de escritorio para explorar cuatro temas de electromagnetismo con simulaciones interactivas orientadas a nivel universitario.

## Tecnologías

- Tauri 2 para el contenedor de escritorio.
- React, TypeScript y Vite para la interfaz.
- SVG/CSS para los diagramas y visualizaciones interactivas.
- TypeScript para los modelos numéricos de los módulos.

## Ejecutar la interfaz

```sh
npm install
npm run dev
```

## Ejecutar como aplicación de escritorio

Instala Rust y las dependencias de compilación de Tauri para Windows. Después:

```sh
npm install
npm run tauri dev
```

## Módulos

1. Campo eléctrico y potencial eléctrico
2. Capacitores y dieléctricos
3. Corriente eléctrica y ley de Ohm
4. Fuerza y campo magnético

Las cuatro unidades funcionan como espacios de experimentación interactivos. La interfaz mantiene una respuesta inmediata para controles y animaciones, mientras que los cálculos verificables también están expuestos como comandos del backend Rust de Tauri. Durante el desarrollo web, el puente conserva un motor TypeScript equivalente para poder ejecutar la interfaz sin el contenedor de escritorio.

## Backend físico por unidades

| Unidad | Contratos Tauri | Alcance |
| --- | --- | --- |
| 1 | `electric_field_at`, `electric_potential_at` | Campo y potencial de hasta diez cargas puntuales. |
| 2 | `parallel_plate_capacitor`, `capacitor_energy` | Capacitancia, carga, campo, energía y densidad de energía. |
| 3 | `solve_resistor_circuit`, `solve_ohms_law` | Circuitos en serie, paralelo y mixtos; corriente, voltaje y potencia. |
| 4 | `magnetic_field_from_current`, `lorentz_force` | Campo de conductores y fuerza de Lorentz vectorial. |

Los contratos, unidades de medida, supuestos y validaciones están descritos en [docs/arquitectura-backend.md](docs/arquitectura-backend.md).

### Módulo 1: campo eléctrico y potencial

- Distribución editable de hasta diez cargas puntuales. Cada carga admite signo, magnitud y prefijos SI desde pico hasta tera.
- Visualizador 2D con líneas de campo y curvas equipotenciales; vista 3D proyectada con campo vectorial y superficies equipotenciales trianguladas de forma aproximada.
- Calculadora de potencial y campo integrada en los visualizadores 2D y 3D; permite indicar la ubicación x, y, z en centímetros y muestra los resultados en notación científica.
- Navegación de la vista 3D con rotación por arrastre, desplazamiento con `Shift` + arrastre y zoom con la rueda del mouse.
- Simulador de la trayectoria de una partícula cargada bajo el campo de la distribución actual, con condiciones iniciales editables e integración Runge–Kutta de cuarto orden.
- Se asume electrostática en vacío y cargas puntuales. La vista 3D es una proyección visual aproximada; el campo y potencial numéricos se calculan en tres dimensiones.

### Módulo 2: capacitores y dieléctricos

- Placas paralelas: `C = ε₀ εᵣ A / d`, `Q = CV`, `E ≈ V/d` y `U = ½CV²`.
- La vista 3D actualiza en vivo el tamaño de las placas con el área y su separación con la distancia. Se puede orbitar arrastrando la escena, ajustar las rotaciones X/Y/Z y acercar con la rueda. Los parámetros se pueden introducir con controles numéricos o ajustar con deslizadores. Las ecuaciones están disponibles en un repositorio dentro del módulo.
- Incluye una selección explícita entre vacío y material dieléctrico, además de una calculadora independiente de energía almacenada que recibe capacitancia y voltaje.
- Dieléctrico lineal, homogéneo e isotrópico: comparación del sistema con voltaje constante (batería conectada) y carga constante (batería desconectada), incluida la polarización `P = ε₀χₑE` y la densidad de energía `u = ½εE²`.
- Energía almacenada calculada en vivo a partir de la capacitancia y el voltaje actuales del simulador.
- Aproximaciones: capacitores ideales, dieléctricos uniformes y efectos de borde despreciables en las placas paralelas.
