'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useId, useState, type ChangeEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { evaluateCredentialRules, type CredentialRule } from '@/lib/modules/identity';

import { CredentialRequirements, type CredentialRuleState } from './credential-requirements';
import { FieldError } from './field-error';

export const PASSWORD_FIELD_SHOW_LABEL = 'Mostrar la contraseña';
export const PASSWORD_FIELD_HIDE_LABEL = 'Ocultar la contraseña';

export type PasswordFieldRequirements = {
  readonly breachedState?: CredentialRuleState;
  readonly labels?: Partial<Record<CredentialRule, string>>;
  readonly onOwnRulesMetChange?: (met: boolean) => void;
};

export type PasswordFieldProps = {
  readonly name: string;
  readonly label: string;
  readonly id?: string;
  readonly autoComplete?: 'current-password' | 'new-password' | 'off';
  readonly variant?: 'password' | 'secret';
  readonly texts?: { readonly show?: string; readonly hide?: string };
  readonly error?: string;
  readonly describedBy?: string;
  readonly testId?: string;
  readonly required?: boolean;
  readonly requirements?: PasswordFieldRequirements;
};

type FieldShellProps = Omit<PasswordFieldProps, 'requirements' | 'id'> & {
  readonly inputId: string;
  readonly requirementsId?: string;
  readonly value?: string;
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly children?: ReactNode;
};

function joinIds(...ids: readonly (string | undefined)[]): string | undefined {
  const present = ids.filter((value): value is string => Boolean(value));
  return present.length ? present.join(' ') : undefined;
}

function FieldShell({
  name,
  label,
  inputId,
  autoComplete,
  variant = 'password',
  texts,
  error,
  describedBy,
  testId,
  required,
  requirementsId,
  value,
  onChange,
  children,
}: FieldShellProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${inputId}-error`;
  const showLabel = texts?.show ?? PASSWORD_FIELD_SHOW_LABEL;
  const hideLabel = texts?.hide ?? PASSWORD_FIELD_HIDE_LABEL;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          aria-required={required ? true : undefined}
          spellCheck={variant === 'secret' ? false : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinIds(describedBy, requirementsId, error ? errorId : undefined)}
          value={value}
          onChange={onChange}
          data-variant={variant}
          data-masked={!visible}
          data-testid={testId}
          className="h-11 pr-12 text-base md:text-base data-[variant=secret]:font-mono data-[variant=secret]:data-[masked=true]:tracking-[0.18em]"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          touch
          aria-pressed={visible}
          aria-controls={inputId}
          onClick={() => setVisible((previous) => !previous)}
          data-testid={testId ? `${testId}-toggle` : undefined}
          className="group/eye absolute top-0 right-0 size-11 text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true" className="grid [&>svg]:col-start-1 [&>svg]:row-start-1">
            <Eye className="size-[18px] opacity-0 transition-opacity duration-(--dur-base) ease-(--ease-standard) group-aria-pressed/eye:opacity-100" />
            <EyeOff className="size-[18px] transition-opacity duration-(--dur-base) ease-(--ease-standard) group-aria-pressed/eye:opacity-0 [&_path:last-child]:[stroke-dasharray:30] [&_path:last-child]:transition-[stroke-dashoffset] [&_path:last-child]:duration-(--dur-base) [&_path:last-child]:ease-(--ease-standard) group-aria-pressed/eye:[&_path:last-child]:[stroke-dashoffset:30]" />
          </span>
          <span className="sr-only">{visible ? hideLabel : showLabel}</span>
        </Button>
      </div>
      {children}
      <FieldError id={errorId} message={error} testId={testId ? `${testId}-error` : undefined} />
    </div>
  );
}

function FieldWithRequirements({
  requirements,
  inputId,
  ...shell
}: Omit<FieldShellProps, 'requirementsId' | 'value' | 'onChange' | 'children'> & {
  readonly requirements: PasswordFieldRequirements;
}) {
  const requirementsId = `${inputId}-requirements`;
  const [candidate, setCandidate] = useState('');
  const ownRulesMet = evaluateCredentialRules(candidate).ok;
  const { onOwnRulesMetChange } = requirements;

  // Avisa al montar y solo cuando cambia el veredicto, no en cada pulsación ni cuando el
  // consumidor pasa una función nueva en cada render.
  useEffect(() => {
    onOwnRulesMetChange?.(ownRulesMet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownRulesMet]);

  return (
    <FieldShell
      {...shell}
      inputId={inputId}
      requirementsId={requirementsId}
      value={candidate}
      onChange={(event) => setCandidate(event.target.value)}
    >
      <CredentialRequirements
        id={requirementsId}
        candidate={candidate}
        breachedState={requirements.breachedState}
        labels={requirements.labels}
      />
    </FieldShell>
  );
}

export function PasswordField({ id, requirements, ...rest }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  if (requirements) {
    return <FieldWithRequirements {...rest} inputId={inputId} requirements={requirements} />;
  }
  return <FieldShell {...rest} inputId={inputId} />;
}
