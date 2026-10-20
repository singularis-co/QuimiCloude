# impl QC-280 — boton-pdf-sin-proveedor-ia (frontend_dev)

Feature sin SDD: no hay `R<n>` propios; el alcance son las Decisiones de `progress/features/QC-280.md`.

## Archivos
- Creado: `components/shared/ai-provider-required-tooltip.tsx` (`AiProviderRequiredTooltip`, `AI_PROVIDER_REQUIRED_TOOLTIP_LABELS`, `..._TESTID`, `..._TRIGGER_TESTID`, `..._LINK_TESTID`).
- Creado: `tests/unit/shared/ai-provider-required-tooltip.test.tsx`.
- Modificado: `components/shared/document-upload/document-upload-dialog.tsx` (prop `disabled`).
- Modificado: `app/(private)/produccion/formulas/components/formula-pdf-upload.tsx`, `app/(private)/proveedores/[id]/components/catalog-pdf-upload.tsx` (propagan `disabled`).
- Modificado: `app/(private)/produccion/formulas/page.tsx`, `app/(private)/proveedores/[id]/page.tsx`.
- Modificado: `components/shared/CATALOGO.md` (fila nueva en lugar de la del aviso; punto de extensión `disabled` en `DocumentUploadDialog`).
- Modificado: `tests/unit/documentos-ui/formulas-upload.test.tsx`, `tests/unit/documentos-ui/supplier-detail-upload.test.tsx`, `e2e/integraciones-proveedor-ia.spec.ts`.
- Borrado: `components/shared/ai-provider-required-notice.tsx`, `tests/unit/shared/ai-provider-required-notice.test.tsx` (nada más los importaba).

## Decisiones técnicas
- Trigger = `span tabIndex={0}` vía `render` de `TooltipTrigger`: el `<button disabled>` no recibe puntero ni foco. Foco visible con el contorno del sistema (`outline-ring`), no `ring-ring/<n>` (lo prohíbe `guard-anillo-de-foco`).
- Popup clicable: Base UI 1.7 `Tooltip.Root` tiene `disableHoverablePopup` (por defecto `false`) → el globo ya es «hoverable» (safePolygon). Se deja el `delay` del `TooltipProvider` del layout privado (0); fuera de él Base UI no exige Provider (los tests de página lo montan sin él y funcionan).
- `aria-describedby` del envoltorio apunta al texto del globo (no al enlace): descripción accesible = el mensaje.
- `TooltipContent` con `className="flex-col items-start gap-1"`; enlace `text-background underline`.
- `DocumentUploadDialog`: `disabled` va a `DialogTrigger` (Base UI pone `disabled` al botón y no abre).
- Proveedor: el `div flex justify-end` envuelve ambos casos; `readiness === null` sigue sin pintar nada. `canConfigure` ya no se usa en las páginas.

## Pendiente / avisos al leader
- **Diseño:** la fila del catálogo cita `docs/diseno/canvas/ProveedorIA.dc.html` (tablero del bloqueo de QC-275, que pinta el recuadro viejo, no un tooltip). No hay tablero propio del globo; la regla «pase de diseño» de `docs/perfil-agentes.md` pediría uno. Decide si basta con la decisión del humano o se abre el pase.
- **E2E** `e2e/integraciones-proveedor-ia.spec.ts` adaptado (botón deshabilitado + hover/foco del envoltorio + enlace «Inscribir proveedor»; el usuario sin `integraciones.modificar` ve el enlace y sigue el 404). **No ejecutado**: necesita BD y servidor.
- Apertura al tocar en iOS/Android no comprobada (ya constaba así en la fila de `Tooltip`).
- El worktree no tenía `node_modules`: se corrió `pnpm install --frozen-lockfile`, `prisma generate` y `next typegen` (sin cambios de lockfile ni dependencias).

## Mapa caso → test
- Globo: texto, enlace con href, abre al hover y al foco → `tests/unit/shared/ai-provider-required-tooltip.test.tsx`.
- Fórmulas: conectado = botón habilitado sin globo; sin conexión = botón deshabilitado en la fila de «Nueva fórmula», sin recuadro, no abre; hover = enlace a Proveedor IA aunque falte `integraciones.modificar`; sin `documentos.modificar` nada → `tests/unit/documentos-ui/formulas-upload.test.tsx`.
- Proveedor: mismos casos, posición entre cabecera y catálogo dentro del `flex justify-end` → `tests/unit/documentos-ui/supplier-detail-upload.test.tsx`.

## Salida de comandos
- `pnpm run typecheck` → `tsc --noEmit` sin errores.
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)` (preexistentes, en archivos no tocados).
- `pnpm exec vitest related --run <archivos tocados>` → `Test Files 54 passed (54) · Tests 853 passed | 1 skipped (854)`.
- `pnpm exec vitest run guard` → `Test Files 76 passed (76) · Tests 1064 passed | 20 skipped`.

## Veredicto
Hecho: «Subir PDFs» deshabilitado con globo y enlace «Inscribir proveedor» en Fórmulas y detalle de proveedor; verde en typecheck, lint, related y guardias; E2E adaptado sin ejecutar.
