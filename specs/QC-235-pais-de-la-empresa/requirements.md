# QC-235 — País de la empresa

> **Alcance.** La empresa gana un país opcional (ISO 3166-1 alfa-2), valor por defecto para los
> teléfonos de sus clientes. Entra: columna `companies.country` (nullable), acción de servidor para
> fijarlo o vaciarlo (autorizada en el service con `empresas.modificar`), componente compartido
> `CountrySelect` (países de `getCountries()`, nombres de `Intl.DisplayNames('es')`, prefijo,
> búsqueda por nombre o prefijo, valor vacío, sin lógica de empresa) y la dependencia
> `libphonenumber-js` con su fila en `docs/dependencias.md`.
>
> **Lo que NO entra.** La pantalla de empresas y su ruta `/maestro/empresas` (QC-166). El E2E
> (diferido a QC-166). Que el Administrador edite su país. Otros datos de la empresa. Alta, baja o
> renombrado de empresas (QC-162). El teléfono del cliente (QC-236).
>
> Sembrado por `/afinar-feature` el 2026-10-13. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- Hasta que salga QC-166, ninguna empresa tiene país desde la app. ¿El seed de demostración
  (QC-230) debe fijar `CO` a la empresa demo? No se decidió.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-09 | ¿Quién edita el país? | El Maestro, con `empresas.modificar`. Sin permiso nuevo. |
| 2026-10-09 | ¿Formato? | ISO 3166-1 alfa-2, el mismo que `CountryCode` de `libphonenumber-js`. |
| 2026-10-09 | ¿Lista de países propia o compartida? | Un solo `CountrySelect`, reutilizado en QC-236. |
| 2026-10-09 | ¿Librería? | `libphonenumber-js`, aprobada por el humano; los cuatro checks se hacen antes de instalar. |
| 2026-10-13 | ¿Pantalla aquí o en el Área del Maestro? | En QC-166. QC-235 deja el servidor y el componente listos. |
| 2026-10-13 | ¿Ruta? | `/maestro/empresas`, inaugurada por QC-166. |
| 2026-10-13 | ¿E2E? | Diferido a QC-166. Aquí: unitarios e integración del service, y test del componente. |
| — | Identificadores de DB | En inglés (heredado de QC-4). |
