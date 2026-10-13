# QC-275 — Proveedor IA propio de la empresa

> **Zona** fullstack · **Complejidad** high · **depends_on** QC-234 (hecha) · **Rama** `feature/QC-275-proveedor-ia-propio`
>
> **Alcance.** En Integraciones > Proveedor IA (`/integraciones/proveedor-ia`, hoy placeholder de
> QC-222) el Administrador elige **un** proveedor de IA, pega su API key, la prueba y la guarda
> cifrada (`SecretCipher` de QC-234). Desde entonces la lectura de fórmula desde PDF (QC-159) y de
> catálogo desde PDF (QC-158) de esa empresa usan **su** key, con el modelo que el seed fija para
> cada uso. Catálogo de proveedores por seed: Claude (Anthropic), Gemini (Google), OpenAI y
> OpenRouter, con un modelo de receta y otro de catálogo cada uno. Sin proveedor, la lectura de PDF
> se bloquea con un aviso que lleva a Integraciones.
>
> **Lo que NO entra.** Varios proveedores como respaldo encadenado (QC-276). Elegir modelo a mano.
> Medir o limitar el consumo. Rotación de la clave de cifrado (QC-250).
>
> Sembrado por `/afinar-feature` el 2026-10-13. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- Identificadores exactos de los dos modelos (receta, catálogo) de cada proveedor: los propone el
  spec, verificados contra la documentación vigente de cada proveedor, y los aprueba el humano en
  F1.4. No se inventan.
- QC-175 (respaldo de Gemini por variable de entorno) pierde sentido con el corte de D1: ¿se cancela
  absorbida por QC-276? Lo decide el humano al acotar QC-276; no bloquea esta ficha.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-13 | ¿Qué pasa con las empresas sin key propia al desplegar? | Corte inmediato: cada empresa usa su propia key. `ANTHROPIC_API_KEY` y `GEMINI_API_KEY` dejan de usarse para leer PDF de empresas. |
| 2026-10-13 | ¿Quién configura la key? | El Administrador, con `integraciones.modificar` (QC-221). Mismo criterio que QC-237 D1. |
| 2026-10-13 | ¿SDK de OpenAI o `fetch`? | SDK oficial de OpenAI, también para OpenRouter (API compatible). Dependencia nueva: los cuatro checks y la fila propuesta van en el design (regla 7). |
| 2026-10-13 | ¿Uno o varios proveedores? | Uno activo por empresa en esta ficha. Varios como respaldo encadenado van en QC-276. |
| 2026-10-13 | ¿Qué proveedores entran en el seed? | Claude (Anthropic), Gemini (Google), OpenAI y OpenRouter. Todos aceptan PDF o imágenes, que es lo que leen los dos usos. |
| 2026-10-13 | ¿Se puede cambiar o quitar? | Sí: cambiar key, cambiar proveedor (con prueba nueva) y desconectar con confirmación. Al desconectar el secreto se borra físicamente. |
| 2026-10-13 | ¿Se prueba la key? | Sí: «Probar conexión» hace una llamada mínima al proveedor, y la misma prueba corre antes de guardar. Con la key rechazada no se guarda nada (patrón QC-237 D6). |
| 2026-10-13 | ¿Qué pasa si la key falla en uso? | La lectura falla con «Error con tu proveedor» y la conexión queda en estado Error con su último error visible en Integraciones (patrón QC-237 D13). No se reintenta con la key de la plataforma. |
| 2026-10-13 | ¿Se devuelve la key al navegador? | Nunca (heredado de QC-237 D4). Cifrada con el `SecretContext` de QC-234 (QC-237 D8). |
| 2026-10-13 | ¿Diseño? | Tableros `docs/diseno/canvas/ProveedorIA.dc.html`, `ProveedorIATablet.dc.html` y `ProveedorIAMovil.dc.html`, aprobados por el humano. Con el logo oficial de cada proveedor (SVG del kit de marca). |
| — | Identificadores de DB | En inglés (heredado de QC-4). |
