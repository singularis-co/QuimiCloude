# Módulos por empresa — mapa previo a la ficha (2026-10-13)

> Borrador del leader para evaluar con el humano antes de abrir la ficha. Fuente: barrido de `dev`.
> Pasa a la ficha nueva (y a `/afinar-feature`) cuando se cierre la clasificación.

## Decisiones del humano (2026-10-13)
- Módulos ENTEROS, no permisos sueltos.
- El flujo básico NUNCA se apaga: solo se apagan añadiduras.
- Nada suelto: todo punto cruzado de un módulo apagado se oculta o degrada bien (ej.: leer PDF con IA).
- Producción arranca vacía: solo el Maestro; empresas una a una, módulos a mano o todos.
- (2026-10-13) Núcleo confirmado: lo propuesto + herramientas y máquinas (MACHINE). Añadidos: la propuesta, dashboard incluido.
- (2026-10-13) Lectura de PDF con IA DEPENDE de Integraciones > Proveedor IA: QC-275 (Christian, En curso) pasa la key a cada empresa y bloquea la lectura sin proveedor.
- (2026-10-13) Todos los huecos se cierran (puntos cruzados con permiso de otro módulo, logo/aterrizaje fijos, webhook y crons fuera de sesión) y se enmienda docs/architecture.md:43 (y :557).
- Prioridad: prender/apagar módulos con plantillas (suscripciones). Pagos automáticos después.

## Hechos del código
- Sin flag por empresa: `Company` solo tiene nombre y baja (`db/schema.prisma:151-163`).
- `docs/architecture.md:43` prohíbe «permisos por empresa más allá de su rol»: hay que enmendarlo.
- Permisos recalculados por petición (`session-user-prisma.ts:85,112`, `resolve-session.ts:155-165`):
  punto natural para cruzar con «módulos activos». `docs/architecture.md:557` dice «foto del login»: revisar.
- Menú (`private-nav.ts:501-522`), guarda de página (`require-page-permission.ts:48-55`) y casos de uso
  (`requirePermission`) ya se apagan solos si se quitan los permisos del módulo.
- Huecos: puntos cruzados que cuelgan del permiso de OTRO módulo (importar catálogo exige
  `proveedores.modificar`, fórmula `recetas.modificar`: `documentos/domain/actor.ts:45,52`);
  logo y aterrizaje fijos a `/asignacion` (`app-sidebar.tsx:119`, `route-guard-middleware.ts:123`);
  webhook de documentos y crons fuera de sesión.
- Pedido lineal y rígido (`order-transitions.ts:39-50`): empaque consume envases y da entrada al
  terminado (`order-packing.ts:171-259`); entrega exige cliente (`deliver-order.ts:188`).
- La IA de PDFs NO depende de integraciones: vive en `documentos`, clave por variable de entorno
  global (`lib/composition/index.ts:1960-1962`). Integraciones hoy son placeholders.

## Propuesta de clasificación (por evaluar)
Núcleo: identity (usuarios, grupos, correo de alta), unidades, presentaciones, inventario (lotes,
reservas, terminado), recetas, pedidos, asignaciones (asignar+ejecutar), terminados, entregas,
empaque, acondicionamiento, clientes (mientras la entrega exija cliente).
Añadidos: dashboard/recorrido; proveedores; documentos/IA (botones en fórmulas y proveedores, rutas
de importación, webhook); importación desde Excel; integraciones (IA, inventarios, WhatsApp →
Contactos, notificaciones); evidencia por paso (QC-214);
notificaciones (QC-137); proveedores de lo que falta (QC-139).

## Puntos cruzados conocidos
| Añadido | Aparece en | Al apagar |
|---|---|---|
| documentos/IA | `formulas/page.tsx:28,46`, `proveedores/[id]/page.tsx:99,129`, rutas `importar/[documentoId]`, webhook `api/documentos/trabajos` | ocultar botones, 404 rutas, rechazar trabajos |
| dashboard | «Ver recorrido» en `asignacion/page.tsx:60-62` | ocultar |
| proveedores | menú y rutas; botón QC-139 futuro en pedidos | ocultar |
| importar Excel | botón en `inventario/page.tsx:87,99-101`, ruta `/inventario/importar` | ocultar, 404 |
| WhatsApp | QC-239/244/247/248 (futuro) | ocultar Contactos y envíos |

## Dudas para el humano
1–4 cerradas el 2026-10-13 (empaque, acondicionamiento, clientes y herramientas son núcleo; IA depende de QC-275; dashboard es añadido).
5. Cron de caducidad de pedidos: propuesta núcleo (protege las reservas).
6. Planes (QC-182/188): ¿plan = conjunto de módulos? ¿El Maestro puede además prender/apagar sueltos?
7. Trabajo en curso de un añadido al apagarlo (trabajos de PDF encolados, envíos de WhatsApp en cola).
