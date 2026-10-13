'use client';

// La action se importa por su ruta exacta y no por el barrel del módulo: el contrato del módulo no
// reexporta adaptadores driving y un `'use server'` en su cierre transitivo rompería a cualquier
// componente de cliente que lo importe.
//
// El formulario no recibe ni pinta ningún dato de la persona (el estado de la action no tiene campo
// que los transporte), no valida el enlace al montarse (el secreto solo se comprueba donde se
// escribe) y no abre sesión al terminar: ofrece un enlace al login.

import { CircleCheck } from 'lucide-react';
import { Fragment, useActionState } from 'react';

import { ArrowLink } from '@/components/shared/arrow-link';
import { BrandLogo } from '@/components/shared/brand-logo';
import { CREDENTIAL_RULE_LABELS } from '@/components/shared/credential-rule-labels';
import { Notice } from '@/components/shared/notice';
import { PasswordField } from '@/components/shared/password-field';
import { SubmitButton } from '@/components/shared/submit-button';
import {
  setCredentialWithLinkAction,
  type SetCredentialFormState,
} from '@/lib/modules/identity/adapters/driving/credential-setup-actions';
import { BRAND_LABEL } from '@/lib/shared/navigation/private-nav';
import { LOGIN_ROUTE } from '@/lib/shared/routes';
import { cn } from '@/lib/utils';

import {
  SET_CREDENTIAL_HEADING_ID,
  SET_CREDENTIAL_LABELS,
  type SetCredentialLabels,
} from './set-credential-labels';

// Un archivo `'use server'` solo puede exportar funciones async: el estado inicial no puede vivir
// junto a la action.
const INITIAL_STATE: SetCredentialFormState = { status: 'idle' };

const CREDENTIAL_ID = 'credential';
const CONFIRMATION_ID = 'credential-confirmation';
const FEEDBACK_ID = 'set-credential-feedback';

// Sin `breachedState`: la séptima regla solo la comprueba el servidor y queda pendiente.
const LIVE_REQUIREMENTS = {};

type SetCredentialFormProps = {
  /** El secreto del enlace, tal y como llegó en el segmento de la URL. */
  readonly secret: string;
  /** Sustituye entero o en parte el copy por defecto. */
  readonly labels?: Partial<SetCredentialLabels>;
};

type HeadingProps = {
  readonly title: string;
  readonly body: string;
  readonly centered?: boolean;
  readonly testId?: string;
};

function Heading({ title, body, centered, testId }: HeadingProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', centered && 'text-center')} data-testid={testId}>
      <h1
        id={SET_CREDENTIAL_HEADING_ID}
        className="text-2xl leading-[1.15] font-semibold tracking-[-0.015em]"
      >
        {title}
      </h1>
      <p className="text-sm leading-normal text-muted-foreground">{body}</p>
    </div>
  );
}

function SuccessState({ texto }: { readonly texto: SetCredentialLabels }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="flex size-11 items-center justify-center self-center rounded-[12px] bg-success-subtle text-success-text"
        data-testid="set-credential-success-icon"
      >
        <CircleCheck className="size-5" />
      </div>
      <Heading
        title={texto.successTitle}
        body={texto.successBody}
        centered
        testId="set-credential-success"
      />
      <ArrowLink
        direction="forward"
        touch
        href={LOGIN_ROUTE}
        className="w-full"
        testId="set-credential-login-link"
      >
        {texto.goToLogin}
      </ArrowLink>
    </>
  );
}

export function SetCredentialForm({ secret, labels }: SetCredentialFormProps) {
  const [state, formAction] = useActionState(setCredentialWithLinkAction, INITIAL_STATE);
  const texto: SetCredentialLabels = { ...SET_CREDENTIAL_LABELS, ...labels };

  // Los bloques son hijos directos de la tarjeta para que entren escalonados; el `key` de cada rama
  // los monta de nuevo al pasar al éxito y la entrada se repite.
  if (state.status === 'success') {
    return <SuccessState key="success" texto={texto} />;
  }

  const invalid = state.status === 'invalid_credential';

  return (
    <Fragment key="form">
      <div data-testid="set-credential-brand">
        <BrandLogo variant="isotipo" tone="auto" height={40} alt={BRAND_LABEL} />
      </div>
      <Heading title={texto.title} body={texto.intro} />
      <form action={formAction} className="flex flex-col gap-4" data-testid="set-credential-form">
        {/* Que sea oculto no lo hace de fiar: lo juzga el `UPDATE` condicional del adaptador. */}
        <input type="hidden" name="secret" defaultValue={secret} data-testid="set-credential-secret" />

        <PasswordField
          name="credential"
          id={CREDENTIAL_ID}
          label={texto.credentialLabel}
          autoComplete="new-password"
          texts={{ show: texto.showCredential, hide: texto.hideCredential }}
          describedBy={invalid ? FEEDBACK_ID : undefined}
          testId="set-credential-credential"
          requirements={LIVE_REQUIREMENTS}
        />

        <PasswordField
          name="credentialConfirmation"
          id={CONFIRMATION_ID}
          label={texto.confirmationLabel}
          autoComplete="new-password"
          texts={{ show: texto.showCredential, hide: texto.hideCredential }}
          error={state.status === 'mismatch' ? texto.mismatch : undefined}
          testId="set-credential-confirmation"
        />

        {invalid ? (
          <Notice tone="danger" id={FEEDBACK_ID} title={texto.unmetIntro} testId="set-credential-feedback">
            <ul className="mt-1 list-disc pl-[18px]" data-testid="set-credential-unmet">
              {state.unmet.map((rule) => (
                <li key={rule} data-rule={rule}>
                  {CREDENTIAL_RULE_LABELS[rule]}
                </li>
              ))}
            </ul>
          </Notice>
        ) : null}

        {state.status === 'error' ? (
          <div role="alert" className="flex flex-col gap-1 text-sm text-destructive">
            <p data-testid="set-credential-error">{state.message}</p>
            {/* La referencia solo existe en el error inesperado; se pinta para poder citarla al reportar. */}
            {'reference' in state ? (
              <p className="text-muted-foreground" data-testid="set-credential-error-reference">
                {`${texto.errorReference} ${state.reference}`}
              </p>
            ) : null}
          </div>
        ) : null}

        <SubmitButton
          label={texto.submit}
          pendingLabel={texto.submitPending}
          testId="set-credential-submit"
          className="w-full"
        />
      </form>
    </Fragment>
  );
}
