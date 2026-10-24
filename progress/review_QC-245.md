# review QC-245 — contactos-whatsapp-backend

## Vuelta 1 (diff completo `origin/dev...HEAD`, HEAD = a5649cac)

Revisado contra `specs/QC-245-contactos-whatsapp-backend/` (R1–R63, T1–T17, D1–D17, Enmienda 1
aprobada el 2026-10-23), `docs/architecture.md`, `docs/conventions.md`, `docs/perfil-agentes.md`,
`CHECKPOINTS.md` y `docs/checkpoints-proyecto.md`. No usé el MCP del grafo: Grep/Read y el diff
bastaron.

### Verificación ejecutable (la corrió el reviewer)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | 0 errores |
| `pnpm run lint` | 0 errores, 10 avisos, ninguno en archivos del diff |
| `pnpm exec vitest run guard` | 87/87 archivos. **Primera corrida:** 1 rojo en `guard-asignacion-componentizada.test.ts`, una guardia de componentes que no tiene que ver con este diff. Fue por la carga de la máquina: verde al repetir (1324 passed, 22 skipped) |
| Los 27 `.test.ts` unitarios que toca el diff, más `integration-routes.test.ts` | 27/27 archivos, 876 passed, 4 skipped |
| Los 9 `.int.test.ts` que toca el diff, contra la base de test | 9/9 archivos, 105 passed, ninguno saltado |

No corrí `./init.sh` ni la suite completa: el leader lo pidió así, y esa suite la corre `gate-completo` en CI.

### Checklist

**Especificación y tasks**
- [x] Los tres archivos existen: `requirements.md` (EARS, R1–R63), `design.md` (19 alternativas
      descartadas) y `tasks.md`.
- [x] T1–T17 están marcadas `[x]` (17 de 17; no queda ninguna `[ ]`).
- [x] `design.md` abre con `## Lo que ya existe`, que tiene dos tablas (la original y la de la
      Enmienda 1). El diff no re-crea nada de esa lista:
  - el envío de QC-240 se reutiliza: no hay acción nueva de envío, y `module-shape.test.ts` lo
    comprueba;
  - también se reutilizan `isWindowOpen`, `sendFailureReasonOf` (que ahora se exporta),
    `toWhatsappTemplateView`, `decryptStoredSecret`, `orderedPackages`, `remainingPackages`,
    `formatOrderNumber` y `ORDER_STATUSES_NOT_IN_PROGRESS`.

**Trazabilidad**
- [x] `progress/impl_QC-245.md` trae el mapa `R → test`.
- [x] Lo comprobé con un script sobre los tests del diff: R1–R58 y R60–R63 tienen al menos un caso
      que nombra su `R<n>`. R59 es un requisito de verificación; lo cubren los archivos que cita el
      mapa (ver hallazgo m2).
- [x] Revisé que los casos clave no estén vacíos:
  - redirección no seguida y host ajeno sin token (`whatsapp-graph-client-media.test.ts`);
  - las 14 ramas de 404 de R44 sin llamar a Meta (`get-whatsapp-media.test.ts`);
  - las cabeceras y el 404/502 de la ruta (`whatsapp-media-route.test.ts`);
  - la ruta real de punta a punta (`whatsapp-chat-context-flow.int.test.ts`).

**Calidad de código**
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en CI: está pendiente; lo corre el PR.
- [~] Flujo crítico «permisos» sin E2E: R43, aprobado por el humano, lo difiere a QC-246. La deuda
      está anotada en `progress/features/QC-245.md > Cierre` (m6).
- [x] No hay dependencias nuevas: `package.json` no cambia.

**Seguridad y configuración**
- [x] No hay secretos ni URLs de entorno hardcodeadas. `.fbsbx.com` es el dominio de Meta, no
      configuración: es una lista de hosts permitidos.
- [x] No hay webhooks nuevos.

**Datos y seguridad (proyecto)**
- [x] No hay tabla nueva. La única columna nueva es `whatsapp_contacts.last_read_at`, y su tabla
      ya tenía empresa y RLS.
- [x] Todas las consultas nuevas filtran por `company_id` del actor:
  - las 8 de `whatsapp-conversation-prisma.ts`;
  - `customer-order-directory-prisma.ts` (`orderCompanyScope`);
  - `findAliveCustomerIdsMatchingName` (`customerCompanyScope`);
  - `company-name-prisma.ts`, que lee por el `companyId` de la sesión.

  Hay tests de acceso cruzado: R39, R44/R39 en el adaptador, R54 y la ruta a otra empresa en el
  flujo.
- [x] Los permisos se validan en `domain/`: `requireReadPermission` es lo primero en los seis casos
      de uso.
- [x] Las dos migraciones tienen `down.sql`. Hay tests de ida, vuelta e ida (R2, R42).

**Módulos hexagonales**
- [x] `domain/` y `ports/` no importan framework, Prisma ni `lib/shared`. La base de la ruta de
      medios llega inyectada como `mediaUrlOf`.
- [x] `integraciones` no lee `customers`, `orders`, `companies` ni `users`:
  - `clientes` se usa por `CustomerCatalog.findAliveIdsMatchingName` y `findAliveRefById`;
  - `pedidos`, por `CustomerOrderDirectory` y `OrderCatalog.listDeliveryProgressByIdsIncludingDeleted`;
  - `identity`, por `createGetCompanyName`, cuyo adaptador vive en `identity`, dueño de `Company`;
  - todo entra por el contrato de cada módulo, sin imports profundos fuera de `lib/composition`.
- [x] Ningún driving instancia un driven: la ruta y las acciones piden todo a `@/lib/composition`.
- [x] `lib/shared/routes.ts` sigue siendo hoja: solo gana una constante y una función pura.
- [x] Ningún `'use server'` se reexporta desde el barrel.

**Reglas propias del reviewer (5–11)**
- [x] 5 Calidad y seguridad: ver la sección de la ruta de medios, más abajo.
- [x] 6 Multiplataforma: no aplica (no hay UI).
- [x] 7 Dependencias: no aplica.
- [x] 8 Aislamiento por empresa: no hay modelo nuevo, las consultas filtran y hay test cruzado.
- [x] 9 Comentarios: ninguna línea añadida en `lib/`, `app/` o `db/` cita `QC-<n>`, `R<n>`,
      `design.md` ni «decisión cerrada» (lo comprobé con grep sobre el diff `-U0`).
- [x] 10 y 11 (duplicados y diseño): no aplican (no hay componentes).

### Puntos de foco

**Ruta del medio `GET /api/integraciones/whatsapp/media/<messageId>`.** Cumple todo lo pedido:
- **Sesión, permiso y empresa.** La ruta lee la sesión ella misma (`runInRequestScope` +
  `getSessionUser` + `getSessionContext`); sin usuario o sin empresa pasa `actor = null`. El caso de
  uso empieza con `requireReadPermission`, que exige `whatsapp.consultar` y `companyId` no vacío.
  Con el añadido apagado, la sesión ya no trae el permiso. El ámbito sale de `scopeOf(actor)`.
- **Solo mensajes de la empresa.** `findMediaMessage` busca por `m.company_id` + `m.id` +
  `m.connection_id` de la conexión viva. Después exige: dirección `IN`, tipo `IMAGE`/`STICKER`, un
  `media_id`, un `customer_id` y que el cliente siga vivo (`findAliveRefById(…, scope.companyId)`).
  Ninguna de esas comprobaciones llama a Meta.
- **Redirecciones.** El paso 2 usa `redirect: 'manual'`, y un 3xx es `rejected`. La URL tiene que
  ser `https:` con un host que termine en `.fbsbx.com`; si no, no se manda el token. Hay tests de un
  sufijo imitado y de un host que solo contiene el dominio.
- **Fugas.** El token va solo en `Authorization`. Ni la URL de Meta ni el `media_id` salen del
  adaptador o del caso de uso. Las respuestas 404/502/500 no llevan cuerpo. El log solo se escribe en
  el 500: con `code` si es un error de dominio, o con `name: message` recortado a 300 caracteres. No
  incluye el id del mensaje y hay test de eso (ver m5).
- **Códigos de respuesta.** `unauthorized`, `invalid_input` y `whatsapp_message_not_found` dan 404.
  `unavailable` (token ilegible, fallo de Graph, tamaño o tipo) da 502. Lo inesperado da 500.
- **Cabeceras del 200.** `private, max-age=3600`, `nosniff` e `inline`; `Content-Length` solo si se
  conoce.

**Contrato (`design.md > ## Contrato para la pantalla (QC-246)`).** El código coincide con el
contrato:
- las cinco acciones, con su nombre y su ruta exacta en `CONV`;
- las firmas de entrada;
- los tipos `ActionResult<…>` de salida;
- los tipos del §B: `WhatsappChatAttachment` con `mediaUrl` y `messageId`, y
  `WhatsappCustomerOrder.status` sin `ENTREGADO` ni `CANCELADO` (con `Exclude` sobre
  `ORDER_STATUSES_NOT_IN_PROGRESS`);
- los códigos de error del §C, con `order_not_found` vía `WhatsappOrderNotFoundError`;
- la tabla de respuestas de la ruta.

Los tipos de la vista se exportan desde `@/lib/modules/integraciones`. QC-246 todavía no importa
`whatsapp-conversation-actions` (lo miré en su worktree, solo lectura); el contrato publicado sigue
siendo válido.

**`ChatTarget` (nota abierta del implementer).** El contrato no exige exportarlo:
- en el §A es un alias en línea dentro del bloque de firmas, igual que `ActionResult`;
- QC-240 tampoco exporta el tipo de `recipient`;
- el front puede derivarlo con `Parameters<typeof getWhatsappChatAction>[0]['target']`.

No es hallazgo. Si QC-246 lo pide, exportarlo es una línea en el barrel o en `CONV`.

**D15.** `CUSTOMER_ORDER_STAGE` (`domain/whatsapp-chat-context.ts`) es la única definición. Es un
`Record<OrderStatus, …>`, así que es total. `orderValuesOf` lo lee, y grep en `lib/` y `app/` no
encuentra otras etiquetas «recibido» o «en preparación». `isOpenCustomerOrder` compara estados para
filtrar, no para elegir un texto. Lo cubre el test de R60, que recorre el mapa.

**Fronteras de módulo.** Cumplen (ver el checklist).

**Desviaciones del implementer**
- **Base de la ruta en `lib/shared/routes.ts`: correcta.** `integration-routes.test.ts` solo admite
  literales `/integraciones/whatsapp` en ese archivo, y el dominio no puede importar `lib/shared`.
  La solución copia la de `WHATSAPP_WEBHOOK_ROUTE_BASE`:
  - la composición inyecta `whatsappMediaPath` como `mediaUrlOf`;
  - la URL que recibe la pantalla no cambia;
  - quedó anotada en `design.md > 15.1` como ajuste sin cambio de contrato.
- **T13 y T14 en un commit (`a7a9bad4`): se acepta.** `docs/conventions.md` pide un commit por
  tarea lógica. Las dos tareas comparten el puerto (`reactedMessageId`, `findMediaMessage`) y sus
  dobles, así que separarlas dejaba un commit intermedio sin compilar. Queda como `menor` (m1).
- **Dos tests tensados fuera de la lista del spec: correctos.** En los dos casos se tensa, no se
  relaja:
  - `encryption-keys-env.test.ts` amplía una lista cerrada de miembros de `integraciones`; sin
    eso, el test se pone rojo;
  - `order-customer-contract.test-d.ts` añade `findAliveIdsMatchingName` a las claves exactas del
    contrato y fija su firma de tipos.

  Pasa lo mismo con `qc75-convenciones.test.ts` y `guard-identificador-de-request.test.ts`: suman
  el permiso y las dos migraciones a sus listas cerradas.

**Comentarios.** No hay citas prohibidas en producción. Hay un comentario repetido (m4).

### Hallazgos

Ningún BLOQUEANTE.

- **m1 · menor.** T13 y T14 comparten el commit `a7a9bad4` (`docs/conventions.md`: un commit por
  tarea lógica). Está justificado porque comparten el puerto y sus dobles; no hay que rehacer nada.
- **m2 · menor.** Ningún caso de test nombra `R59`. Es un requisito de verificación («verificar con
  tests…») y lo cubren los archivos que lista el mapa, igual que R43, que sí lleva su nombre en
  varios casos. Si se quiere uniformidad, basta con poner `R59` en el `describe` de
  `whatsapp-chat-context-flow.int.test.ts`.
- **m3 · menor (informativo).** El paso 1 de `downloadMedia` usa `callGraph`, que sigue las
  redirecciones (`redirect` por defecto). El diseño solo exige `manual` en el paso 2, y el host es
  `graph.facebook.com`, así que no es un incumplimiento. La implementación de `fetch` de Node quita
  `Authorization` en una redirección a otro origen, pero el código no lo garantiza por sí mismo.
  Vale una línea de seguimiento si se endurece `callGraph`.
- **m4 · menor.** El motivo de que `runtime` viva en `route.ts` está escrito dos veces: en
  `app/api/integraciones/whatsapp/media/[mensajeId]/route.ts` y en el JSDoc de
  `whatsapp-media-route.ts`. Basta con uno.
- **m5 · menor.** En un 500 por error ajeno, la ruta registra `error.message` recortado a 300
  caracteres, mientras que el diseño (§15.1) dice «solo el `diagnostic`». Hay test de que no se
  registra el id del mensaje. Es el mismo patrón que el webhook (`errorMessageOf`). El riesgo es
  bajo, porque la entrada ya se validó como uuid y Graph devuelve resultados en vez de lanzar.
- **m6 · menor.** «Permisos» es un flujo crítico y `whatsapp.consultar` no tiene E2E. Lo difiere
  R43, aprobado por el humano, a QC-246, y la deuda está en `progress/features/QC-245.md > Cierre`.
  Hay que comprobar que QC-246 lo traiga.

### Veredicto

**OK.** No hay bloqueantes. Los seis hallazgos son menores y no piden cambios para mergear. Queda
pendiente que `gate-completo` salga verde en el PR.
