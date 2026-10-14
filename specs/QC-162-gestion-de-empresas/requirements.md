# QC-162 — gestion-de-empresas · requirements.md

> Zona: backend · Complejidad: high · depends_on: QC-161 (done) · Rama: feature/QC-162-gestion-de-empresas
>
> **Alcance.** En el servidor, el Maestro consulta, da de alta, edita, da de baja y reactiva
> empresas (`empresas.consultar` / `empresas.modificar`).
> - El alta crea la empresa junto con su primer Administrador, que recibe el enlace para fijar
>   su contraseña.
> - Cada cambio queda en un historial.
> - En producción, el seed crea solo al Maestro.
>
> **Lo que NO entra.**
> - La pantalla: QC-166.
> - Gestionar más Administradores después del alta (editar, dar de baja, agregar otros): QC-165.
> - El país, que lo guarda QC-235.
> - Los módulos de la empresa: QC-277.
> - La moneda por empresa: QC-182.
>
> Sembrado por `/afinar-feature` el 2026-10-13. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- Campos exactos de «contacto» (¿correo y teléfono? ¿persona de contacto?): propone spec_author;
  por defecto, correo y teléfono.
- El último Administrador y el cambio de empresa de un Administrador siguen abiertos en QC-165.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-13 | ¿Datos de la empresa? | Nombre, identificación fiscal y contacto. El país ya existe (QC-235). |
| 2026-10-13 | ¿Identificación fiscal? | Opcional. Si viene, es única entre empresas vivas, con formato libre. |
| 2026-10-13 | ¿Alta? | Crea la empresa y su primer Administrador en el mismo paso; el Administrador recibe el enlace de contraseña (QC-79). Una empresa nunca nace sin Administrador. |
| 2026-10-13 | ¿Baja con gente trabajando? | Se permite. El Maestro confirma escribiendo el nombre de la empresa y ve antes cuántos usuarios y pedidos en curso tiene. La baja expulsa a todos en la siguiente petición (ya existe). |
| 2026-10-13 | ¿Reactivar? | Sí, con todos sus datos y usuarios, si el nombre sigue libre. Si otra empresa viva lo tomó, hay que renombrarla antes. |
| 2026-10-13 | ¿Lista? | Muestra las activas, con un filtro para ver las de baja. Tiene búsqueda y paginación. Columnas: nombre, identificación, país, nº de usuarios, fecha de alta y estado. |
| 2026-10-13 | ¿Historial? | Guarda quién y cuándo creó, editó, dio de baja o reactivó cada empresa. QC-277 lo reutiliza para los módulos. |
| 2026-10-13 | ¿Seed? | En producción, solo el Maestro. En local y preview siguen «QuimiCloud» y la demo. |
| heredada QC-161 | ¿Permisos? | Ya existen: `empresas.modificar` cubre alta, edición, baja y reactivación. Autorización por permiso, nunca por rol. |
| heredada QC-235 | ¿Acceso del Maestro? | Por la vía de plataforma ya existente (`PlatformActor`), sin contexto de empresa. |
| heredada QC-4 / arquitectura | ¿Borrado? | Lógico; el nombre es único entre empresas vivas, sin distinguir mayúsculas ni acentos. |
| heredada QC-161 D8 | ¿E2E? | En QC-166, la primera con pantalla. Aquí, integración y unitarios. |
