// Test de fuente (QT-313 T14a): el adaptador de pedidos ya no copia el estado del pedido a su linea.
// Abrir, finalizar, empaque y acondicionamiento escriben la linea y derivan el pedido; ninguna
// escritura lleva estado, motivo, `finished_at`, quien empaca o quien acondiciona de `orders` a
// `order_lines`.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ADAPTER = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts',
);

/** El fuente sin comentarios: un comentario que nombre la copia no es una copia. */
function sourceWithoutComments(): string {
  return readFileSync(ADAPTER, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '');
}

/** Cada sentencia `UPDATE "order_lines"` del adaptador, hasta el cierre de su plantilla. */
function lineUpdates(source: string): readonly string[] {
  return [...source.matchAll(/UPDATE "order_lines"[\s\S]*?`/gu)].map((match) => match[0]);
}

describe('QT-313 T14a — ya no queda copia de estado pedido -> linea', () => {
  it('QT-313 R31, R32: no existe la copia a la unica linea ni quien la decidia', () => {
    const source = sourceWithoutComments();

    expect(source).not.toMatch(/copyOrderStateToOnlyLine|hasOnlyLineToCopy/u);
  });

  it('QT-313 R31, R32: ningun UPDATE de order_lines lee de orders', () => {
    const updates = lineUpdates(sourceWithoutComments());

    expect(updates.length).toBeGreaterThan(0);
    for (const update of updates) {
      expect(update).not.toMatch(/FROM\s+"orders"/u);
      expect(update).not.toMatch(/=\s*o\."(status|cancellation_reason|finished_at|packed_by|conditioned_by)"/u);
    }
  });

  it('QT-313 R31: las escrituras de empaque y acondicionamiento mueven la linea, no el pedido', () => {
    const orderUpdates = [...sourceWithoutComments().matchAll(/\.order\.updateMany\(\{[\s\S]*?\}\);/gu)].map((match) => match[0]);

    expect(orderUpdates.length).toBeGreaterThan(0);
    for (const update of orderUpdates) {
      expect(update).not.toMatch(/status:\s*'(EN_EMPAQUE|POR_ACONDICIONAR|EN_ACONDICIONAMIENTO|TERMINADO)'/u);
      expect(update).not.toMatch(/(packedBy|conditionedBy|finishedAt)\s*:/u);
    }
  });
});
