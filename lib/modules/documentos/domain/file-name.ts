import { z } from 'zod';

export const MAX_FILE_NAME_LENGTH = 255;

const CONTROL_CHARACTERS = /\p{Cc}/gu;

/** Lo que va tras la última `/` o `\`: algunos navegadores mandan la ruta entera del equipo. */
function withoutFolders(name: string): string {
  return name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
}

// Se cuenta por puntos de código, como `char_length` del CHECK de la columna.
export const fileNameSchema = z
  .string()
  .transform((name) => withoutFolders(name).replace(CONTROL_CHARACTERS, '').trim())
  .refine((name) => name.length > 0 && [...name].length <= MAX_FILE_NAME_LENGTH);
