import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

export type SystemConstant = {
  readonly displayKey: string;
  readonly backendKey: string;
  readonly label: string;
  readonly description: string;
  readonly example: string;
};

export const SYSTEM_CONSTANTS: readonly SystemConstant[] = [
  {
    displayKey: 'nombre_del_cliente',
    backendKey: 'cliente.nombre',
    label: 'Nombre del cliente',
    description: 'Nombres y apellidos del cliente que recibe el mensaje.',
    example: 'Laura Gómez',
  },
  {
    displayKey: 'numero_de_pedido',
    backendKey: 'pedido.numero',
    label: 'Número de pedido',
    description: 'Número del pedido del que trata el mensaje.',
    example: 'PED-00128',
  },
  {
    displayKey: 'nombre_de_la_empresa',
    backendKey: 'empresa.nombre',
    label: 'Nombre de la empresa',
    description: 'El nombre de tu empresa en QuimiCloude.',
    example: EMPTY_MARK,
  },
];

const BY_DISPLAY_KEY: ReadonlyMap<string, SystemConstant> = new Map(
  SYSTEM_CONSTANTS.map((constant) => [constant.displayKey, constant]),
);
const BY_BACKEND_KEY: ReadonlyMap<string, SystemConstant> = new Map(
  SYSTEM_CONSTANTS.map((constant) => [constant.backendKey, constant]),
);

const MARKER_PATTERN = /\{\{([^{}]*)\}\}/g;

export function isSystemDisplayKey(key: string): boolean {
  return BY_DISPLAY_KEY.has(key);
}

export function systemConstantOf(displayKey: string): SystemConstant | undefined {
  return BY_DISPLAY_KEY.get(displayKey);
}

// El backend reconoce una constante por el punto; en pantalla se escriben con el formato de las propias.
export function toBackendKey(displayKey: string): string {
  return BY_DISPLAY_KEY.get(displayKey)?.backendKey ?? displayKey;
}

export function displayKeyOf(backendKey: string): string {
  return BY_BACKEND_KEY.get(backendKey)?.displayKey ?? backendKey;
}

export function toBackendText(text: string): string {
  return text.replace(MARKER_PATTERN, (marker, inner: string) => {
    const constant = BY_DISPLAY_KEY.get(inner);
    return constant === undefined ? marker : `{{${constant.backendKey}}}`;
  });
}

export function toDisplayText(text: string): string {
  return text.replace(MARKER_PATTERN, (marker, inner: string) => {
    const constant = BY_BACKEND_KEY.get(inner);
    return constant === undefined ? marker : `{{${constant.displayKey}}}`;
  });
}

/** Clave del backend → etiqueta, para usarla como ejemplo al crear la plantilla. */
export function constantLabelsForBackend(): Readonly<Record<string, string>> {
  return Object.fromEntries(SYSTEM_CONSTANTS.map((constant) => [constant.backendKey, constant.label]));
}
