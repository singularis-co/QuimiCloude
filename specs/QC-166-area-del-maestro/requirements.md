# QC-166 — area-del-maestro · requirements.md

> **Zona:** frontend · **Complejidad:** sin evaluar · **depends_on:** QC-162, QC-165, QC-235 · **Rama:** `feature/QC-166-area-del-maestro`
>
> **Alcance.** Área propia del Maestro, separada del ERP, con su barra lateral («Plataforma»).
> EMPRESAS: lista, alta con su Administrador inicial, edición con País, baja con impacto y
> reactivación. Detalle de empresa con pestañas Datos, Módulos (la llena QC-278) e Historial.
> ADMINISTRADORES: lista de todas las empresas, alta eligiendo empresa, edición y baja. El Maestro
> aterriza aquí al iniciar sesión.
>
> **Lo que NO entra.** El servidor de Administradores (QC-165). El contenido de la pestaña Módulos
> (QC-278). Reenviar el enlace a un Administrador (fuera de QC-165). Planes y cobro (QC-182 y
> siguientes).
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

1. **Texto del toast si falla el correo al Administrador inicial.** Se propone «Empresa creada,
   pero no pudimos enviar el correo al Administrador.»; el humano lo confirma en la revisión del
   spec.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-16 | ¿Diseño? | Pase `/design` aprobado: `docs/diseno/canvas/MaestroEmpresas*`, `MaestroEmpresa*`, `MaestroEmpresaHistorial`, `MaestroAdministradores*`, `ModalesMaestro`, `Sidebar` (prop `area="maestro"`). |
| 2026-10-16 | ¿Rutas y navegación? | `/maestro/empresas` (heredada de **QC-235**), `/maestro/empresas/[id]` con pestañas que son enlaces (`?tab=datos\|modulos\|historial`) y `/maestro/administradores`. Barra lateral propia con Empresas y Administradores; sin módulos del ERP. |
| 2026-10-16 | ¿Dónde aterriza el Maestro? | En `/maestro/empresas` (heredado de **QC-161**). |
| 2026-10-16 | ¿Editar una empresa de baja? | Sí (heredado de **QC-162**): el menú de una empresa de baja ofrece Abrir, Editar y Reactivar. |
| 2026-10-16 | ¿Qué dice la baja de empresa? | Muestra usuarios activos y pedidos abiertos, pide escribir el nombre, y avisa que sus usuarios no podrán entrar y se cerrarán sus sesiones (heredado de **QC-162 R20–R24**). |
| 2026-10-16 | ¿Se lista QuimiCloud? | Sí, como cualquier empresa (heredado de **QC-162 P5**). |
| 2026-10-16 | ¿Historial? | Pestaña del detalle con `listCompanyEventsAction`: nombra los campos que cambiaron, no sus valores (heredado de **QC-162 R34–R39**). Quién lo hizo: nombre del usuario Maestro. |
| 2026-10-16 | ¿Último Administrador? | No se puede dar de baja: primero hay que crear otro. El diálogo lo dice y no deja confirmar (decidido para **QC-165**). |
| 2026-10-16 | ¿Mover un Administrador de empresa? | No. En Editar la empresa se muestra fija (decidido para **QC-165**). |
| 2026-10-16 | ¿Permisos? | `empresas.consultar` para ver y `empresas.modificar` para escribir, validado en el service (heredado de **QC-161**). |
| 2026-10-16 | ¿E2E? | Sí. Paga el diferido de **QC-161, QC-162, QC-165 y QC-235**, más el caso «el Maestro cambia el país y lo ve en el listado». |
| 2026-10-16 | ¿Estados? | Cargando con esqueleto, vacío (filtro «De baja») y error con «Reintentar», con los componentes del catálogo. |
