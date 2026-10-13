// Barrel de los componentes de la ruta `/establecer-contrasena/[token]`
// (`docs/architecture.md > Componentes > Regla: componentes de ruta en components/ con barrel index.ts`).
//
// Sin `'use client'`: la frontera cliente/servidor se declara en cada archivo de componente,
// nunca aqui. Asi `page.tsx` sigue siendo Server Component aunque importe desde el barrel.
export { SetCredentialForm } from './set-credential-form';
export {
  SET_CREDENTIAL_HEADING_ID,
  SET_CREDENTIAL_LABELS,
  type SetCredentialLabels,
} from './set-credential-labels';
