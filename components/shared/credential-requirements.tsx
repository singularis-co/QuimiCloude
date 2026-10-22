'use client';

// components/shared/credential-requirements.tsx
//
// Lista presentacional pura de los requisitos de una credencial nueva (`design.md > 3.2`).
// No declara ninguna regla: pinta el catalogo `CREDENTIAL_RULES` que exporta el dominio
// `identity` (QC-19) y deriva el estado con `evaluateCredentialRules`, que es pura y sincrona
// (R1, R2, R3, R4, R6).
//
// Solo muestra las seis reglas que se comprueban en vivo (QC-273, enmienda a R15 de QC-21):
// "breached" la decide unicamente el servidor al guardar, y si la rechaza el formulario lo dice
// en su aviso de requisitos incumplidos. El componente no hace ninguna peticion, no guarda
// estado propio y no escribe la candidata en ningun atributo ni texto (R21).

import { CheckCircle2, XCircle } from 'lucide-react';

import { CREDENTIAL_RULES, evaluateCredentialRules, type CredentialRule } from '@/lib/modules/identity';

import { CREDENTIAL_RULE_LABELS } from './credential-rule-labels';

/** Regla que la lista comprueba sin red: todas salvo la de credenciales filtradas. */
export type LiveCredentialRule = Exclude<CredentialRule, 'breached'>;

/** Las reglas que pinta la lista, en el orden del catalogo del dominio. */
export const LIVE_CREDENTIAL_RULES: readonly LiveCredentialRule[] = CREDENTIAL_RULES.filter(
  (rule): rule is LiveCredentialRule => rule !== 'breached',
);

/** Estado de una regla en la interfaz. Vive en la UI, no en el dominio (`design.md > 3.1`). */
export type CredentialRuleState = 'met' | 'unmet';

const STATE_ICON: Readonly<Record<CredentialRuleState, typeof CheckCircle2>> = {
  met: CheckCircle2,
  unmet: XCircle,
};

/** Texto de estado accesible por entrada (R16): el canal no puede ser solo color o icono. */
const STATE_TEXT: Readonly<Record<CredentialRuleState, string>> = {
  met: 'Requisito cumplido',
  unmet: 'Requisito incumplido',
};

type CredentialRequirementsProps = {
  /** El texto escrito hasta ahora. Se usa solo como argumento de una funcion pura (R21). */
  readonly candidate: string;
  /** Sustituye entera o parcialmente el copy de `CREDENTIAL_RULE_LABELS` (R15). */
  readonly labels?: Partial<Record<LiveCredentialRule, string>>;
  readonly id?: string;
};

/**
 * La lista de los seis requisitos comprobables en vivo, siempre visible (R5) y sin ningun
 * control interactivo nuevo. Sin `useState`, sin `useEffect`, sin `fetch`, sin puntuacion de
 * fuerza (R20).
 */
export function CredentialRequirements({ candidate, labels, id }: CredentialRequirementsProps) {
  const { unmet } = evaluateCredentialRules(candidate);

  return (
    <ul id={id} className="flex flex-col gap-1">
      {LIVE_CREDENTIAL_RULES.map((rule) => {
        const state: CredentialRuleState = unmet.includes(rule) ? 'unmet' : 'met';
        const label = labels?.[rule] ?? CREDENTIAL_RULE_LABELS[rule];
        const StatusIcon = STATE_ICON[state];

        return (
          <li
            key={rule}
            data-rule={rule}
            data-state={state}
            className="group/rule flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-(--dur-base) ease-(--ease-standard) data-[state=met]:text-foreground"
          >
            <StatusIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground transition-colors duration-(--dur-base) ease-(--ease-standard) group-data-[state=met]/rule:text-success-text"
            />
            <span>{label}</span>
            <span className="sr-only">{STATE_TEXT[state]}</span>
          </li>
        );
      })}
    </ul>
  );
}
