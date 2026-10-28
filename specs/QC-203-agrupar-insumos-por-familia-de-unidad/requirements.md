# QC-203 — agrupar-insumos-por-familia-de-unidad · requirements.md

> **Zona** `fullstack` · **Complejidad** `high` · **depends_on** — ·
> **Rama** `feature/QC-203-agrupar-insumos-por-familia-de-unidad`
>
> ## Alcance
>
> Un insumo (`PRODUCT`) pasa a identificarse por **nombre + familia de unidad**, no por nombre +
> unidad. Si el alta manual llega en otra unidad de la misma familia que un homónimo vivo, no nace
> otro producto: la cantidad y el costo unitario se **convierten a la unidad del existente** y se le
> agrega un lote, con **aviso antes de guardar** («Ya existe Glicerina en l: 500 ml se guardarán
> como 0,5 l»). La **importación desde Excel** (QC-209) aplica la misma regla. La **importación de
> fórmula en PDF** (QC-159) deja de crear materias primas sin unidad: la unidad se sugiere desde lo
> leído en el PDF y, si no hay sugerencia, el revisor la elige. El producto conserva una sola
> unidad; recetas, pedidos y costeo no cambian.
>
> ## Lo que NO entra
>
> - **Fusionar homónimos que ya existen partidos** y dar unidad a materias primas ya creadas sin
>   unidad: se quedan como están; la regla solo aplica a lo nuevo. Decisión del humano, sin ficha.
> - **Unicidad en base** (dos altas a la vez, renombrar) → **QC-205**; su índice debe ser por
>   nombre + familia (comentado en el issue).
> - **Cruzar familias** (kg↔l necesita densidad). Fuera de alcance.
>
> _Sembrado por `/afinar-feature` el 2026-10-14. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`._

## Requisitos (EARS)

> **Cómo se citan las decisiones.** `[Dn]` es la fila n de `## Decisiones cerradas (no reabrir)`,
> contada de arriba abajo: D1 evitar en el alta · D2 misma familia · D3 cómo se convierte ·
> D4 homónimos ya partidos · D5 varios homónimos · D6 cantidad que no cabe · D7 costo que no cabe ·
> D8 aviso · D9 Excel · D10 materia prima de fórmula · D11 QC-205 · D12 permiso · D13 precisión y
> borrado · D14 E2E.
>
> **«Familia» de una unidad**: la unidad de la que deriva, o ella misma si no deriva de ninguna
> (`[D2]`). **Homónimo de un alta de insumo**: producto vivo de la empresa del actor, con el mismo
> nombre normalizado y con unidad de la misma familia que la del alta.
>
> **Enmiendas que hace esta ficha** (detalle en `design.md > 9`): **QC-159 R25** (la materia prima
> nueva nace con unidad) y **QC-159 R26** (el homónimo se busca por nombre + familia);
> **QC-199 R10** y **QC-121 R5 y R6** en lo que toca al insumo (el homónimo del alta se busca por
> familia, no por unidad; entre varios gana el de más existencia, y un homónimo en otra unidad de la
> familia recibe el lote convertido, con aviso); **QC-209 R14 y R15** en lo que toca a los insumos
> (identidad por nombre + familia).

### Alta manual de insumo

- **R1** `[D1]` `[D2]` `[D13]` CUANDO se da de alta un insumo, el sistema DEBE contar como homónimo
  todo producto vivo de la empresa del actor cuyo nombre normalizado coincida con el del alta y
  cuya unidad sea de la misma familia que la del alta. NO DEBEN contar los productos dados de baja,
  los de otra empresa, los que no tienen unidad ni los de otra familia: con solo esos, el alta crea
  un producto nuevo.
- **R2** `[D2]` SI la unidad del alta no deriva de ninguna y ninguna unidad visible deriva de ella
  (por ejemplo «u» o una unidad de empresa sin base), ENTONCES el sistema DEBE tratarla como una
  familia de una sola unidad: solo un homónimo en esa misma unidad cuenta.
- **R3** `[D1]` SI el alta no tiene ningún homónimo, ENTONCES el sistema DEBE crear el producto con
  la unidad del alta y su primer lote, como hoy.
- **R4** `[D1]` `[D3]` SI el alta tiene al menos un homónimo, ENTONCES el sistema NO DEBE crear otro
  producto: DEBE agregar el lote al homónimo destino (R5) con la existencia convertida exactamente
  de la unidad del alta a la del destino. Si las dos unidades son la misma, el lote entra sin
  conversión.
- **R5** `[D5]` `[D11]` SI el alta tiene más de un homónimo, ENTONCES el destino DEBE ser el de
  mayor existencia, comparando las existencias convertidas a una misma unidad y sin redondear; en
  empate, el más antiguo por fecha de alta, y con la misma fecha, el de menor identificador.
- **R6** `[D3]` `[D7]` CUANDO el lote se convierte y el alta trae costo unitario, el sistema DEBE
  guardar en el lote el costo unitario convertido exactamente a la unidad del destino (0,004 por ml
  se guarda como 4 por l).
- **R7** `[D7]` CUANDO el lote se convierte y el alta trae solo el costo total, el sistema DEBE
  derivar el costo unitario dividiendo el total entre la existencia **ya convertida**, con la regla
  de derivación vigente. SI el unitario derivado queda en 0, ENTONCES DEBE rechazar el alta igual
  que hoy.
  Nota (2026-10-23): desde el formulario ya no ocurre; el costo total es de solo lectura (dev 17978345). El dominio lo sigue cubriendo.
- **R8** `[D6]` `[D13]` SI la existencia convertida no cabe en el formato de cantidad del ERP
  (más de 4 decimales o más de 10 cifras enteras), ENTONCES el sistema DEBE rechazar el alta sin
  escribir nada, con un error propio que señale la existencia y pida ingresarla en la unidad del
  producto destino. NO DEBE redondear.
- **R9** `[D7]` `[D13]` SI el costo unitario convertido no cabe en el formato de importe del ERP
  (más de 4 decimales o más de 10 cifras enteras), ENTONCES el sistema DEBE rechazar el alta sin
  escribir nada, con un error propio que señale el costo unitario. NO DEBE redondear.
- **R10** `[D1]` SI el homónimo destino es un producto terminado, ENTONCES el sistema DEBE rechazar
  el alta con `action_not_allowed` sin escribir nada, como hoy.
- **R11** `[D12]` El alta y la consulta de homónimos que alimenta el aviso (R13) DEBEN exigir el
  permiso `inventario.modificar`, comprobado en el caso de uso antes de cualquier consulta. SI el
  actor no lo tiene, ENTONCES el sistema DEBE responder `unauthorized` sin consultar ni escribir.
- **R12** `[D13]` La consulta de homónimos que alimenta el aviso DEBE devolver solo productos vivos
  de la empresa del actor: un homónimo de otra empresa o dado de baja NO DEBE aparecer.

### Aviso en el formulario «Nuevo producto»

- **R13** `[D8]` MIENTRAS el formulario de alta de tipo insumo tenga nombre, unidad y existencia, y
  el destino de R5 tenga otra unidad, el sistema DEBE mostrar, antes de guardar, un aviso
  informativo con el producto destino y su unidad, la existencia escrita y la convertida y, si se
  escribió costo unitario, el costo escrito y el convertido; y una ayuda bajo «Unidad» que diga
  que se convierte al guardar. El aviso DEBE recalcularse al cambiar el nombre, la unidad o la
  existencia.
- **R14** `[D8]` `[D5]` SI el alta tiene más de un homónimo, ENTONCES el aviso DEBE nombrar cada
  homónimo con su unidad y su existencia, y decir a cuál va el lote (el de R5), también cuando el
  destino tiene la misma unidad que el alta.
- **R15** `[D8]` SI el alta no tiene homónimo, o tiene uno solo y en la misma unidad, ENTONCES el
  formulario NO DEBE mostrar aviso ni ayuda de conversión: queda como hoy.
- **R16** `[D6]` `[D7]` `[D8]` CUANDO se pulsa «Guardar» y la existencia o el costo unitario
  convertidos no caben (R8, R9), el formulario DEBE mostrar el error bajo «Existencia» o bajo
  «Costo unitario», marcar ese campo como inválido, no cerrar el panel y conservar lo escrito. SI el
  rechazo llega del servidor, ENTONCES DEBE pintarse en ese mismo campo.
- **R17** `[D8]` CUANDO un alta se guarda convirtiendo el lote, el aviso de éxito DEBE nombrar la
  existencia convertida, su unidad y el producto destino («Se agregó un lote de 0,5 l a
  Glicerina · l.»), con los datos que devolvió el servidor.

### Importación desde Excel

- **R18** `[D9]` `[D2]` `[D5]` La importación de inventario DEBE identificar el insumo de cada fila
  con las reglas de R1, R2 y R5: SI tiene un homónimo en la base, ENTONCES la fila DEBE quedar en
  `sumar lote` sobre el destino de R5; SI NO, y una fila anterior del mismo archivo crea un insumo
  con el mismo nombre y la misma familia, ENTONCES DEBE quedar en `sumar lote` sobre esa fila; SI
  NO, en `crear`.
- **R19** `[D9]` `[D3]` `[D7]` CUANDO una fila de insumo suma lote a un producto de otra unidad de
  la familia, la confirmación DEBE escribir la existencia y el costo convertidos con las reglas de
  R4, R6 y R7.
- **R20** `[D9]` `[D6]` `[D7]` SI la existencia o el costo convertidos de una fila no caben (R8, R9),
  o el costo unitario derivado sobre la existencia convertida queda en 0 (R7), ENTONCES la vista
  previa y la confirmación DEBEN dejar la fila en `error`, con el motivo en la columna
  «Existencia», «Costo unitario» o «Costo total», y la confirmación NO DEBE escribirla.
  Enmendado (2026-10-23): la importación ya no trae «Costo total» (dev 325aa378); se retira el caso de costo total derivado en 0.

### Materia prima nueva desde la revisión de fórmula

- **R21** `[D10]` CUANDO una fila de la revisión de fórmula está en modo «Crear materia prima», el
  sistema DEBE mostrar un campo «Unidad» obligatorio con las unidades visibles para la empresa
  (de sistema y propias), preseleccionado con la única unidad cuyo nombre o símbolo normalizado
  coincide con la unidad leída del PDF, y una ayuda que diga que se sugirió desde el PDF.
- **R22** `[D10]` SI la unidad leída no coincide con ninguna unidad visible, coincide con más de
  una o el PDF no trae unidad, ENTONCES el campo DEBE quedar vacío con una ayuda que lo explique y
  pida elegir una. CUANDO el revisor elige una unidad a mano, la ayuda DEBE decirlo.
- **R23** `[D10]` SI se pulsa «Confirmar» con alguna fila «Crear materia prima» sin unidad,
  ENTONCES el sistema NO DEBE confirmar y DEBE mostrar el error en cada fila sin unidad.
- **R24** `[D10]` SI llega al servidor una confirmación con una materia prima nueva sin unidad, o
  con una unidad que no existe o no es visible para la empresa, ENTONCES el sistema DEBE rechazarla
  con `invalid_input` sin crear ninguna materia prima ni escribir la receta.
- **R25** `[D10]` CUANDO se confirma una fila que crea una materia prima, el producto DEBE nacer con
  la unidad elegida; el resto de QC-159 R25 no cambia (tipo «Producto», sin lotes, existencia 0).
- **R26** `[D10]` `[D2]` La confirmación DEBE buscar el homónimo de cada materia prima nueva por
  nombre normalizado y familia de la unidad elegida, entre los productos vivos no terminados de la
  empresa: SI hay exactamente uno, ENTONCES DEBE reutilizarlo; SI hay más de uno, ENTONCES DEBE
  rechazar con `invalid_input` sin escribir nada; SI no hay ninguno, ENTONCES DEBE crearla, aunque
  existan homónimos sin unidad o de otra familia.
- **R27** `[D10]` CUANDO la confirmación termina, el resumen DEBE listar cada materia prima creada
  con su unidad y cada materia prima reutilizada por su nombre.
- **R28** `[D12]` Crear una materia prima con unidad DEBE seguir exigiendo `inventario.modificar`
  antes de crear nada, como hoy (QC-159 R27 y R30).

### Lo que no cambia

- **R29** `[D4]` `[D11]` El sistema NO DEBE modificar ningún producto existente fuera de agregar el
  lote al destino: los homónimos ya partidos conservan su unidad, su existencia y sus lotes, y las
  materias primas sin unidad siguen sin ella. CUANDO el alta tiene varios homónimos (partidos o
  creados en carrera, sin unicidad en base), el sistema DEBE seguir funcionando según R5.

### E2E

- **R30** `[D14]` CUANDO, con «Glicerina» en l en el inventario, se da de alta «Glicerina» con
  500 ml, el formulario DEBE mostrar el aviso de conversión antes de guardar y, tras guardar, el
  listado DEBE mostrar la existencia de «Glicerina» 0,5 l mayor que antes y ningún producto
  «Glicerina» nuevo en ml.

## Preguntas abiertas

Ninguna.

Los textos que los tableros dejan «Por confirmar» (aviso, ayudas y errores) se toman tal cual de
los tableros aprobados y quedan fijados en `design.md > 6`; la aprobación del spec los cierra.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-05 | ¿Agrupar al leer o evitar que se partan en el alta? | Evitar en el alta. Agrupar al leer queda descartado (descripción del issue). |
| 2026-10-14 | ¿Qué es «misma familia»? | Misma base efectiva `baseUnitId ?? id` (heredado de QC-195). «u» y las unidades de empresa sin base son cada una su propia familia (QC-76). Se reutiliza la lógica existente, no se duplica. |
| 2026-10-14 | ¿Cómo se convierte? | `convertQuantity` del módulo `unidades`, exacta (heredado de QC-76). Entre familias distintas no se convierte ni se agrupa. |
| 2026-10-14 | Homónimos ya partidos en datos | Se quedan como están. Sin migración ni listado. Solo aplica a altas nuevas. |
| 2026-10-14 | Varios homónimos de la familia ya partidos: ¿a cuál va el alta? | Al de **más existencia**, comparada en una misma unidad; en empate, al más antiguo. |
| 2026-10-14 | La cantidad convertida no cabe en 4 decimales (0,25 ml → 0,00025 l) | **Se rechaza el alta con mensaje** que pide ingresarla en la unidad del producto. No se redondea. |
| 2026-10-14 | El costo unitario convertido no cabe en 4 decimales | Se rechaza igual que la cantidad. Si el alta trae costo total, el unitario se deriva sobre la cantidad ya convertida con la regla vigente (`deriveUnitCost`, QC-52). |
| 2026-10-14 | ¿El formulario avisa de la conversión? | Sí, **antes de guardar**, con cantidad origen y convertida. |
| 2026-10-14 | ¿Cubre la importación desde Excel (QC-209)? | Sí: agrupa por familia y convierte con estas mismas reglas. |
| 2026-10-14 | ¿Cubre la materia prima creada desde fórmula (QC-159)? | Sí. La materia prima nueva **nace con unidad**: se sugiere desde la unidad leída del PDF contra el catálogo (misma lógica que `suggestUnitId` de la importación de catálogo). Sin sugerencia, el revisor **debe elegirla**; sin unidad no se confirma. Con unidad, la búsqueda de homónimo (QC-159 R26) pasa a ser por nombre + familia. |
| 2026-10-14 | QC-205 (unicidad nombre + unidad) | Sigue aparte. Comentado en el issue que su índice debe ser por nombre + familia. |
| 2026-10-14 | Permiso | `inventario.modificar`, validado en el service (heredado de QC-121, QC-199, QC-49). Sin permisos nuevos. |
| 2026-10-14 | Precisión y borrado | `Decimal(14,4)`, nunca float (QC-14). Borrado lógico (QC-14, QC-121): solo cuenta el homónimo vivo. |
| 2026-10-14 | ¿E2E? | Sí, uno: alta «Glicerina 500 ml» sobre «Glicerina» en l → aviso, guarda, la existencia sube 0,5 l en el listado. |
