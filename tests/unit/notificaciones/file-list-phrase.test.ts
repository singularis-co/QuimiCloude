import { describe, expect, it } from 'vitest';

import { fileListPhrase } from '@/lib/modules/notificaciones/domain/file-list-phrase';

describe('fileListPhrase — la lista de archivos fallidos del aviso', () => {
  it('R51: uno, dos y tres nombres, todos nombrados', () => {
    expect(fileListPhrase(['a.pdf'], 1)).toBe('"a.pdf"');
    expect(fileListPhrase(['a.pdf', 'b.pdf'], 2)).toBe('"a.pdf" y "b.pdf"');
    expect(fileListPhrase(['a.pdf', 'b.pdf', 'c.pdf'], 3)).toBe('"a.pdf", "b.pdf" y "c.pdf"');
  });

  it('R51: cuatro fallidos con nombre nombran tres y «y 1 más»', () => {
    expect(fileListPhrase(['a.pdf', 'b.pdf', 'c.pdf'], 4)).toBe('"a.pdf", "b.pdf", "c.pdf" y 1 más');
  });

  it('R51: siete fallidos con tres nombrados: «y 4 más»', () => {
    expect(fileListPhrase(['a.pdf', 'b.pdf', 'c.pdf'], 7)).toBe('"a.pdf", "b.pdf", "c.pdf" y 4 más');
  });

  it('R51: un nombre y dos fallidos sin nombre: «"a.pdf" y 2 más»', () => {
    expect(fileListPhrase(['a.pdf'], 3)).toBe('"a.pdf" y 2 más');
  });

  it('R51: dos nombres y uno sin nombre se separan con coma', () => {
    expect(fileListPhrase(['a.pdf', 'b.pdf'], 3)).toBe('"a.pdf", "b.pdf" y 1 más');
  });

  it('R51: un nombre de 61 caracteres se recorta a 59 + «…» y uno de 60 no', () => {
    const sesenta = `${'x'.repeat(56)}.pdf`;
    const sesentaYUno = `${'y'.repeat(57)}.pdf`;
    expect(sesenta).toHaveLength(60);
    expect(sesentaYUno).toHaveLength(61);

    expect(fileListPhrase([sesenta], 1)).toBe(`"${sesenta}"`);
    expect(fileListPhrase([sesentaYUno], 1)).toBe(`"${'y'.repeat(57)}.p…"`);
    expect([...fileListPhrase([sesentaYUno], 1).slice(1, -1)]).toHaveLength(60);
  });

  it('R51: el recorte no parte un carácter de fuera del plano básico', () => {
    const emojis = '😀'.repeat(61);
    expect(fileListPhrase([emojis], 1)).toBe(`"${'😀'.repeat(59)}…"`);
  });

  it('R51: sin nombres devuelve vacío, para que el aviso use el texto genérico', () => {
    expect(fileListPhrase([], 2)).toBe('');
  });
});
