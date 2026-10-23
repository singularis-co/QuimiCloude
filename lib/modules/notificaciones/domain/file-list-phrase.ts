const MAX_NAME_LENGTH = 60;

// Por puntos de código: un recorte por unidades UTF-16 podría partir un emoji.
function shorten(name: string): string {
  const characters = [...name];
  if (characters.length <= MAX_NAME_LENGTH) return name;
  return `${characters.slice(0, MAX_NAME_LENGTH - 1).join('')}…`;
}

function joinWithAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

/**
 * `"a.pdf", "b.pdf" y "c.pdf"`, o `"a.pdf", "b.pdf" y 4 más` cuando quedan fallidos sin nombrar.
 * Con `names` vacío devuelve `''`: quien la usa elige entonces el texto sin nombres.
 */
export function fileListPhrase(names: readonly string[], failed: number): string {
  if (names.length === 0) return '';
  const quoted = names.map((name) => `"${shorten(name)}"`);
  const unnamed = failed - names.length;
  if (unnamed <= 0) return joinWithAnd(quoted);
  return `${quoted.join(', ')} y ${unnamed} más`;
}
