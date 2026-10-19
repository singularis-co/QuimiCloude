# QC-278 — impl (bitácora de implementación)

## Tanda 1 — T1, T2, T3 (frontend_dev, 2026-10-19)

### Archivos creados

- `app/(private)/maestro/empresas/[id]/components/modulos/addon-labels.ts` — `ADDON_LABELS`, `changedAddons`, `successMessage`
- `app/(private)/maestro/empresas/[id]/components/modulos/addon-off-consequences.ts` — `offConsequences`
- `app/(private)/maestro/empresas/[id]/components/modulos/core-modules.ts` — `CORE_MODULE_NAMES` (11)
- `app/(private)/maestro/empresas/[id]/components/modulos/core-module-chips.tsx` — `CoreModuleChips` (Server)
- `app/(private)/maestro/empresas/[id]/components/modulos/modules-skeleton.tsx` — `ModulesSkeleton` (Server)
- `tests/unit/maestro/addon-labels.test.ts`
- `tests/ui/maestro/core-module-chips.test.tsx`

### Notas

- `successMessage` lleva un tercer argumento `via: 'one' | 'all'` (design § 4.2 lo nombra con dos).
  Con dos no se distingue «Proveedores prendido.» (uno) de «Se prendió 1 módulo.» («todos» con un
  solo cambio), y R15 pide los dos. T4 lo llama con el `via` que ya tiene `write()`.
- `offConsequences` ordena por `view.addons` (que viene en el orden de `ADDONS`) para no importar
  el valor `ADDONS` del barrel de identity desde código que acaba en el cliente.

### Mapa `R<n> → test` (tanda 1)

| R | Test |
|---|---|
| R5 | `tests/unit/maestro/addon-labels.test.ts` «R5: hay una etiqueta por añadido del catálogo», «R5: las descripciones son las de la pregunta 1, cerrada» |
| R10 | `tests/unit/maestro/addon-labels.test.ts` «R10: cada añadido lista lo que se descarta al apagarlo», «R10: Integraciones solo avisa de la lectura si está prendida» |
| R12 | `tests/unit/maestro/addon-labels.test.ts` «R12: Apagar todos junta lo que se descarta sin repetir, en el orden del catálogo y sin la línea de Integraciones» |
| R15 | `tests/unit/maestro/addon-labels.test.ts` «R15: devuelve solo los añadidos cuyo interruptor cambió, en el orden de la vista», «R15: mensajes de toast en singular y plural» |
| R19 | `tests/ui/maestro/core-module-chips.test.tsx` «R19: once fichas del núcleo con candado y nada pulsable» |
| R3 | `ModulesSkeleton` sin test propio: lo cubre el caso R3 de T5 |

### Salida de los comandos

```
pnpm exec vitest related --run <los 5 archivos de modulos/ + los 2 tests>
 Test Files  2 passed (2)
      Tests  8 passed (8)

pnpm run typecheck
> tsc --noEmit            (sin errores)

pnpm run lint
ESLint: 0 errors, 10 warnings in 4 files   (todas preexistentes, ninguna en archivos de esta tanda)

pnpm exec vitest run guard
 Test Files  81 passed (81)
      Tests  1106 passed | 20 skipped (1126)
```

### Veredicto

T1, T2 y T3 hechas: 8/8 tests en verde, typecheck, lint y guardias en verde.
