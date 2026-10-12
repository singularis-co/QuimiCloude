// Todo el copy de la pantalla en una sola fuente, para que migrarlo a un archivo de idioma sea
// mover un objeto. El texto de cada regla incumplida no vive aquí: sale de `CREDENTIAL_RULE_LABELS`
// a partir del código estable que devuelve el dominio. Ningún texto tiene hueco para un dato de la
// persona.

// Vive aquí y no en el formulario: una constante exportada desde un módulo `'use client'` llega a
// la página de servidor como referencia de cliente, no como texto.
/** El `h1` del formulario y el del éxito comparten id: la tarjeta se nombra con él en los dos. */
export const SET_CREDENTIAL_HEADING_ID = 'set-credential-heading';

export type SetCredentialLabels = {
  readonly title: string;
  readonly intro: string;
  readonly credentialLabel: string;
  readonly confirmationLabel: string;
  readonly showCredential: string;
  readonly hideCredential: string;
  readonly submit: string;
  readonly submitPending: string;
  readonly mismatch: string;
  readonly unmetIntro: string;
  readonly successTitle: string;
  readonly successBody: string;
  readonly goToLogin: string;
  readonly errorReference: string;
};

export const SET_CREDENTIAL_LABELS: SetCredentialLabels = {
  title: 'Establece tu contraseña',
  intro: 'Escribe la contraseña con la que vas a entrar y repítela para confirmarla.',
  credentialLabel: 'Contraseña nueva',
  confirmationLabel: 'Repite la contraseña',
  showCredential: 'Mostrar la contraseña',
  hideCredential: 'Ocultar la contraseña',
  submit: 'Guardar contraseña',
  submitPending: 'Guardando…',
  mismatch: 'Las dos contraseñas no coinciden.',
  unmetIntro: 'La contraseña todavía no cumple estos requisitos:',
  successTitle: 'Contraseña establecida',
  successBody: 'Ya puedes entrar con ella.',
  goToLogin: 'Ir a iniciar sesión',
  errorReference: 'Referencia del fallo:',
};
