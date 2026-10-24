# impl QC-246 — contactos-con-chat

## Tanda 1 (2026-10-23) — T1, T2, T21

Las tres no dependen de QC-245. Sin delegación: los cambios venían de un intento anterior sin
commitear; el implementer los revisó contra el «Hecho» de cada task y contra `design.md > 6.1` y no
hizo falta corregir nada.

### Archivos
- Nuevo `components/shared/wa-bubble.tsx` (T1): copia byte a byte del original.
- `app/(private)/integraciones/whatsapp/components/wa-bubble.tsx` (T1): `export * from '@/components/shared/wa-bubble';`.
- Nuevo `lib/shared/ui/whatsapp-system-constants.ts` (T2 + T21): el original, más las cuatro constantes de 6.1 al final.
- `app/(private)/integraciones/whatsapp/components/whatsapp-system-constants.ts` (T2): `export * from '@/lib/shared/ui/whatsapp-system-constants';`.
- `components/shared/CATALOGO.md`: filas de `WaBubble` (`docs/diseno/canvas/WaBurbuja.dc.html`) y de las constantes (`sin UI`).
- Nuevo `tests/unit/shared-ui/whatsapp-system-constants.test.ts` (R50, R51).
- Ampliados (sin relajar ninguna aserción; los `toHaveLength(3|4)` pasan a `7|8` y las listas exactas suman las cuatro):
  `tests/unit/integraciones-ui/whatsapp-template-rules.test.ts`, `whatsapp-variables-panel.test.tsx`,
  `whatsapp-template-relate-sheet.test.tsx`, `whatsapp-template-form-sheet.test.tsx`.
- Sin cambios: importadores de QC-243, `tests/unit/integraciones-ui/wa-bubble.test.tsx`, `e2e/integraciones-whatsapp-plantillas.spec.ts`.

### Mapa R → test
| R | Test |
|---|---|
| R50 | `tests/unit/shared-ui/whatsapp-system-constants.test.ts` › «R50: son siete, en orden…», «R50: las tres actuales siguen intactas…», «R50: claves visibles y del backend sin repetir»; `whatsapp-template-rules.test.ts` › «R48 R50: son exactamente siete…» |
| R51 | `tests/unit/shared-ui/whatsapp-system-constants.test.ts` (casos R51: clave suelta, texto con marcas en los dos sentidos, `constantLabelsForBackend` con las siete); `whatsapp-template-rules.test.ts` › «P1 R51: las siete claves van al backend…», «P1 R51: las etiquetas de las siete constantes…» |
| R52 | `whatsapp-variables-panel.test.tsx` › «R48 R52: la tabla de constantes trae exactamente las siete…»; `whatsapp-template-rules.test.ts` › «R52: el diccionario trae las siete constantes en orden…»; `whatsapp-template-relate-sheet.test.tsx` › «R42 R52: el selector agrupa…», «R52: relacionar un hueco con «Estado del pedido»… guarda pedido.estado»; `whatsapp-template-form-sheet.test.tsx` › «R27 R52: «Insertar variable»…», «R52: insertar «Detalle del pedido»… pedido.detalle con su etiqueta» |
| R53 | `whatsapp-template-rules.test.ts` › «R53: una variable propia con la clave de una de las cuatro del pedido da el aviso de clave ocupada» |

### Salida real
- `pnpm run typecheck`: `tsc --noEmit`, sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, todos en archivos ajenos a la tanda.
- `pnpm exec vitest related --run <los 9 archivos tocados>`: `Test Files 15 passed (15)` · `Tests 246 passed (246)`.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)` · `Tests 1303 passed | 22 skipped (1325)`.
- `./init.sh`: ver la línea de la tanda en `progress/features/QC-246.md`.
- E2E: no procede (la tanda no toca el flujo; el spec de plantillas no cambia).
