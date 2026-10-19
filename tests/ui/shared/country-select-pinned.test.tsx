import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { CountryCode } from 'libphonenumber-js';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { listCountryOptions } from '@/components/shared/country-options';
import { CountrySelect, type CountrySelectProps } from '@/components/shared/country-select';

import { setupUser } from '../../helpers/user-event';
import { resetViewport, setViewportWidth } from '../../helpers/viewport';

const DESKTOP = 1024;
const PHONE = 390;
const BREAKPOINT = 640;
const TEST_ID = 'telefono-pais';
const LABEL = 'País del teléfono';
const PINNED = { code: 'CO', label: 'País de la empresa' } as const;
const SEARCH_PLACEHOLDER = 'Busca por nombre o prefijo';

const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

beforeEach(() => {
  setViewportWidth(DESKTOP);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

type HarnessProps = Partial<
  Pick<CountrySelectProps, 'pinned' | 'hideLabel' | 'compactOnMobile'>
> & {
  readonly initial?: CountryCode | null;
  readonly onChange?: (value: CountryCode | null) => void;
};

function Harness({ initial = null, onChange = () => {}, ...extension }: HarnessProps) {
  const [value, setValue] = useState<CountryCode | null>(initial);
  return (
    <CountrySelect
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      label={LABEL}
      testId={TEST_ID}
      {...extension}
    />
  );
}

const trigger = () => screen.getByTestId(TEST_ID);
const search = () => screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
const separatorIn = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="autocomplete-separator"]');
const optionTexts = () => screen.getAllByRole('option').map((option) => option.textContent ?? '');

async function openList(user: ReturnType<typeof setupUser>) {
  await user.click(trigger());
  const listbox = await screen.findByRole('listbox');
  await waitFor(() => expect(search()).toHaveFocus());
  return listbox;
}

describe('CountrySelect · pinned', () => {
  it('R5 — con el buscador vacío, el grupo «País de la empresa» va arriba, luego el separador y «Todos» con «Sin país» primero', async () => {
    const user = setupUser();
    render(<Harness initial="CO" pinned={PINNED} />);

    const listbox = await openList(user);

    const [pinnedGroup, allGroup] = within(listbox).getAllByRole('group');
    expect(pinnedGroup).toHaveAccessibleName('País de la empresa');
    expect(pinnedGroup).toHaveTextContent(/^País de la empresa/);
    expect(within(pinnedGroup).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Colombia+57',
    ]);

    const separator = separatorIn(listbox);
    if (separator === null) throw new Error('falta el separador');
    expect(separator).toHaveAttribute('role', 'presentation');
    expect(
      pinnedGroup.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      separator.compareDocumentPosition(allGroup) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(allGroup).toHaveAccessibleName('Todos los países');
    expect(allGroup).toHaveTextContent(/^Todos/);
    const allOptions = within(allGroup).getAllByRole('option');
    expect(allOptions[0]).toHaveTextContent('Sin país');
    expect(allOptions).toHaveLength(listCountryOptions().length + 1);
    expect(optionTexts()[0]).toBe('Colombia+57');
  });

  it('R5 — el país fijado se repite en su sitio alfabético de «Todos» y solo se marca el de arriba', async () => {
    const user = setupUser();
    render(<Harness initial="CO" pinned={PINNED} />);

    const listbox = await openList(user);

    const allGroup = within(listbox).getAllByRole('group')[1];
    const countries = listCountryOptions();
    const position = countries.findIndex((option) => option.code === 'CO');
    const repeated = within(allGroup).getAllByRole('option')[position + 1];
    expect(repeated).toHaveTextContent('Colombia+57');
    expect(repeated).toHaveAttribute('aria-selected', 'false');

    const pinnedOption = screen.getByTestId(`${TEST_ID}-option-pinned-CO`);
    expect(pinnedOption).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId(`${TEST_ID}-option-CO`)).toBe(repeated);
  });

  it('R5 — elegir el país fijado o su repetición notifica el mismo código', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(<Harness pinned={PINNED} onChange={onChange} />);

    await openList(user);
    await user.click(screen.getByTestId(`${TEST_ID}-option-pinned-CO`));
    expect(onChange).toHaveBeenLastCalledWith('CO');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

    await openList(user);
    await user.click(screen.getByRole('option', { name: 'Sin país' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

    await openList(user);
    await user.click(screen.getByTestId(`${TEST_ID}-option-CO`));
    expect(onChange).toHaveBeenLastCalledWith('CO');
  });

  it('R5 — con texto en el buscador queda una sola lista filtrada, sin rótulos ni separador', async () => {
    const user = setupUser();
    render(<Harness initial="CO" pinned={PINNED} />);
    const listbox = await openList(user);

    await user.type(search(), 'colom');

    await waitFor(() => expect(optionTexts()).toEqual(['Colombia+57']));
    expect(within(listbox).queryByRole('group')).not.toBeInTheDocument();
    expect(separatorIn(listbox)).toBeNull();
    expect(screen.queryByText('País de la empresa')).not.toBeInTheDocument();
    expect(screen.queryByText('Todos')).not.toBeInTheDocument();

    await user.clear(search());
    await waitFor(() => expect(within(listbox).getAllByRole('group')).toHaveLength(2));
  });

  it('R5 — sin `pinned`, la lista de siempre: «Sin país» primero, sin grupos ni separador', async () => {
    const user = setupUser();
    render(<Harness initial="CO" />);

    const listbox = await openList(user);

    expect(within(listbox).queryByRole('group')).not.toBeInTheDocument();
    expect(separatorIn(listbox)).toBeNull();
    const texts = optionTexts();
    expect(texts[0]).toBe('Sin país');
    expect(texts).toHaveLength(listCountryOptions().length + 1);
    expect(screen.getAllByRole('option', { name: /Colombia/ })).toHaveLength(1);
  });

  it('R5 — en la hoja de teléfono también va el grupo fijado arriba', async () => {
    setViewportWidth(PHONE);
    const user = setupUser();
    render(<Harness initial="CO" pinned={PINNED} />);

    await user.click(trigger());
    const sheet = await screen.findByRole('dialog', { name: LABEL });

    const listbox = within(sheet).getByRole('listbox');
    const [pinnedGroup, allGroup] = within(listbox).getAllByRole('group');
    expect(pinnedGroup).toHaveAccessibleName('País de la empresa');
    expect(allGroup).toHaveAccessibleName('Todos los países');
    expect(separatorIn(listbox)).not.toBeNull();
  });
});

describe('CountrySelect · hideLabel', () => {
  it('R1 — con `hideLabel`, la etiqueta es solo para lectores y el disparador conserva su nombre', () => {
    render(<Harness initial="CO" hideLabel />);

    const label = screen.getByText(LABEL);
    expect(label).toHaveClass('sr-only');
    expect(trigger()).toHaveAccessibleName(LABEL);
    expect(trigger()).toHaveAttribute('aria-labelledby', label.id);
  });

  it('R33 — con `hideLabel`, la hoja de teléfono sigue titulada con la etiqueta', async () => {
    setViewportWidth(PHONE);
    const user = setupUser();
    render(<Harness hideLabel />);

    await user.click(trigger());

    const sheet = await screen.findByRole('dialog', { name: LABEL });
    expect(within(sheet).getByText(LABEL)).not.toHaveClass('sr-only');
  });

  it('R1 — sin `hideLabel`, la etiqueta se ve', () => {
    render(<Harness />);

    expect(screen.getByText(LABEL)).not.toHaveClass('sr-only');
  });
});

describe('CountrySelect · compactOnMobile', () => {
  it('R33 — a 640 px o menos el disparador dice «CO +57» en mono y su aria-label lleva el nombre', () => {
    setViewportWidth(BREAKPOINT);
    render(<Harness initial="CO" compactOnMobile hideLabel />);

    expect(trigger()).toHaveTextContent(/^CO \+57$/);
    expect(within(trigger()).getByText('CO +57')).toHaveClass('font-mono');
    expect(trigger()).toHaveAccessibleName(`${LABEL}: Colombia`);
    expect(trigger()).not.toHaveAttribute('aria-labelledby');
  });

  it('R33 — compacto y sin país, el disparador dice «Sin país» y lo nombra', () => {
    setViewportWidth(PHONE);
    render(<Harness compactOnMobile />);

    expect(trigger()).toHaveTextContent('Sin país');
    expect(trigger()).toHaveAccessibleName(`${LABEL}: Sin país`);
  });

  it('R33 — compacto, elegir otro país actualiza el texto y el nombre del disparador', async () => {
    setViewportWidth(PHONE);
    const user = setupUser();
    render(<Harness initial="CO" compactOnMobile />);

    await user.click(trigger());
    const sheet = await screen.findByRole('dialog', { name: LABEL });
    await user.click(within(sheet).getByRole('option', { name: /Perú/ }));

    await waitFor(() => expect(trigger()).toHaveTextContent(/^PE \+51$/));
    expect(trigger()).toHaveAccessibleName(`${LABEL}: Perú`);
  });

  it('R33 — por encima de 640 px, `compactOnMobile` no cambia el disparador', () => {
    render(<Harness initial="CO" compactOnMobile />);

    expect(trigger()).toHaveTextContent('Colombia (+57)');
    expect(trigger()).toHaveAccessibleName(LABEL);
    expect(trigger()).not.toHaveAttribute('aria-label');
  });

  it('R33 — sin `compactOnMobile`, a 640 px o menos el disparador dice el nombre completo', () => {
    setViewportWidth(PHONE);
    render(<Harness initial="CO" />);

    expect(trigger()).toHaveTextContent('Colombia (+57)');
    expect(trigger()).toHaveAccessibleName(LABEL);
  });
});
