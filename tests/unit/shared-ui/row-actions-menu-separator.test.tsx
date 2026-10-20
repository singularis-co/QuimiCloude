// `RowActionsMenu` con `separatorBefore`: línea divisoria delante del ítem que la pide, en el
// desplegable y en el diálogo centrado; nunca delante del primer ítem, y sin la prop no hay ninguna.

import { cleanup, render, screen, within } from '@testing-library/react';
import { EyeIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RowActionsMenu, type RowActionMenuItem } from '@/components/shared/row-actions-menu';

import { setupUser } from '../../helpers/user-event';

const TRIGGER_TESTID = 'pedido-acciones';
const TRIGGER_LABEL = 'Acciones del pedido 2026-0000008';

type Separadores = { readonly ver?: boolean; readonly eliminar?: boolean };

function items(separadores: Separadores = {}): RowActionMenuItem[] {
  return [
    {
      key: 'view',
      label: 'Ver',
      icon: EyeIcon,
      onSelect: vi.fn(),
      testId: 'item-ver',
      separatorBefore: separadores.ver,
    },
    { key: 'edit', label: 'Editar', icon: PencilIcon, href: '/pedidos/abc/editar', testId: 'item-editar' },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: Trash2Icon,
      onSelect: vi.fn(),
      destructive: true,
      testId: 'item-eliminar',
      separatorBefore: separadores.eliminar,
    },
  ];
}

async function abrir(presentation: 'dropdown' | 'centered', separadores?: Separadores) {
  const user = setupUser();
  render(
    <RowActionsMenu
      items={items(separadores)}
      triggerLabel={TRIGGER_LABEL}
      triggerTestId={TRIGGER_TESTID}
      presentation={presentation}
    />,
  );
  await user.click(screen.getByTestId(TRIGGER_TESTID));
  return presentation === 'dropdown' ? screen.findByRole('menu') : screen.findByRole('dialog');
}

/** Separadores del contenedor, también los que Base UI marca como decorativos. */
function separadores(contenedor: HTMLElement): HTMLElement[] {
  return within(contenedor).queryAllByRole('separator', { hidden: true });
}

afterEach(cleanup);

describe.each(['dropdown', 'centered'] as const)('separador en la presentación %s', (presentation) => {
  it('R14: con la prop pinta un separador justo antes del ítem', async () => {
    const contenedor = await abrir(presentation, { eliminar: true });

    const lista = separadores(contenedor);
    expect(lista).toHaveLength(1);
    const eliminar = within(contenedor).getByTestId('item-eliminar');
    const editar = within(contenedor).getByTestId('item-editar');
    expect(lista[0].nextElementSibling).toBe(eliminar);
    expect(editar.compareDocumentPosition(lista[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R14: en el primer ítem no pinta separador', async () => {
    const contenedor = await abrir(presentation, { ver: true });

    expect(separadores(contenedor)).toHaveLength(0);
  });

  it('R14: sin la prop no hay ningún separador', async () => {
    const contenedor = await abrir(presentation);

    expect(separadores(contenedor)).toHaveLength(0);
  });
});
