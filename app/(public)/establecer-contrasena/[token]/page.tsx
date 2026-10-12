import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { AccessScreen } from '@/components/shared/access-screen';

import { SET_CREDENTIAL_HEADING_ID, SetCredentialForm } from './components';

export const metadata: Metadata = {
  title: 'Establecer contraseña · QuimiCloude',
};

// El `PageProps<...>` global lo genera Next en `.next/types/`, ignorado por git: el typecheck no
// debe depender de un artefacto de build.
type CredentialSetupPageProps = {
  readonly params: Promise<{ token: string }>;
};

/**
 * Página pública: no lee la base ni valida el enlace al pintarse (sería un oráculo de lectura y un
 * segundo camino de comprobación distinto del que escribe), no recibe ningún dato de la persona y
 * no carga recursos de otro origen, para que el secreto del camino no viaje en un `Referer`.
 */
export default async function CredentialSetupPage({
  params,
}: CredentialSetupPageProps): Promise<ReactElement> {
  const { token } = await params;

  return (
    <AccessScreen width="wide" labelledBy={SET_CREDENTIAL_HEADING_ID} testId="set-credential-screen">
      {/* En el árbol y no en `metadata`, para que la garantía se pueda afirmar sobre lo pintado. */}
      <meta name="referrer" content="no-referrer" />
      <SetCredentialForm secret={token} />
    </AccessScreen>
  );
}
