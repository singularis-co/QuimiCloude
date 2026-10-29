# QC-182 — modelo-de-planes · revisión

## Vuelta 1 (origin/dev..34ef4e1d6: 6ed1b95ac, ec271bfc2, 34ef4e1d6)

Revisor: reviewer (F2.2). Fecha: 2026-10-28. Spec aprobado con P1 y P2 en su valor por defecto.
El grafo no tiene indexado este worktree; se trabajó con Grep/Read.

### Verificación ejecutada

- `npx tsc --noEmit`: un único error, `app/layout.tsx(45,56) LayoutProps`, que es del entorno
  porque no hay `.next`. El diff no toca ese archivo.
- `npx eslint` sobre los 23 `.ts` del diff: sin salida, así que está limpio.
- `npx vitest run` sobre los 8 unitarios tocados (`permissions`, `seed-initial-access`,
  `qc75-convenciones`, `order-assignments-migration`, `company-addons`, `plans-migration`,
  `plans-permissions-migration`, `maestro-migration`): **8 archivos y 274 tests en verde, 3 skip**.
  Los skip son los de `qc75`, que dependen de `origin/dev`.
- No corrí los `.int`, las guardias, `vitest related` ni `./init.sh`, por la regla del humano: los
  corre `gate-completo` en CI. Los leí:
  - `plans-constraints`, `plans-migration`, `plans-permissions-migration`, el diff de
    `identity-seed` y el de `maestro-migration.int`;
  - `guard-empresa-en-esquema` y `guard-identificador-de-request`;
  - las cabeceras de `guard-permisos-sembrados`, `guard-permisos-no-administrables`,
    `guard-catalogo-de-anadidos` y `guard-rls-force`. Ninguna fija recuentos que el diff rompa.
- `origin/dev` no lleva commits por delante de la rama, y la última migración de `dev` es
  `20261024130000`, así que los timestamps nuevos son posteriores.

### Checklist

**Especificación**
- [x] `requirements.md` con EARS R1–R33.
- [x] `design.md` con alternativas descartadas (§ 8).
- [x] `design.md` abre con `## Lo que ya existe`, con la búsqueda hecha. El diff no re-crea nada
  de esa lista: reutiliza `addons` como destino de la FK y el patrón de permisos de QC-161.
- [~] `tasks.md`: T1.1–T3.1 están en `[x]`. **T3.2 (`./init.sh`) sigue `[ ]`**: está pendiente de
  `gate-completo` en CI por la regla del humano. Ver el hallazgo m1.

**Trazabilidad**
- [x] `progress/impl_QC-182.md` tiene el mapa con los 33 requisitos, y R24 y R25 llevan la marca [P1].
- [x] Cada R<n> tiene al menos un test real, no vacío. Comprobación una por una:
  - R1, R3, R7, R13 y R26 (estático): `plans-migration.test.ts`. Usa predicados sobre el SQL y el
    `schema.prisma` reales, y cada uno tiene su copia mutada que lo pone en rojo.
  - R2 y R4–R25: `plans-constraints.int.test.ts`. Hay un `it` por requisito. Los rechazos afirman el
    SQLSTATE y el nombre de la restricción, no un simple «algo falló». R18 tiene caso testigo y
    R24 cubre el plan inactivo y el renombrado.
  - R26 y R33 (integración): `plans-migration.int.test.ts`. Compara el snapshot del catálogo de PG
    antes del DOWN y después de DOWN+UP. `addons` y `company_addon_overrides` quedan intactos.
  - R27, R28 y R29: `permissions.test.ts`, en un `describe` nuevo con casos simétricos.
    `plans-permissions-migration.test.ts` compara el SQL con `PERMISSIONS`, y
    `seed-initial-access.test.ts` también cubre R28.
  - R30: `company-addons.test.ts`. Comprueba que el permiso está en `CORE_PERMISSIONS`, que ningún
    añadido lo declara y `effectivePermissions` con cada añadido.
  - R31: el estático y `plans-permissions-migration.int.test.ts`. Cubre la base sembrada sin los
    permisos, la doble aplicación y la base que ya los tiene.
  - R32: `identity-seed.int.test.ts`, con dos casos: base sembrada sin `planes.*` y base vacía,
    cada uno con dos corridas.
  - R33: los dos estáticos y los dos de integración, uno por cada migración.

**Calidad de código**
- [x] Typecheck: solo el error de entorno ya conocido.
- [x] Lint limpio sobre el diff.
- [ ] `gate-completo` en CI: pendiente, lo corre GitHub.
- [x] Flujo crítico (permisos): el spec cierra «sin E2E» como decisión. No hay pantalla ni caso de
  uso. Los permisos solo se siembran y el E2E entra con QC-186. `tasks.md` no tiene ninguna tarea
  de E2E.
- [x] Sin dependencias nuevas, porque no se toca `package.json`.

**Seguridad y configuración**
- [x] Sin secretos ni valores de entorno escritos a mano.
- [x] No hay webhooks.

**Proyecto (`docs/checkpoints-proyecto.md` y `perfil-agentes.md > reviewer`)**
- [x] 5. RLS `ENABLE` + `FORCE` en `plans` y `plan_addons`, sin policies.
- [x] 6. No aplica, porque no hay UI.
- [x] 7. No aplica, porque no hay dependencias.
- [x] 8. Los dos modelos nuevos entran en la lista cerrada de exentas: `EXENTAS` (con su motivo)
  y el bullet de `docs/architecture.md` pasan de doce a catorce. No hay consultas de operación.
- [x] 9. Ningún comentario añadido en producción (`lib/`, `db/`) cita `QC-`, `R<n>`, `design.md`
  ni «decisión cerrada». Lo comprobé con grep sobre las líneas `+`.
- [x] 10 y 11. No aplican, porque no hay componentes.
- [x] Los dos modelos llevan `/// @module identity`.
- [x] Migraciones versionadas, cada una con su `down.sql` exacto. El orden respeta las FK RESTRICT.
- [x] Los permisos no entran en ningún caso de uso (no hay ninguno). Son del núcleo y solo del
  Maestro.

### Desvíos declarados por el implementer: juicio

1. **`maestro-migration` (el unitario y el `.int`) filtra `CODIGOS_DEL_MAESTRO` a `empresas.*`.**
   Aceptable. La migración de QC-161 solo reparte `empresas.*`. Sin el filtro, el `.int` R21
   esperaría `planes.*` de una migración que no los da, y el caso de idempotencia insertaría
   asignaciones a permisos que el DOWN de QC-161 no borra del catálogo. Además, design § 6 ya
   preveía tocar otros tests que fijan al Maestro.
2. **Cada migración entra en `MIGRACIONES_ESPERADAS` en su propia tanda.** Aceptable: es solo el
   orden de los commits y el resultado final es el mismo.
3. **R18 (`.int`) borra antes las excepciones por empresa.** Aceptable. La FK RESTRICT de
   `company_addon_overrides` también frena el borrado. Quitarla aísla la FK del plan, el test
   afirma el nombre `plan_addons_addon_key_fkey` y el caso testigo demuestra que el bloqueo viene
   del plan.
4. **`plans-migration.int` filtra `contype <> 'n'`.** Aceptable. PG 18 registra los NOT NULL en
   `pg_constraint`, y la nulabilidad ya la cubre la comparación de `information_schema.columns`.
5. **`planes` entra en `MODULOS` y `MODULOS_CON_ESCRITURA`.** Aceptable y correcto: el módulo
   declara `consultar` + `modificar`, como `empresas`, y R3 del catálogo lo exige.
6. **R32 tiene dos casos.** Aceptable. El requisito tiene dos mitades (base vacía y base ya
   sembrada) y cada caso prueba la segunda corrida.

### Hallazgos

- **m1 · menor.** T3.2 sigue `[ ]` en `tasks.md` (`./init.sh` verde). No es un defecto del código:
  por la regla del humano lo verifica `gate-completo` en CI. Tarea del leader: marcarla cuando CI
  dé verde y no mergear antes.
- **m2 · menor.** El asunto del commit `ec271bfc2` dice «planes.consultar y **planes.gestionar**»,
  pero el código, el spec y la migración usan `planes.modificar`. No hay que reescribir la
  historia. Que el PR use el nombre correcto.
- **m3 · menor.** `requirements.md` sigue con P1 y P2 en «Preguntas abiertas», con el texto «si el
  humano la responde de otra forma…». El cierre con el valor por defecto solo consta en
  `progress/features/QC-182.md`. Conviene anotarlo en el spec o en su tabla de decisiones.
- **m4 · menor.** El nombre del caso `plans-migration.int` «R33: tras el DOWN y el UP, las
  restricciones vuelven a morder» promete más de lo que hace: solo compara nombres de
  restricciones, índices y RLS, y no intenta una escritura inválida. La cobertura real de R33 no
  sufre, porque el otro caso compara el snapshot completo y `plans-constraints` prueba que las
  restricciones muerden. Es solo el título.
- **m5 · menor.** En el JSDoc de `ADMIN_EXCLUDED_PERMISSIONS` (`permissions.ts`), al reflujar el
  párrafo quedó una línea de unos 120 caracteres («…plataforma, no de una empresa. Vive aqui, y no
  en un test, para que quien compare…»). Es cosmético y el lint pasa.

Bloqueantes: 0. Mayores: 0. Menores: 5.

### Veredicto

**OK (APROBADO)**, condicionado a que `gate-completo` salga en verde en CI, que es lo que
cierra T3.2. Antes de eso no se mergea.
