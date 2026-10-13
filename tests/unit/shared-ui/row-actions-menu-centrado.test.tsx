// `RowActionsMenu` con `presentation="centered"`: botón «Acciones» que abre los mismos ítems en un
// diálogo centrado. Y el desplegable de siempre, que se abre hacia abajo y voltea si no cabe.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RowActionsMenu, type RowActionMenuItem } from '@/components/shared/row-actions-menu';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const TRIGGER_TESTID = 'pedido-acciones';
const TRIGGER_LABEL = 'Acciones del pedido 2026-0000008';
const EDIT_HREF = '/pedidos/abc/editar';

function items(onDelete: () => void): RowActionMenuItem[] {
  return [
    { key: 'edit', label: 'Editar', icon: PencilIcon, href: EDIT_HREF, testId: 'item-editar' },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: Trash2Icon,
      onSelect: onDelete,
      destructive: true,
      testId: 'item-eliminar',
    },
  ];
}

function renderCentrado(onDelete: () => void = vi.fn(), extra: { title?: string } = {}) {
  render(
    <RowActionsMenu
      items={items(onDelete)}
      triggerLabel={TRIGGER_LABEL}
      triggerTestId={TRIGGER_TESTID}
      presentation="centered"
      texts={{ actions: 'Acciones', close: 'Cerrar' }}
      {...extra}
    />,
  );
  return screen.getByTestId(TRIGGER_TESTID);
}

afterEach(cleanup);

describe('botón «Acciones» de la presentación centrada', () => {
  it('R35: tiene el texto visible, el nombre accesible de la fila y la talla táctil de 44 px', () => {
    const trigger = renderCentrado();

    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveTextContent('Acciones');
    expect(trigger).toHaveAccessibleName(TRIGGER_LABEL);
    expect(trigger.className).toContain('min-h-11');
  });

  it('R35: sin textos propios dice «Acciones»', () => {
    render(
      <RowActionsMenu items={items(vi.fn())} triggerLabel={TRIGGER_LABEL} triggerTestId={TRIGGER_TESTID} presentation="centered" />,
    );
    expect(screen.getByTestId(TRIGGER_TESTID)).toHaveTextContent('Acciones');
  });

  it('R35: sin ítems no pinta nada', () => {
    const { container } = render(
      <RowActionsMenu items={[]} triggerLabel={TRIGGER_LABEL} presentation="centered" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('diálogo centrado', () => {
  it('R36: se abre como diálogo modal con el nombre de la fila como título y un botón Cerrar', async () => {
    const user = setupUser();
    const trigger = renderCentrado();

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');

    expect(dialog).toHaveAccessibleName(TRIGGER_LABEL);
    expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('R36: el título propio gana sobre el nombre del disparador', async () => {
    const user = setupUser();
    const trigger = renderCentrado(vi.fn(), { title: 'Pedido 2026-0000008' });

    await user.click(trigger);
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Pedido 2026-0000008');
  });

  it('R36: lleva los mismos ítems, en orden, con al menos 48 px de alto', async () => {
    const user = setupUser();
    const trigger = renderCentrado();

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');

    const editar = within(dialog).getByTestId('item-editar');
    const eliminar = within(dialog).getByTestId('item-eliminar');
    expect(editar).toHaveAccessibleName('Editar');
    expect(eliminar).toHaveAccessibleName('Eliminar');
    expect(editar.compareDocumentPosition(eliminar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(editar.className).toContain('min-h-12');
    expect(eliminar.className).toContain('min-h-12');
    expect(eliminar.className).toContain('text-destructive');
  });

  it('R37: el ítem enlace es un <a> con su href', async () => {
    const user = setupUser();
    const trigger = renderCentrado();

    await user.click(trigger);
    const editar = within(await screen.findByRole('dialog')).getByTestId('item-editar');

    expect(editar.tagName).toBe('A');
    expect(editar).toHaveAttribute('href', EDIT_HREF);
  });

  it('R37: elegir un ítem ejecuta su acción y cierra el diálogo', async () => {
    const user = setupUser();
    const onDelete = vi.fn();
    const trigger = renderCentrado(onDelete);

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await user.click(await esperarInteractiva(within(dialog).getByTestId('item-eliminar')));

    expect(onDelete).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('R37: «Cerrar» cierra sin ejecutar nada y devuelve el foco a «Acciones»', async () => {
    const user = setupUser();
    const onDelete = vi.fn();
    const trigger = renderCentrado(onDelete);

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await user.click(await esperarInteractiva(within(dialog).getByRole('button', { name: 'Cerrar' })));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('R37: Escape cierra sin ejecutar nada y devuelve el foco a «Acciones»', async () => {
    const user = setupUser();
    const onDelete = vi.fn();
    const trigger = renderCentrado(onDelete);

    await user.click(trigger);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('R37: pulsar el velo cierra sin ejecutar nada', async () => {
    const user = setupUser();
    const onDelete = vi.fn();
    const trigger = renderCentrado(onDelete);

    await user.click(trigger);
    await screen.findByRole('dialog');
    const velo = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
    expect(velo).not.toBeNull();
    await user.click(velo as HTMLElement);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('desplegable de siempre', () => {
  it('R33: el menú se coloca debajo del disparador (Base UI lo voltea si no cabe)', async () => {
    const user = setupUser();
    render(<RowActionsMenu items={items(vi.fn())} triggerLabel={TRIGGER_LABEL} triggerTestId={TRIGGER_TESTID} />);

    await user.click(screen.getByTestId(TRIGGER_TESTID));
    const menu = await screen.findByRole('menu');

    await waitFor(() => expect(menu).toHaveAttribute('data-side', 'bottom'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
