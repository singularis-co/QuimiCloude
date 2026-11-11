// `RowActionsMenu` con `groupLabel`: rótulo no interactivo delante del ítem que lo pide, en el
// desplegable y en el diálogo centrado; abre un grupo con nombre y combina con `separatorBefore`.

import { cleanup, render, screen, within } from '@testing-library/react';
import { BanIcon, EyeIcon, PencilIcon, TruckIcon } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RowActionsMenu, type RowActionMenuItem } from '@/components/shared/row-actions-menu';

import { setupUser } from '../../helpers/user-event';

const TRIGGER_TESTID = 'pedido-acciones';
const TRIGGER_LABEL = 'Acciones del pedido 2026-0000008';

function items(): RowActionMenuItem[] {
  return [
    { key: 'view', label: 'Ver detalle', icon: EyeIcon, onSelect: vi.fn(), testId: 'item-ver' },
    { key: 'edit', label: 'Editar', icon: PencilIcon, onSelect: vi.fn(), testId: 'item-editar' },
    {
      key: 'deliver',
      label: 'Entregar…',
      icon: TruckIcon,
      onSelect: vi.fn(),
      testId: 'item-entregar',
      separatorBefore: true,
      groupLabel: 'Por receta',
    },
    {
      key: 'cancel-line',
      label: 'Cancelar receta…',
      icon: BanIcon,
      onSelect: vi.fn(),
      destructive: true,
      testId: 'item-cancelar-receta',
    },
    {
      key: 'cancel',
      label: 'Cancelar pedido',
      icon: BanIcon,
      onSelect: vi.fn(),
      destructive: true,
      testId: 'item-cancelar',
      groupLabel: 'Pedido entero',
    },
  ];
}

async function abrir(presentation: 'dropdown' | 'centered') {
  const user = setupUser();
  render(
    <RowActionsMenu
      items={items()}
      triggerLabel={TRIGGER_LABEL}
      triggerTestId={TRIGGER_TESTID}
      presentation={presentation}
    />,
  );
  await user.click(screen.getByTestId(TRIGGER_TESTID));
  const contenedor =
    presentation === 'dropdown' ? await screen.findByRole('menu') : await screen.findByRole('dialog');
  return { user, contenedor };
}

function sigue(antes: Node, despues: Node): boolean {
  return (antes.compareDocumentPosition(despues) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

afterEach(cleanup);

describe.each(['dropdown', 'centered'] as const)('rótulo de grupo en la presentación %s', (presentation) => {
  it('R25: el rótulo sale justo antes de su ítem y nombra el grupo', async () => {
    const { contenedor } = await abrir(presentation);

    const porReceta = within(contenedor).getByText('Por receta');
    const entregar = within(contenedor).getByTestId('item-entregar');
    expect(porReceta.nextElementSibling).toBe(entregar);

    const grupo = within(contenedor).getByRole('group', { name: 'Por receta' });
    expect(within(grupo).getByTestId('item-entregar')).toBe(entregar);
    expect(within(grupo).getByTestId('item-cancelar-receta')).toBeInTheDocument();
    expect(within(grupo).queryByTestId('item-cancelar')).not.toBeInTheDocument();

    const enteroGrupo = within(contenedor).getByRole('group', { name: 'Pedido entero' });
    expect(within(enteroGrupo).getByTestId('item-cancelar')).toBeInTheDocument();
  });

  it('R25: los grupos salen en orden y las acciones sin rótulo quedan fuera de ellos', async () => {
    const { contenedor } = await abrir(presentation);

    const grupos = within(contenedor).getAllByRole('group');
    expect(grupos).toHaveLength(2);
    expect(sigue(grupos[0], grupos[1])).toBe(true);
    for (const grupo of grupos) {
      expect(within(grupo).queryByTestId('item-ver')).not.toBeInTheDocument();
    }
    expect(sigue(within(contenedor).getByTestId('item-editar'), grupos[0])).toBe(true);
  });

  it('R25: el rótulo no es enfocable ni es una acción', async () => {
    const { contenedor } = await abrir(presentation);

    for (const texto of ['Por receta', 'Pedido entero']) {
      const rotulo = within(contenedor).getByText(texto);
      expect(rotulo).not.toHaveAttribute('tabindex');
      expect(rotulo.tagName).not.toBe('BUTTON');
      expect(rotulo).not.toHaveAttribute('role', 'menuitem');
      rotulo.focus();
      expect(rotulo).not.toHaveFocus();
    }
    const nombres = within(contenedor)
      .queryAllByRole(presentation === 'dropdown' ? 'menuitem' : 'button')
      .map((el) => el.textContent);
    expect(nombres).not.toContain('Por receta');
    expect(nombres).not.toContain('Pedido entero');
  });

  it('R25: combina con `separatorBefore`: línea, rótulo e ítem, en ese orden', async () => {
    const { contenedor } = await abrir(presentation);

    const lineas = within(contenedor).queryAllByRole('separator', { hidden: true });
    expect(lineas).toHaveLength(1);
    const porReceta = within(contenedor).getByText('Por receta');
    const editar = within(contenedor).getByTestId('item-editar');
    expect(sigue(editar, lineas[0])).toBe(true);
    expect(sigue(lineas[0], porReceta)).toBe(true);
    expect(lineas[0].nextElementSibling).toBe(within(contenedor).getByRole('group', { name: 'Por receta' }));
  });
});
