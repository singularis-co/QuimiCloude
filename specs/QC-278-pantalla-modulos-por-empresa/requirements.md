# QC-278 — pantalla-modulos-por-empresa · requirements.md

> **Zona:** frontend · **Complejidad:** sin evaluar · **depends_on:** QC-166, QC-277 · **Rama:** `feature/QC-278-pantalla-modulos-por-empresa`
>
> **Alcance.** Pestaña Módulos del detalle de empresa del Maestro: los 5 añadidos con su
> interruptor y su estado, «Prender todos» y «Apagar todos», y el Núcleo como fichas fijas.
> Consume las tres acciones de QC-277.
>
> **Lo que NO entra.** El detalle de empresa y sus otras pestañas (QC-166). Las reglas de
> encendido y apagado (QC-277). Planes (QC-182, QC-186) y cobro (QC-187 y siguientes).
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.
>
> **Aprobado el 2026-10-19** («Apruebo con defectos»: P1–P4 quedan con su defecto).
>
> **Enmienda contra dev (2026-10-19).** Tras el merge de `origin/dev` (`a01b5c11`: QC-166 #267 y
> QC-263 #266), el spec se contrastó con el **código** mergeado. Ningún requisito cambia de
> comportamiento. Aquí solo cambia: (a) R10, R15 y R19 citan la pregunta cerrada en vez de
> «sujeto a la pregunta abierta», con el mismo defecto aprobado; (b) R1 nombra el panel que ya pinta
> el detalle (`app/(private)/maestro/empresas/[id]/page.tsx:108-121`). Rutas, nombres, citas,
> tests y guardias: lista completa con citas en `design.md > 0. Enmienda contra dev (2026-10-19)`
> (E1–E16).

## Requisitos (EARS)

Vocabulario (el de **QC-277**):

- **Añadido:** uno de los cinco módulos apagables (QC-277 R2, D3), en el orden del catálogo:
  Dashboard y recorrido, Proveedores, Lectura de PDF con IA, Importación desde Excel e
  Integraciones.
- **Interruptor:** lo guardado para un añadido de la empresa (`enabled`). **Activo:** prendido y
  con sus dependencias prendidas (`active`, QC-277 R4).
- **Vista de añadidos:** lo que devuelven las tres acciones de QC-277 para la empresa
  (`CompanyAddonsView`).
- **Pestaña:** el contenido de la pestaña Módulos del detalle de empresa del Maestro. El detalle,
  sus pestañas y su ruta son de QC-166.

### Montaje y carga

- **R1** — El sistema DEBE ofrecer la pestaña como una pieza que se monta en el panel «Módulos»
  del detalle de QC-166, en `/maestro/empresas/[id]?tab=modulos`. Recibe del detalle el
  identificador de la empresa, su nombre, si está de baja y si quien mira puede modificar. La
  pestaña no lee la sesión ni decide permisos.
- **R2** — CUANDO se abre la pestaña, el sistema DEBE pedir la vista de añadidos de esa empresa
  una sola vez, en el servidor.
- **R3** — MIENTRAS la vista de añadidos no haya llegado, el sistema DEBE mostrar «Cargando los
  módulos…» con un esqueleto de las filas, en una región que anuncia la carga a los lectores de
  pantalla.
- **R4** — SI la vista de añadidos no se puede cargar, ENTONCES el sistema DEBE mostrar el
  recuadro de error «No pudimos cargar los módulos», con el mensaje del catálogo de errores, la
  referencia si el error es inesperado y «Reintentar». No DEBE mostrar ningún interruptor ni el
  Núcleo.

### Añadidos

- **R5** — CUANDO la vista de añadidos llega, el sistema DEBE mostrar la sección «Añadidos» con
  una fila por cada uno de los cinco añadidos, en el orden de la vista. Cada fila lleva:
  - nombre, descripción e icono del añadido;
  - su estado;
  - su interruptor, en la posición del interruptor guardado.
- **R6** — El sistema DEBE mostrar el estado de cada añadido así, a partir de la vista y de nada
  más:
  - **Prendido** si está activo;
  - **Sin efecto** si el interruptor está prendido y no está activo;
  - **Apagado** si el interruptor está apagado.
- **R7** — DONDE un añadido necesite otro (en el catálogo actual, Lectura de PDF con IA necesita
  Integraciones), el sistema DEBE mostrar en su fila «Necesita <nombres>.». MIENTRAS ese añadido
  esté «Sin efecto», el aviso DEBE ir en tono de advertencia y añadir «Préndela para que
  funcione.».
- **R8** — El sistema DEBE mostrar en la cabecera de la sección cuántos interruptores hay prendidos
  de los cinco («<n> de 5 prendidos.») y que al apagar uno desaparece para todos los usuarios de
  la empresa desde su siguiente acción.

### Prender y apagar

- **R9** — CUANDO el Maestro prende el interruptor de un añadido, el sistema DEBE guardarlo sin
  pedir confirmación.
- **R10** — CUANDO el Maestro apaga el interruptor de un añadido, el sistema DEBE pedir
  confirmación antes de guardar, con:
  - el título «¿Apagar <nombre>?» y el nombre de la empresa;
  - lo que se descarta al apagarlo (Lectura de PDF con IA: las lecturas en cola terminan como
    fallidas y las revisiones sin confirmar quedan ocultas; Importación desde Excel: las
    revisiones sin confirmar quedan ocultas; Integraciones: Lectura de PDF con IA deja de
    funcionar, solo si el interruptor de Lectura de PDF con IA está prendido, pregunta 3 cerrada);
  - «Volver», que cierra sin guardar, y «Apagar», que guarda.
- **R11** — CUANDO el Maestro pulsa «Prender todos», el sistema DEBE prender a la vez todos los
  añadidos apagados, sin pedir confirmación.
- **R12** — CUANDO el Maestro pulsa «Apagar todos», el sistema DEBE pedir confirmación antes de
  guardar, con:
  - el título «¿Apagar los <n> módulos prendidos?»;
  - los nombres de los añadidos que se apagan y el nombre de la empresa;
  - lo que se descarta, sin repetir líneas;
  - «Volver», que cierra sin guardar, y «Apagar todos», que guarda.
- **R13** — MIENTRAS no haya ningún añadido apagado, «Prender todos» DEBE estar deshabilitado.
  MIENTRAS no haya ningún añadido prendido, «Apagar todos» DEBE estar deshabilitado.
- **R14** — MIENTRAS una escritura está en curso, el sistema DEBE:
  - mostrar un indicador de carga en el interruptor de cada añadido que esa escritura cambia;
  - deshabilitar todos los interruptores y los dos botones hasta que responda.
- **R15** — CUANDO una escritura responde con éxito, el sistema DEBE:
  - pintar la vista de añadidos que devuelve la propia escritura, sin volver a pedirla ni
    recargar la página;
  - avisar con un toast: «<nombre> prendido.», «<nombre> apagado.», «Se prendieron <n>
    módulos.» o «Se apagaron <n> módulos.», con <n> los añadidos que cambiaron; con uno solo,
    «Se prendió 1 módulo.» o «Se apagó 1 módulo.» (pregunta 4 cerrada).
- **R16** — SI una escritura de un solo añadido falla, ENTONCES el sistema DEBE devolver su
  interruptor a la posición anterior y mostrar junto a su fila el aviso de error «No se guardó el
  cambio», con el mensaje del catálogo de errores y la referencia si el error es inesperado.
- **R17** — SI «Prender todos» o «Apagar todos» falla, ENTONCES el sistema DEBE dejar todos los
  interruptores como estaban y mostrar el mismo aviso de error bajo los dos botones.
- **R18** — CUANDO el Maestro cambia de nuevo un interruptor o pulsa un botón, el sistema DEBE
  quitar el aviso de error anterior.

### Núcleo

- **R19** — CUANDO la vista de añadidos llega, el sistema DEBE mostrar la sección «Núcleo» («Siempre
  prendido en todas las empresas. No se puede apagar.») con una ficha con candado por cada módulo
  del núcleo de QC-277 D2, sin interruptor y sin nada que se pueda pulsar: Usuarios y grupos,
  Unidades, Presentaciones, Inventario, Fórmulas, Pedidos, Asignación y ejecución, Empaque,
  Acondicionamiento, Terminados y entregas, y Clientes: 11 fichas (pregunta 2 cerrada).

### Empresa de baja y permisos

- **R20** — MIENTRAS la empresa esté de baja, el sistema DEBE mostrar sus añadidos y su Núcleo
  como en R5–R8 y R19, con el aviso «Esta empresa está de baja. Reactívala para cambiar sus
  módulos.», y DEBE deshabilitar todos los interruptores, «Prender todos» y «Apagar todos».
- **R21** — SI quien mira no puede modificar la empresa (no tiene `empresas.modificar`),
  ENTONCES el sistema DEBE mostrar los añadidos y el Núcleo con todos los interruptores y los dos
  botones deshabilitados.
- **R22** — El sistema NO DEBE decidir en el cliente si un añadido está activo, ni guardar un
  interruptor por otra vía que las tres acciones de QC-277. Lo que se pinta sale siempre de la
  última vista que devolvió el servidor.

### Accesibilidad y plataformas

- **R23** — Cada interruptor DEBE ser un control `switch` con nombre accesible «Prender <nombre>»
  o «Apagar <nombre>» según su posición, que se acciona con teclado, ratón o tacto.
- **R24** — En un teléfono (menos de 768 px de ancho) el sistema DEBE:
  - poner el interruptor a la derecha del nombre, con un objetivo táctil de al menos 44 × 44 px;
  - poner el estado bajo la descripción;
  - poner «Prender todos» y «Apagar todos» a todo el ancho.

### Extremo a extremo

- **R25** — Un E2E DEBE cubrir, con el Maestro en la pestaña Módulos de una empresa de prueba y
  un Administrador de esa empresa con su sesión abierta:
  - el Maestro prende Proveedores y, al recargar, el Administrador ve Proveedores en su menú, sin
    volver a iniciar sesión;
  - el Maestro apaga Proveedores (con su confirmación) y, al recargar, el Administrador ya no lo
    ve en su menú.

## Preguntas abiertas

**P1–P4 cerradas el 2026-10-19** con su defecto («Apruebo con defectos», Carlos Restrepo;
`progress/features/QC-278.md > Decisiones`). P5 se cerró el 2026-10-16. **No queda ninguna
abierta**, tampoco tras la enmienda contra dev (`design.md > 0`).

1. ~~**Descripción de cada añadido.**~~ **Cerrada el 2026-10-19: se usan las propuestas tal cual.** Se proponen: Dashboard y recorrido «Indicadores del día y
   recorrido de cada pedido.»; Proveedores «Directorio de proveedores y su catálogo.»; Lectura de
   PDF con IA «Lee fórmulas y catálogos desde un PDF.»; Importación desde Excel «Carga inventario
   y catálogos desde una hoja de cálculo.»; Integraciones «Proveedor IA, Inventarios y
   WhatsApp.». El humano las confirma en la revisión del spec.

Añadidas por `spec_author` (F1.2). Ninguna bloquea el spec: cada una lleva el defecto con el que
se diseñó, y cambiarlo toca solo lo que se cita.

2. ~~**Terminados y entregas: ¿una ficha o dos?**~~ **Cerrada el 2026-10-19 con el defecto: una
   ficha, 11 en total.** QC-277 D2 nombra «terminados, entregas» por
   separado; el tablero aprobado (`MaestroEmpresa.dc.html`) los junta en una ficha, «Terminados y
   entregas», y pinta 11. **Defecto:** el tablero (11 fichas, R19). Cambiarlo toca la lista de
   R19 y `core-modules.ts`.
3. ~~**Línea de Integraciones en la confirmación.**~~ **Cerrada el 2026-10-19 con el defecto: solo
   si Lectura de PDF con IA está prendida, y nunca en «Apagar todos».** El tablero añade siempre «Lectura de PDF con IA
   deja de funcionar aunque siga prendida, porque la necesita.» al apagar Integraciones, también
   si la lectura ya está apagada, cuando la frase es falsa. **Defecto:** se muestra solo si el
   interruptor de Lectura de PDF con IA está prendido; en «Apagar todos» no se muestra nunca (la
   lectura se apaga a la vez), como en el tablero. Cambiarlo toca R10 y `addon-off-consequences.ts`.
4. ~~**Singular en el toast de «todos».**~~ **Cerrada el 2026-10-19 con el defecto: «Se prendió 1
   módulo.» / «Se apagó 1 módulo.».** El tablero solo trae el plural («Se prendieron N
   módulos.»). Con un solo añadido por cambiar saldría «Se prendieron 1 módulos.». **Defecto:**
   «Se prendió 1 módulo.» / «Se apagó 1 módulo.». Cambiarlo toca R15 y `addon-labels.ts`.
5. ~~**Carpeta de la ruta del detalle.**~~ **Cerrada el 2026-10-16:** el spec de QC-166 pone el
   detalle en `app/(private)/maestro/empresas/[id]/`, sin layout propio (el `<Toaster />` de R15
   es el de `app/(private)/layout.tsx`), y adopta tal cual el contrato de R1 (`design.md > 3`).

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-16 | ¿Diseño? | Pase `/design` aprobado: `docs/diseno/canvas/MaestroEmpresa*` (pestaña Módulos) y `ModalesMaestro`. |
| 2026-10-16 | ¿Dónde va? | Pestaña Módulos de `/maestro/empresas/[id]` (`?tab=modulos`), montada por **QC-166**. |
| 2026-10-16 | ¿Confirmación? | Apagar uno o «Apagar todos» pide confirmación y nombra lo que se descarta (heredado de **QC-277 D6**). Prender y «Prender todos» son inmediatos. |
| 2026-10-16 | ¿Estados de un añadido? | Prendido, Apagado y «Sin efecto» (prendido sin su dependencia: `enabled` sin `active`). |
| 2026-10-16 | ¿Núcleo? | Fichas con candado, sin interruptor, con los nombres de **QC-277 D2**. |
| 2026-10-16 | ¿Empresa de baja? | Se ve, pero interruptores y botones quedan deshabilitados con aviso (heredado de **QC-277 R27/R31**). |
| 2026-10-16 | ¿Error al guardar? | `ErrorAlert` del catálogo junto a la fila; el interruptor vuelve a su posición. |
| 2026-10-16 | ¿Releer tras guardar? | No: las acciones devuelven la vista nueva (heredado de **QC-277**). |
| 2026-10-16 | ¿Permisos? | `empresas.consultar` para ver y `empresas.modificar` para cambiar (heredado de **QC-277 D9**). |
| 2026-10-16 | ¿E2E? | Sí: prender y apagar un añadido y verlo desaparecer del menú del usuario de esa empresa (flujo de permisos, **QC-277 D11**). |
