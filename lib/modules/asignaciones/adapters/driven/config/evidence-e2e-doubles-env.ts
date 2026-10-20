/**
 * Se lee en cada llamada, nunca al importar. Su ausencia significa el bucket real: solo puesta y
 * con algo dentro elige el doble en memoria.
 */

const E2E_DOUBLES_ENV_VAR_NAME = 'EVIDENCE_E2E_DOUBLES';

export function evidenceE2EDoublesEnabled(): boolean {
  const raw = process.env[E2E_DOUBLES_ENV_VAR_NAME];
  return raw !== undefined && raw.trim() !== '';
}
