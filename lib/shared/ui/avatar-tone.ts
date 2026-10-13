export type AvatarTone = 1 | 2 | 3 | 4 | 5 | 6;

const TONES = 6;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Color estable de avatar para un identificador: el mismo identificador da siempre el mismo tono. */
export function avatarTone(key: string): AvatarTone {
  if (key === '') return 1;
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return ((hash % TONES) + 1) as AvatarTone;
}
