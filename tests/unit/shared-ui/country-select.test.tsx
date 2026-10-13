import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { CountryCode } from 'libphonenumber-js';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { listCountryOptions } from '@/components/shared/country-options';
import { CountrySelect } from '@/components/shared/country-select';

import { setupUser } from '../../helpers/user-event';
import { resetViewport, setViewportWidth } from '../../helpers/viewport';

const DESKTOP = 1024;
const PHONE = 375;
const TEST_ID = 'pais';
const SEARCH_PLACEHOLDER = 'Busca por nombre o prefijo';

const scrolled: Element[] = [];
const scrollSpy = vi.fn(function (this: Element) {
  scrolled.push(this);
});
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeAll(() => {
  Element.prototype.scrollIntoView = scrollSpy;
});

afterAll(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

beforeEach(() => {
  scrollSpy.mockClear();
  scrolled.length = 0;
  setViewportWidth(DESKTOP);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

type HarnessProps = {
  readonly initial?: CountryCode | null;
  readonly onChange?: (value: CountryCode | null) => void;
  readonly disabled?: boolean;
  readonly error?: string;
};

/** Un consumidor que guarda el valor, como hará el formulario. */
function Harness({ initial = null, onChange = () => {}, disabled, error }: HarnessProps) {
  const [value, setValue] = useState<CountryCode | null>(initial);
  return (
    <CountrySelect
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      label="País"
      testId={TEST_ID}
      disabled={disabled}
      error={error}
    />
  );
}

const trigger = () => screen.getByTestId(TEST_ID);
const search = () => screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
const optionTexts = () => screen.getAllByRole('option').map((option) => option.textContent ?? '');

async function openList(user: ReturnType<typeof setupUser>) {
  await user.click(trigger());
  const listbox = await screen.findByRole('listbox');
  await waitFor(() => expect(search()).toHaveFocus());
  return listbox;
}

describe('CountrySelect', () => {
  it('R13 — una opción por país, con nombre y prefijo, en el orden de la lista', async () => {
    const user = setupUser();
    render(<Harness />);

    await openList(user);

    const countries = listCountryOptions();
    const texts = optionTexts().slice(1);
    expect(texts).toHaveLength(countries.length);
    expect(texts[0]).toBe(`${countries[0].name}+${countries[0].callingCode}`);
  });

  it('R14 — con el buscador vacío, «Sin país» es la primera opción', async () => {
    const user = setupUser();
    render(<Harness initial="CO" />);

    await openList(user);

    expect(optionTexts()[0]).toBe('Sin país');
  });

  it('R15 — el disparador muestra «Colombia (+57)» o «Sin país» atenuado, nombrado por la etiqueta y con su estado', async () => {
    const user = setupUser();
    const { unmount } = render(<Harness initial="CO" />);

    expect(trigger()).toHaveTextContent('Colombia (+57)');
    expect(trigger()).toHaveAccessibleName('País');
    expect(trigger()).toHaveAttribute('aria-labelledby', screen.getByText('País').id);
    expect(trigger()).toHaveAttribute('aria-haspopup');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');

    await openList(user);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    unmount();

    render(<Harness />);
    const placeholder = within(trigger()).getByText('Sin país');
    expect(placeholder).toHaveClass('text-muted-foreground');
  });

  it('R16 — un texto filtra por nombre sin tildes ni mayúsculas y quita «Sin país»', async () => {
    const user = setupUser();
    render(<Harness />);
    await openList(user);

    await user.type(search(), 'PERU');

    await waitFor(() => expect(optionTexts()).toEqual(['Perú+51']));
    expect(screen.queryByRole('option', { name: /Sin país/ })).not.toBeInTheDocument();
  });

  it('R17 — dígitos con o sin «+» filtran por prefijo, y «1» lista por separado CA y US', async () => {
    const user = setupUser();
    render(<Harness />);
    await openList(user);

    await user.type(search(), '+57');
    await waitFor(() => expect(optionTexts()).toEqual(['Colombia+57']));

    await user.clear(search());
    await user.type(search(), '1');
    await waitFor(() => expect(optionTexts()).toContain('Canadá+1'));
    expect(optionTexts()).toContain('Estados Unidos+1');
    expect(optionTexts().every((text) => text.includes('+1'))).toBe(true);
    expect(optionTexts()).not.toContain('Sin país');
  });

  it('R18 — sin coincidencias muestra «Ningún país coincide con «<texto>».»', async () => {
    const user = setupUser();
    render(<Harness />);
    await openList(user);

    await user.type(search(), 'zzzz');

    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
    expect(screen.getByText('Ningún país coincide con «zzzz».')).toBeInTheDocument();
  });

  it('R19 — elegir notifica el código o null, cierra la lista y vacía el buscador (clic y Enter)', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await openList(user);
    await user.type(search(), 'colom');
    await user.click(await screen.findByRole('option', { name: /Colombia/ }));

    expect(onChange).toHaveBeenLastCalledWith('CO');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(trigger()).toHaveTextContent('Colombia (+57)');

    await openList(user);
    expect(search()).toHaveValue('');
    await user.click(screen.getByRole('option', { name: 'Sin país' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

    await openList(user);
    await user.type(search(), 'peru');
    await waitFor(() => expect(optionTexts()).toEqual(['Perú+51']));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('PE');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('R20 — las flechas mueven el resaltado y Escape cierra sin notificar', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(<Harness initial="CO" onChange={onChange} />);
    await openList(user);

    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getAllByRole('option')[0]).toHaveAttribute('data-highlighted'));
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getAllByRole('option')[1]).toHaveAttribute('data-highlighted'));
    expect(screen.getAllByRole('option')[0]).not.toHaveAttribute('data-highlighted');
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(screen.getAllByRole('option')[0]).toHaveAttribute('data-highlighted'));

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent('Colombia (+57)');
  });

  it('R21 — al abrir con un país elegido, su opción está marcada y se desplaza a la vista', async () => {
    const user = setupUser();
    render(<Harness initial="CO" />);

    await openList(user);

    const colombia = screen.getByRole('option', { name: /Colombia/ });
    expect(colombia).toHaveAttribute('aria-selected', 'true');
    expect(colombia).toHaveAttribute('data-selected');
    expect(screen.getByRole('option', { name: 'Sin país' })).toHaveAttribute('aria-selected', 'false');
    await waitFor(() => expect(scrolled).toContain(colombia));
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('R22 — a 1024 px abre un popup anclado con el buscador arriba y opciones de 44 px', async () => {
    const user = setupUser();
    render(<Harness />);

    const listbox = await openList(user);

    const popup = listbox.closest('[data-slot="autocomplete-content"]');
    expect(popup).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
    expect(search().compareDocumentPosition(listbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(search()).toHaveClass('text-base', 'md:text-base');
    for (const option of screen.getAllByRole('option').slice(0, 5)) {
      expect(option).toHaveClass('min-h-11');
    }
  });

  it('R23 — a 375 px abre una hoja con título, «Cerrar», foco en un buscador de 48 px y opciones de 48 px; cerrar no notifica', async () => {
    setViewportWidth(PHONE);
    const user = setupUser();
    const onChange = vi.fn();
    render(<Harness initial="CO" onChange={onChange} />);

    await user.click(trigger());

    const sheet = await screen.findByRole('dialog', { name: 'País' });
    expect(sheet).toHaveAttribute('data-slot', 'sheet-content');
    const searchInput = within(sheet).getByPlaceholderText(SEARCH_PLACEHOLDER);
    await waitFor(() => expect(searchInput).toHaveFocus());
    expect(searchInput).toHaveClass('h-12', 'text-base');
    for (const option of within(sheet).getAllByRole('option').slice(0, 5)) {
      expect(option).toHaveClass('min-h-12');
    }

    await user.click(within(sheet).getByRole('button', { name: 'Cerrar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent('Colombia (+57)');
  });

  it('R23 — en la hoja, elegir notifica y cierra', async () => {
    setViewportWidth(PHONE);
    const user = setupUser();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(trigger());
    const sheet = await screen.findByRole('dialog', { name: 'País' });
    await user.click(within(sheet).getByRole('option', { name: /Colombia/ }));

    expect(onChange).toHaveBeenLastCalledWith('CO');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('R24 — deshabilitado no abre la lista ni notifica, en escritorio y en teléfono', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    const { unmount } = render(<Harness initial="MX" disabled onChange={onChange} />);

    expect(trigger()).toBeDisabled();
    await user.click(trigger());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    unmount();

    setViewportWidth(PHONE);
    render(<Harness initial="MX" disabled onChange={onChange} />);
    expect(trigger()).toBeDisabled();
    await user.click(trigger());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('R25 — con error, el disparador es inválido y el mensaje lo describe', () => {
    const message = 'Ese país no está en la lista. Elige uno de la lista.';
    render(<Harness error={message} />);

    expect(trigger()).toHaveAttribute('aria-invalid', 'true');
    const errorNode = screen.getByRole('alert');
    expect(errorNode).toHaveTextContent(message);
    expect(trigger()).toHaveAttribute('aria-describedby', errorNode.id);
    expect(trigger()).toHaveAccessibleDescription(message);
  });

  it('R25 — sin error, el disparador no es inválido ni tiene descripción', () => {
    render(<Harness />);

    expect(trigger()).not.toHaveAttribute('aria-invalid');
    expect(trigger()).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('R26 — se monta solo, sin providers ni servidor, y su fuente no importa lógica de servidor', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(<CountrySelect value={null} onChange={onChange} label="País del teléfono" />);

    const field = screen.getByRole('combobox', { name: 'País del teléfono' });
    await user.click(field);
    await user.click(await screen.findByRole('option', { name: /Colombia/ }));
    expect(onChange).toHaveBeenCalledWith('CO');

    const source = readFileSync(join(process.cwd(), 'components/shared/country-select.tsx'), 'utf8');
    expect(source).not.toMatch(/@\/lib\/modules/);
    expect(source).not.toMatch(/@\/lib\/composition/);
    expect(source).not.toMatch(/['"]use server['"]/);
  });
});
