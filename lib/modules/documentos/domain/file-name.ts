import { z } from 'zod';

export const MAX_FILE_NAME_LENGTH = 255;

const CONTROL_CHARACTERS = /\p{Cc}/gu;

/** Lo que va tras la última `/` o `\`: algunos navegadores mandan la ruta entera del equipo. */
function withoutFolders(name: string): string {
  return name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
}

// Por puntos de código, como `char_length` del CHECK de la columna: cortar por unidades UTF-16
// partiría un emoji por la mitad.
function truncated(name: string): string {
  return [...name].slice(0, MAX_FILE_NAME_LENGTH).join('').trim();
}

// Un nombre inservible no tumba la tanda: el archivo se encola igual, sin nombre.
export const fileNameSchema = z
  .string()
  .transform((name): string | null => {
    const clean = truncated(withoutFolders(name).replace(CONTROL_CHARACTERS, '').trim());
    return clean.length > 0 ? clean : null;
  });
