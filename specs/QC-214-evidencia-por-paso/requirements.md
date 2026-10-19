# QC-214 — evidencia-por-paso · requirements.md

> **Zona:** fullstack · **Complejidad:** medium · **depends_on:** — · **Rama:** `feature/QC-214-evidencia-por-paso`
>
> **Alcance.** En el editor de fórmulas, cada paso de fabricación y cada paso de envasado tiene un
> switch «requiere evidencia», apagado por defecto. Al ejecutar un pedido (fabricación o envasado),
> en un paso con el switch encendido no se puede avanzar hasta tener entre 1 y 3 fotos subidas en
> ese paso; el servidor también lo hace cumplir. Mientras el pedido está en curso, quien lo ejecuta
> puede volver a pasos anteriores y quitar o cambiar sus fotos; el pedido no finaliza si algún paso
> que exige evidencia quedó sin fotos. Al finalizar, las fotos quedan fijas. No se pueden reordenar
> ni borrar pasos de una fórmula con pedidos en curso que tengan fotos. Las fotos se guardan en un
> bucket privado propio, por empresa y por pedido.
>
> **Lo que NO entra.** Ver las fotos en el detalle del pedido y en el registro de ejecución: va en
> QC-271 (bloqueada por esta). Congelar la fórmula al iniciar el pedido. Borrar fotos al cancelar o
> eliminar un pedido. Dar identificador estable a los pasos.
>
> Sembrado por `/afinar-feature` el 2026-10-13. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

**Términos.** Se usan con este sentido en todos los requisitos:

- **Lista**: la de pasos de fabricación (`steps`) o la de pasos de envasado (`packing_steps`).
- **Fase**: *fabricación* (la pantalla de Ejecución del pedido) o *envasado* (la pantalla de
  Empaque). Cada fase recorre su lista.
- **Paso que exige evidencia**: un paso con «Requiere evidencia» encendido **en la fórmula actual**
  (decisión «Rige la fórmula actual»). En una versión, los de su original.
- **Foto contada**: una foto que el servidor registró tras validarla. Una foto subiendo o en error
  no cuenta.
- **Pedido en curso con fotos** de una fórmula: un pedido vivo de la misma empresa cuya receta es
  esa fórmula o una de sus versiones, y que está `EN_CURSO` con al menos una foto de fabricación, o
  `EN_EMPAQUE` con al menos una foto de envasado.
- **Pedido en curso** para una fase: `EN_CURSO` en fabricación, `EN_EMPAQUE` en envasado.

### Editor de fórmulas: el switch

- **R1.** El sistema DEBE ofrecer, en el editor de fórmulas (alta y edición de una fórmula
  original), un interruptor «Requiere evidencia» en cada paso de la lista de fabricación y en cada
  paso de la lista de envasado, que se enciende y se apaga para ese paso sin afectar a los demás,
  operable con teclado y anunciado como interruptor (`role="switch"`).
- **R2.** CUANDO se añade un paso en el editor, o se abre una fórmula guardada sin ese dato, el
  sistema DEBE presentar «Requiere evidencia» apagado en ese paso.
- **R3.** CUANDO se guarda una fórmula, el sistema DEBE persistir el estado de «Requiere evidencia»
  de cada paso de cada lista, y devolverlo igual en cada lectura posterior de la fórmula y de su
  contenido de ejecución y de envasado.
- **R4.** SI la entrada de un paso trae «Requiere evidencia» con un valor que no es booleano,
  ENTONCES el sistema DEBE rechazar el guardado con error de validación y no persistir nada.
- **R5.** MIENTRAS «Requiere evidencia» está encendido en un paso del editor, el sistema DEBE
  marcar ese paso y mostrar en él «Al ejecutar, este paso pide de 1 a 3 fotos antes de avanzar.»;
  y en la cabecera de cada lista DEBE mostrar «Ningún paso pide evidencia», «1 paso pide
  evidencia» o «<n> pasos piden evidencia» según cuántos de sus pasos lo tienen encendido.
- **R6.** El sistema DEBE dar a una versión los valores de «Requiere evidencia» de los pasos de su
  original, y mostrarlos en la lectura de los pasos heredados de la versión sin permitir
  cambiarlos desde ella.
- **R7.** SI quien guarda una fórmula no tiene `recetas.modificar`, ENTONCES el sistema DEBE
  rechazar el guardado, incluido un cambio solo de «Requiere evidencia», sin persistir nada.

### Editor de fórmulas: el bloqueo de mover y quitar

- **R8.** MIENTRAS una fórmula tiene al menos un pedido en curso con fotos, el editor DEBE mostrar
  el aviso «<n> pedidos en curso ya tienen fotos de evidencia» (o «1 pedido en curso ya tiene fotos
  de evidencia») con el texto «Mientras sigan en curso no puedes mover ni quitar pasos. Sí puedes
  cambiar el texto, encender o apagar «Requiere evidencia» y añadir pasos al final.», y DEBE
  deshabilitar mover y quitar pasos en las dos listas, dejando activos editar el texto, el switch
  y «Añadir paso».
  *(Enmienda 2026-10-16, QC-211 D14, commit `5f2cc171`: ya no hay botón «Añadir paso»; añadir es el
  «+» de la barra de cada fila, y con el bloqueo solo queda activo el «+» del último paso, que
  añade al final. Test: `tests/unit/recetas-ui/recipe-form-evidence-lock.test.tsx` › «R8: el
  texto, el interruptor y el «+» del último paso siguen activos; el de los demás no».)*
- **R9.** SI se guarda una fórmula que tiene al menos un pedido en curso con fotos y alguna de sus
  dos listas llega con menos pasos que los guardados, ENTONCES el sistema DEBE rechazar el
  guardado con `recipe_steps_locked` y no persistir nada.
- **R10.** SI se guarda una fórmula que tiene al menos un pedido en curso con fotos y algún paso
  guardado llega, con el mismo contenido, en otra posición de su lista y no en la suya, ENTONCES
  el sistema DEBE rechazar el guardado con `recipe_steps_locked` y no persistir nada.
- **R11.** MIENTRAS una fórmula tiene al menos un pedido en curso con fotos, el sistema DEBE
  aceptar guardar cambios de texto en sus pasos, cambios de «Requiere evidencia» y pasos nuevos
  añadidos al final de cualquiera de las dos listas.
- **R12.** MIENTRAS una fórmula no tiene ningún pedido en curso con fotos, el sistema DEBE aceptar
  reordenar y quitar pasos como hasta ahora.

### Ejecución y Empaque: el bloque de evidencia

- **R13.** MIENTRAS el paso que se muestra en la Ejecución (fabricación) o en el Empaque
  (envasado) exige evidencia, el sistema DEBE mostrar debajo de su contenido el bloque «Evidencia»
  con el contador «<n>/3» de fotos contadas, el texto «Obligatoria · de 1 a 3 fotos», las fotos de
  ese paso y, mientras haya menos de 3, la casilla «Añadir foto» (o «Añadir otra foto» si ya hay
  alguna); y MIENTRAS el paso no exige evidencia, NO DEBE mostrar el bloque.
- **R14.** CUANDO se abre o se retoma la pantalla de un pedido en curso, el sistema DEBE mostrar en
  cada paso las fotos contadas que ya tiene.
- **R15.** MIENTRAS el paso que se muestra exige evidencia y no tiene ninguna foto contada, el
  sistema DEBE deshabilitar «Siguiente» (o el botón de terminar, si es el último paso) y mostrar el
  motivo «Sube al menos 1 foto de evidencia para continuar.».
- **R16.** MIENTRAS haya una foto subiéndose en el paso que se muestra, el sistema DEBE mostrar su
  progreso en porcentaje en su casilla, deshabilitar «Siguiente» (o el botón de terminar) y
  mostrar el motivo «Espera a que termine de subir la foto.».
- **R17.** SI quien ejecuta elige un archivo que no es JPEG, PNG ni WebP, o que tras comprimirlo en
  el navegador sigue pesando más de 5 MB, ENTONCES el sistema DEBE mostrar esa casilla en error con
  su motivo y la acción «Quitar», sin subirlo y sin contarlo.
- **R18.** CUANDO quien ejecuta elige una imagen admitida, el sistema DEBE comprimirla en el
  navegador y subirla directamente al almacenamiento con un enlace de subida firmado, sin que sus
  bytes pasen por la aplicación, y contarla solo cuando el servidor la registre.
- **R19.** CUANDO quien ejecuta usa «Cambiar» sobre una foto contada, el sistema DEBE sustituirla
  por la nueva en la misma posición de la cuadrícula; y CUANDO usa «Quitar», DEBE retirarla para
  que deje de contar.
- **R20.** CUANDO quien ejecuta toca una foto contada, el sistema DEBE abrirla ampliada en un
  diálogo que se cierra con «Cerrar».
- **R21.** MIENTRAS el pedido está en curso, el sistema DEBE permitir volver con «Anterior» a un
  paso ya recorrido y añadir, cambiar o quitar sus fotos con las mismas reglas.
- **R22.** CUANDO quien ejecuta pulsa el botón de terminar (Finalizar en Ejecución, Terminar
  empaque en Empaque) y algún paso de su lista que exige evidencia no tiene ninguna foto contada,
  el sistema DEBE abrir el diálogo «Falta evidencia», en lugar de la confirmación, con un botón
  «Paso <n>» por cada paso en esa situación que lleva a ese paso al pulsarlo.
- **R23.** CUANDO quien ejecuta pulsa el botón de terminar sin ningún paso en la situación de R22 y
  su lista tiene al menos un paso que exige evidencia, la confirmación DEBE decir «Al terminar, las
  fotos de evidencia quedan fijas. No se puede deshacer.».
- **R24.** DONDE el bloque de evidencia se muestra en modo de solo lectura, el sistema DEBE mostrar
  las fotos sin «Añadir foto», «Cambiar» ni «Quitar», con el texto «Fijada al terminar» y la ayuda
  «El pedido ya terminó: las fotos no se pueden cambiar ni quitar.».
- **R25.** El sistema DEBE dar a «Añadir foto», «Cambiar» y «Quitar» un área táctil de al menos
  44 × 44 px, y la entrada de archivo de «Añadir foto» DEBE admitir solo JPEG, PNG y WebP y pedir
  la cámara trasera (`capture="environment"`).

### Servidor: quién puede y qué se registra

- **R26.** SI quien pide subir, registrar, cambiar o quitar una foto de **fabricación** no tiene
  `asignaciones.ejecutar`, no es responsable asignado del pedido, o el pedido no está `EN_CURSO` en
  su empresa, ENTONCES el sistema DEBE rechazarlo sin firmar ningún enlace y sin escribir nada.
- **R27.** SI quien pide subir, registrar, cambiar o quitar una foto de **envasado** no tiene
  `empaque.modificar`, o el pedido no está `EN_EMPAQUE` en su empresa con esa persona como quien
  empaca, ENTONCES el sistema DEBE rechazarlo sin firmar ningún enlace y sin escribir nada.
- **R28.** SI la posición pedida no existe en la lista actual de esa fase, o ese paso no exige
  evidencia, ENTONCES el sistema DEBE rechazar subir o registrar una foto en él sin firmar ni
  escribir nada.
- **R29.** SI el paso ya tiene 3 fotos contadas y la petición no sustituye a una de ellas,
  ENTONCES el sistema DEBE rechazarla con `evidence_limit` sin firmar ni escribir nada, también
  cuando dos peticiones llegan a la vez.
- **R30.** El sistema DEBE construir en el servidor la ruta de cada foto con la forma
  `<empresa>/<pedido>/<identificador>` dentro de un bucket privado propio de las fotos de
  evidencia; ningún campo de la petición puede elegir la ruta.
- **R31.** SI la ruta que se pide registrar no cae dentro de `<empresa del actor>/<pedido
  indicado>/`, ENTONCES el sistema DEBE rechazar el registro sin escribir nada.
- **R32.** CUANDO se registra una foto subida, el sistema DEBE comprobar por su contenido que es
  JPEG, PNG o WebP y que pesa como máximo 5 MB; SI no lo cumple, ENTONCES DEBE rechazarla con
  `evidence_invalid_file`, borrar el archivo y no contarla.
- **R33.** El sistema DEBE servir cada foto solo con una URL de lectura firmada de 15 minutos, y
  solo a quien puede ver esa pantalla del pedido.
- **R34.** SI se pide anotar el avance de un paso de fabricación que exige evidencia y no tiene
  ninguna foto contada, ENTONCES el sistema DEBE rechazarlo con `evidence_required` sin anotarlo.
- **R35.** SI se pide finalizar un pedido (fabricación) y algún paso de fabricación que exige
  evidencia no tiene ninguna foto contada, ENTONCES el sistema DEBE rechazarlo con
  `evidence_required` sin cambiar el estado del pedido.
- **R36.** SI se pide terminar el empaque y algún paso de envasado que exige evidencia no tiene
  ninguna foto contada, ENTONCES el sistema DEBE rechazarlo con `evidence_required` sin cambiar el
  estado del pedido.
- **R37.** CUANDO un paso aún no alcanzado de un pedido en curso pasa a exigir evidencia en la
  fórmula, el sistema DEBE exigirla para ese pedido en ese paso (R15, R34, R35, R36).
- **R38.** MIENTRAS un pedido no está en curso para una fase (terminada esa fase, cancelado o
  dado de baja), el sistema DEBE rechazar añadir, cambiar o quitar fotos de esa fase y DEBE
  conservar las fotos ya registradas y sus archivos, también al cancelar o dar de baja el pedido.
- **R39.** El sistema DEBE filtrar toda lectura y escritura de fotos por la empresa del actor: un
  pedido o una foto de otra empresa se trata como inexistente.

### Cobertura de las decisiones cerradas

| Decisión (fila) | Requisitos |
|---|---|
| ¿A qué pasos aplica el switch? | R1, R2, R3 |
| ¿Y si la fórmula cambia con el pedido en curso? | R37 |
| ¿Reordenar o borrar pasos con pedidos en curso que ya tienen fotos? | R8, R9, R10, R11, R12 |
| ¿Puede corregir fotos? | R19, R21, R38 |
| ¿Un paso puede quedar con 0 fotos? | R15, R22, R34, R35, R36 |
| ¿Quién sube en envasado? | R26, R27, R7 |
| ¿Qué pasa con las fotos al cancelar o eliminar el pedido? | R38 |
| ¿Dónde se ven? | R13, R14, R20 |
| Bucket | R18, R30, R31, R33 |
| Formato y tamaño | R17, R32 |
| Versiones de fórmula | R6 |
| Identificadores y empresa | R39 (los identificadores en inglés, en `design.md > 3`) |
| ¿E2E? | R13, R15, R18, R22, R35 en `e2e/ejecucion-receta.spec.ts` (`tasks.md > T20`) |
| Pase `/design` | R1, R5, R8, R13, R15, R16, R17, R19, R20, R22, R23, R24, R25 |

## Preguntas abiertas

Ninguna bloquea el spec: cada una lleva la opción que el spec toma por defecto si nadie dice otra
cosa al aprobarlo.

1. **Textos exactos** (las dos fichas …Movil los dejan «por confirmar»). El spec usa los del
   tablero; los que el tablero no trae son propuesta: error de formato «No se pudo subir: no es una
   foto JPG, PNG ni WebP. Elige otra foto.», y el de tamaño del tablero, «No se pudo subir: pesa más
   de 5 MB. Elige otra foto.». El aviso de bloqueo del editor da el **número** de pedidos, no sus
   números visibles.
2. **Resolución de la compresión.** El tablero propone máx. 1600 px por lado, «por confirmar».
   `compressImage` usa 2048 px por defecto. Por defecto: **1600 px** (prop `maxDimension`, ya
   existe).
3. **Nombre del paso en «Falta evidencia».** El tablero pinta «Paso <n> · <título>», pero un paso
   no tiene título: es un documento. Por defecto: solo «Paso <n>».
4. **Avance en envasado.** El Empaque no anota hoy los cambios de paso en el servidor
   (`StepReader` sin `onStepChange`), así que en envasado el servidor hace cumplir la evidencia al
   registrar fotos y al terminar el empaque (R36), no en cada «Siguiente». Por defecto: no se añade
   la anotación de pasos al Empaque en esta ficha.
5. **Solo lectura tras finalizar (R24).** Al finalizar, las dos pantallas redirigen a la lista y no
   vuelven a abrir un pedido terminado, así que en esta ficha el modo de solo lectura existe en la
   pieza y en su test, pero ninguna pantalla lo monta: lo monta QC-271 en el detalle del pedido.
6. **Preview.** La variable que enciende el doble de almacenamiento de las fotos
   (`EVIDENCE_E2E_DOUBLES`, `design.md > 6`) queda **ausente** en Preview (bucket real del proyecto
   de preview, que el humano crea). Si se prefiere el doble en Preview, hay que tocar la
   comprobación previa de `scripts/entorno-de-preview.mjs`.
7. **Fotos de un pedido terminado y fórmula reordenada después.** El bloqueo solo rige con pedidos
   en curso (decisión cerrada). Si después se reordena la fórmula, las fotos de un pedido ya
   terminado quedan atadas a un número de paso que ahora es otro paso. Afecta a cómo QC-271 las
   muestra; esta ficha no lo resuelve.
8. **Cámara o galería en el teléfono.** La ficha …Movil pide a la vez «abre directamente la cámara
   trasera, con opción de galería» y la entrada `capture="environment"`. En iOS y Android,
   `capture` abre la cámara sin ofrecer la galería. Por defecto: la entrada literal del tablero
   (R25); si se quiere también la galería, se quita `capture` y el sistema operativo ofrece las dos.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-13 | ¿A qué pasos aplica el switch? | **Fabricación y envasado** (`steps` y `packing_steps`, QC-211). Apagado por defecto; las fórmulas existentes quedan con todos los switches apagados. |
| 2026-10-13 | ¿Y si la fórmula cambia con el pedido en curso? | **Rige la fórmula actual**, como hoy: el pedido lee los pasos en vivo. Encender el switch en un paso aún no alcanzado lo exige al llegar. |
| 2026-10-13 | ¿Reordenar o borrar pasos con pedidos en curso que ya tienen fotos? | **Se bloquea.** Las fotos quedan atadas al número de paso (los pasos no tienen id), así que guardar una fórmula que reordena o borra pasos se rechaza, en el servidor, mientras tenga pedidos en curso con fotos. Sí se puede editar el texto de un paso, cambiar su switch y agregar pasos al final. |
| 2026-10-13 | ¿Puede corregir fotos? | **Sí, mientras el pedido esté en curso**, también en pasos anteriores (volviendo con «Anterior»). Al finalizar quedan fijas. |
| 2026-10-13 | ¿Un paso puede quedar con 0 fotos? | **Uno anterior, sí**. El paso en curso, no: no se avanza sin al menos 1. El pedido (o el empaque) no finaliza mientras algún paso que exige evidencia tenga 0. |
| 2026-10-13 | ¿Quién sube en envasado? | **Quien empaca** (`empaque.modificar`, QC-211), con las mismas reglas: no avanza sin evidencia y no finaliza el empaque con un paso que la exige sin fotos. En fabricación, **heredado de QC-63/QC-201**: `asignaciones.ejecutar` y responsable asignado. El switch lo cambia quien edita fórmulas (`recetas.modificar`). Todo validado en el service, con test. |
| 2026-10-13 | ¿Qué pasa con las fotos al cancelar o eliminar el pedido? | **Se conservan.** Su limpieza, si hace falta, va aparte. |
| 2026-10-13 | ¿Dónde se ven? | En la pantalla de ejecución (y de empaque), en esta ficha. Detalle del pedido y registro de ejecución: QC-271. |
| 2026-10-13 | Bucket | **Privado y propio** (QC-106; QC-171: un bucket por propósito). Ruta `<companyId>/<orderId>/...`; el servidor solo firma dentro de la empresa (QC-106). Subida directa firmada desde el navegador y lectura por URL firmada de 15 min (QC-106). Puerto + adaptador con doble en memoria (QC-25, QC-106). Variable de entorno declarada vacía en `.env.example`. |
| 2026-10-13 | Formato y tamaño | **Heredado de QC-25**: JPEG/PNG/WebP validado por contenido, ≤ 5 MB, compresión en cliente con `components/shared/compress-image.ts`. Sin dependencias nuevas. |
| 2026-10-13 | Versiones de fórmula | **Heredado de QC-172**: las versiones comparten los pasos de la original, así que heredan el switch. |
| 2026-10-13 | Identificadores y empresa | **Inglés** (QC-106 D18). Tabla nueva con columna de empresa y test de rechazo entre empresas (`docs/checkpoints-proyecto.md`). |
| 2026-10-13 | ¿E2E? | **Sí**: se extiende el E2E del flujo del Operador (QC-63), con storage simulado (QC-171). |
| 2026-10-13 | Pase `/design` (era la pregunta abierta 1, bloqueante) | **Aprobado por el humano.** Tableros copiados a `docs/diseno/canvas/` (commit `e0e73640`): bloque de evidencia en Ejecución y Empaque → `EvidenciaPaso.dc.html`, `EvidenciaPasoTablet.dc.html`, `EvidenciaPasoMovil.dc.html` (ficha en el …Movil); switch «Requiere evidencia» en el editor de pasos → `FormulaEvidencia.dc.html`, `FormulaEvidenciaTablet.dc.html`, `FormulaEvidenciaMovil.dc.html` (ficha en el …Movil). Pieza nueva `components/ui/switch` sobre `@base-ui/react` Switch (dependencia ya aprobada). |
| 2026-10-16 | ¿Con qué se añade un paso bajo el bloqueo? | **Enmienda aprobada por el usuario, sin tarjeta** (commit `5f2cc171`, QC-211 D14). Sin botón «Añadir paso»: con el «+» de la barra de la fila. Bajo el bloqueo solo el «+» del último paso sigue activo, así que se sigue añadiendo solo al final. Cubierta por R8 (nota de enmienda). |
