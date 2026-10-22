# QT-291 — Selección de modelo IA por tarea

> **Zona** fullstack · **Complejidad** high · **depends_on** QC-275 (hecha) · **Rama** `feature/QT-291-seleccion-de-modelo-por-tarea`
>
> **Alcance.** En Integraciones › Proveedor IA (`/integraciones/proveedor-ia`) la empresa ve los
> modelos de los cuatro proveedores (Claude, Gemini, OpenAI, OpenRouter) que leen PDF, sacados de
> un catálogo global de modelos que mantiene la plataforma y nace sembrado por migración. Para cada
> tarea (hoy: fórmula desde PDF y catálogo desde PDF) elige un modelo, pero solo entre los de su
> proveedor conectado; los demás se ven como referencia. Si no elige, usa el modelo por defecto del
> catálogo (el de hoy). La lectura usa el modelo elegido, y «Probar conexión» verifica los modelos en uso.
>
> **Lo que NO entra.** Pantalla para que la plataforma agregue o quite modelos del catálogo
> (QT-292). Consultar el listado de modelos a la API de cada proveedor. Agrupar por «lee
> imágenes / solo texto». Modelos que no leen PDF. Respaldo encadenado de proveedores (QC-276) o
> de modelo (QC-175). Medir o limitar consumo.
>
> Sembrado por `/afinar-feature` el 2026-10-22. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- Lista inicial de modelos que siembra el catálogo, por proveedor: la propone `spec_author` en el
  `design.md` (con su fuente y fecha, como QC-275) y la aprueba el humano en F1.4. Incluye si los
  defaults actuales de `ai_providers` entran tal cual.
- ¿Hace falta E2E? No es flujo crítico de `docs/checkpoints-proyecto.md`; lo decide el spec con motivo.
- **BLOQUEANTE (spec_author, 2026-10-22): falta el pase `/design`** del selector de modelo por
  tarea y de la lista de modelos de referencia en `/integraciones/proveedor-ia`. Es UI visible
  nueva en una pantalla existente: los tableros aprobados (`docs/diseno/canvas/ProveedorIA.dc.html`,
  `ProveedorIATablet.dc.html`, `ProveedorIAMovil.dc.html`, de QC-275) solo muestran los modelos
  como texto fijo por proveedor (`[MODELO RECETA]`, `[MODELO CATÁLOGO]`), sin elección, sin la
  lista de los cuatro proveedores ni el estado «modelo elegido ya no disponible». Por
  `docs/perfil-agentes.md > Pase de diseño para componentes nuevos` y `> spec_author`, el spec no
  se escribe hasta que el humano apruebe el tablero (escritorio, tablet y teléfono; estados: sin
  elección/default, elegido, proveedor sin conectar con modelos solo de referencia, Error por
  modelo retirado) y se copie a `docs/diseno/canvas/`.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-22 | ¿De qué proveedores se listan modelos? | De los cuatro del catálogo (Claude, Gemini, OpenAI, OpenRouter). |
| 2026-10-22 | ¿De dónde sale la lista? | De un catálogo global que mantenemos nosotros. No se consulta la API del proveedor para listar. |
| 2026-10-22 | ¿Agrupar por «lee imágenes / solo texto»? | No. Solo entran modelos que interpretan PDF, sin agrupar. |
| 2026-10-22 | ¿Cómo entra un modelo nuevo? | Desde una pantalla de plataforma, en ficha aparte (QT-292). En esta ficha el catálogo nace sembrado por migración. |
| 2026-10-22 | ¿Qué puede elegir la empresa? | Solo modelos de su proveedor conectado; los de los otros tres se ven como referencia. |
| 2026-10-22 | ¿Granularidad? | Un modelo por tarea (fórmula, catálogo), independiente. Sin elección, el default del catálogo. |
| 2026-10-22 | ¿Qué pasa al cambiar de proveedor? | Se borra la elección: vuelven los defaults del nuevo proveedor. |
| 2026-10-22 | ¿Y si el modelo elegido desaparece del proveedor? | La lectura falla y la conexión queda en Error con su aviso hasta que elija otro (patrón QC-275). Sin vuelta automática al default. |
| 2026-10-22 | ¿«Probar conexión» verifica los modelos elegidos? | Sí: prueba los modelos en uso (elegidos o default). |
| 2026-10-22 | ¿Quién elige el modelo? | `integraciones.modificar` (heredado de QC-275 D2). |
| — | Identificadores de DB | En inglés (heredado de QC-4). |
