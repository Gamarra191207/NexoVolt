# Manual de usuario de NexoVolt

## Propósito

NexoVolt es un laboratorio de escritorio para explorar cuatro temas de electromagnetismo: campo y potencial eléctrico, capacitores, circuitos resistivos y magnetismo. Este manual explica cómo iniciar la aplicación, navegar entre estaciones, modificar los experimentos y leer los resultados.

La aplicación responde en tiempo real. Los valores se recalculan cuando se cambia un control, se arrastra un elemento o se selecciona un caso de estudio. Las simulaciones representan modelos físicos ideales y están destinadas al aprendizaje, la comparación de magnitudes y la comprobación de relaciones matemáticas.

## Requisitos e inicio

### Uso desde el código fuente

1. Instale Node.js, npm y Rust.
2. Instale las dependencias con `npm install`.
3. Ejecute `npm run tauri dev` para abrir la aplicación de escritorio.
4. Para usar únicamente la interfaz web durante el desarrollo, ejecute `npm run dev` y abra la dirección mostrada por Vite.

### Compilación de producción

- `npm run build` compila el frontend.
- `npm run tauri build` genera la aplicación de escritorio. En Windows también se requieren las dependencias de compilación indicadas por Tauri.

## Organización de la interfaz

La barra lateral permanece visible durante el uso normal y contiene Inicio y las cuatro estaciones. Inicio muestra el directorio general. Cada estación abre un espacio de trabajo con su nombre, una descripción breve y un botón de pantalla completa.

| Elemento | Función |
| --- | --- |
| Inicio | Regresa al directorio de estaciones. |
| Todos los módulos | Regresa al directorio desde una estación. |
| Pestañas de experiencia | Cambian entre experiencias de la misma estación. |
| Pantalla completa | Amplía el banco de experimentación actual. |
| Reiniciar | Restablece los valores iniciales de la experiencia. |
| Panel de resultados | Muestra magnitudes, unidades y estado del sistema en vivo. |

Los campos numéricos aceptan valores directos. Los deslizadores permiten una exploración rápida. En los visualizadores se puede arrastrar para mover elementos u orbitar la escena y utilizar la rueda para acercar o alejar.

## Estación de campo y potencial eléctrico

Esta estación permite construir distribuciones de hasta diez cargas puntuales, observar líneas de campo, visualizar equipotenciales y medir el campo y el potencial en un punto P.

### Cargas y potencial

1. Elija uno de los casos Atracción, Repulsión, Dipolo, Superposición o Libre.
2. Seleccione 2D o 3D.
3. Active Flujo del campo o Equipotenciales según el análisis que desea realizar.
4. Use Agregar carga o Quitar carga para modificar la distribución.
5. Para cada carga, defina signo, magnitud, prefijo SI y coordenadas x, y, z en centímetros.
6. Modifique las coordenadas del punto P o use Centrar.
7. Lea en Resultados en P la magnitud del campo, el potencial y las componentes Ex, Ey y Ez.

En la vista 3D, arrastre el fondo para orbitar. Use Mayús más arrastre para desplazar la cámara y la rueda para acercar o alejar. El botón Centrar cargas ajusta el encuadre y Reiniciar recupera el caso inicial.

### Trayectoria de partículas

1. Abra la pestaña Trayectoria de partículas.
2. Defina las cargas fuente o seleccione un caso preparado.
3. Indique posición inicial, velocidad, carga y masa de la partícula.
4. Configure la duración y ejecute la simulación.
5. Observe la trayectoria, la velocidad y la evolución temporal.

La trayectoria se integra numéricamente. Si los valores iniciales producen aceleraciones extremas, la simulación puede terminar antes para evitar resultados no finitos.

## Estación de capacitores y dieléctricos

La experiencia representa un capacitor ideal de placas paralelas y calcula capacitancia, carga, diferencia de potencial, campo y energía.

1. Ajuste el área de cada placa en centímetros cuadrados.
2. Ajuste la separación en milímetros.
3. Defina el voltaje de la fuente.
4. Seleccione Vacío o Dieléctrico y, si corresponde, establezca la permitividad relativa.
5. Use Conectar batería para comparar dos situaciones:
   - Batería conectada: el voltaje se mantiene constante y la carga cambia con la capacitancia.
   - Batería desconectada: la carga se conserva y el voltaje cambia con la capacitancia.
6. Lea la capacitancia, carga, campo, energía, susceptibilidad, polarización y densidad de energía.

La vista 3D representa el cambio de área y separación. Arrastre la escena para orbitar, use los controles de rotación X, Y y Z, y ajuste el zoom. Restablecer recupera la cámara inicial sin cambiar las variables físicas; Reiniciar restablece todo el experimento.

## Estación de corriente eléctrica y ley de Ohm

La estación contiene un constructor de circuitos y un explorador de la ley de Ohm.

### Constructor de circuitos

1. Seleccione En blanco, Serie, Paralelo, Mixto o Iluminación.
2. Elija la ubicación donde desea agregar un componente.
3. Añada resistencias, focos o interruptores.
4. En circuitos paralelos, use Añadir rama o elimine una rama existente.
5. Seleccione un componente en el diagrama para editar su resistencia, estado o ubicación.
6. Ajuste el voltaje de la fuente DC.
7. Lea la resistencia equivalente, corriente total, potencia total y voltajes de cada parte.

Un interruptor abierto interrumpe su trayectoria. Una rama vacía no conduce. El panel indica Circuito cerrado cuando existe al menos una trayectoria completa entre los terminales de la fuente.

### Ley de Ohm

1. Abra la pestaña Ley de Ohm.
2. Cambie voltaje y resistencia.
3. Observe la corriente y la potencia calculadas.
4. Compare cómo la corriente aumenta con el voltaje y disminuye cuando crece la resistencia.

## Estación de fuerza y campo magnético

La estación reúne una cartografía cualitativa del campo magnético y una cámara para analizar la fuerza de Lorentz.

### Cartografía de campo

1. Seleccione Imán de barra o Electroimán.
2. Ajuste la intensidad relativa de la fuente.
3. Arrastre la fuente y la sonda P-01 dentro del visor.
4. Use la rueda para el zoom y arrastre el fondo para navegar.
5. Active Invertir orientación para intercambiar el sentido de los polos o de la corriente.
6. Lea la intensidad relativa y el ángulo local en la sonda.

Las líneas y flechas muestran dirección y variación relativa. No sustituyen una medición absoluta en teslas para una geometría real.

### Cámara de Lorentz

1. Abra la pestaña Cámara de Lorentz.
2. Seleccione un caso preparado o ajuste campo eléctrico, campo magnético, velocidad, carga, masa y duración.
3. Coloque la partícula en la posición inicial.
4. Inicie la reproducción y cambie la velocidad de reproducción si es necesario.
5. Compare la fuerza eléctrica, la fuerza magnética y la fuerza total.

Una carga negativa invierte la dirección de la fuerza. Con campo magnético uniforme y sin campo eléctrico, la trayectoria ideal tiende a ser circular; con campos cruzados aparece una deriva o una selección de velocidades según los parámetros.

## Lectura correcta de resultados

| Magnitud | Unidad principal | Interpretación |
| --- | --- | --- |
| Campo eléctrico | N/C o V/m | Fuerza por unidad de carga. |
| Potencial eléctrico | V | Energía potencial por unidad de carga. |
| Capacitancia | F | Capacidad de almacenar carga por voltio. |
| Carga | C | Cantidad de carga en las placas o partículas. |
| Energía | J | Energía almacenada o asociada al movimiento. |
| Resistencia | ohm | Oposición al paso de corriente. |
| Corriente | A | Flujo de carga por unidad de tiempo. |
| Potencia | W | Rapidez de transferencia de energía. |
| Campo magnético | T | Intensidad del campo magnético. |
| Fuerza | N | Resultado eléctrico, magnético o combinado. |

Los prefijos p, n, micro, m, k, M, G y T representan potencias de diez. Antes de comparar resultados, verifique que las unidades y los prefijos coincidan.

## Solución de problemas

| Situación | Acción recomendada |
| --- | --- |
| La aplicación no inicia | Ejecute `npm install`, confirme la instalación de Rust y revise los requisitos de Tauri. |
| Un valor cambia demasiado rápido | Reduzca carga, campo, velocidad o duración y reinicie la experiencia. |
| No circula corriente | Cierre los interruptores y compruebe que exista una trayectoria completa. |
| La vista quedó fuera de encuadre | Use Centrar, Restablecer o Reiniciar según la estación. |
| No aparecen equipotenciales | Active Equipotenciales y pruebe otra escala o distribución de cargas. |
| La pantalla completa no se activa | Use la aplicación de escritorio y verifique que otra ventana no bloquee la solicitud. |

## Alcance y buenas prácticas

Los modelos usan cargas puntuales, placas ideales, resistores ideales y fuentes magnéticas simplificadas. Se omiten efectos de borde, pérdidas, temperatura, saturación magnética, radiación y otras propiedades de dispositivos reales. Use NexoVolt para explorar tendencias, contrastar ecuaciones y preparar experimentos; no lo utilice como sustituto de mediciones de seguridad o diseño de equipos reales.

Para una práctica reproducible, anote el caso seleccionado, todas las variables, las unidades, los resultados y una explicación física de la tendencia observada.
