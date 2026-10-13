import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PASSWORD_FIELD_HIDE_LABEL,
  PASSWORD_FIELD_SHOW_LABEL,
  PasswordField,
} from '@/components/shared/password-field';

import { setupUser } from '../../helpers/user-event';

afterEach(cleanup);

function classesOf(element: Element): Set<string> {
  return new Set((element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
}

function renderField(props: Partial<Parameters<typeof PasswordField>[0]> = {}) {
  return render(
    <form aria-label="formulario de prueba">
      <PasswordField name="credential" label="Contraseña" testId="campo" {...props} />
    </form>,
  );
}

describe('PasswordField — ojo de mostrar y ocultar', () => {
  it('R19 — nace oculto, con el ojo sin pulsar, apuntando al campo y con su nombre accesible', () => {
    renderField();

    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');

    const ojo = screen.getByRole('button', { name: PASSWORD_FIELD_SHOW_LABEL });
    expect(ojo).toHaveAttribute('aria-pressed', 'false');
    expect(ojo).toHaveAttribute('aria-controls', input.id);
    expect(ojo).toHaveAttribute('type', 'button');
    expect(PASSWORD_FIELD_SHOW_LABEL).toBe('Mostrar la contraseña');
  });

  it('R20 — pulsar el ojo muestra el valor y pulsarlo otra vez lo vuelve a ocultar', async () => {
    const user = setupUser();
    renderField();

    const input = screen.getByLabelText('Contraseña');
    await user.click(screen.getByRole('button', { name: PASSWORD_FIELD_SHOW_LABEL }));

    expect(input).toHaveAttribute('type', 'text');
    const ojo = screen.getByRole('button', { name: PASSWORD_FIELD_HIDE_LABEL });
    expect(ojo).toHaveAttribute('aria-pressed', 'true');
    expect(PASSWORD_FIELD_HIDE_LABEL).toBe('Ocultar la contraseña');

    await user.click(ojo);
    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: PASSWORD_FIELD_SHOW_LABEL })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('R21 — usa los textos del consumidor para el ojo', async () => {
    const user = setupUser();
    renderField({ texts: { show: 'Mostrar el token', hide: 'Ocultar el token' } });

    const ojo = screen.getByRole('button', { name: 'Mostrar el token' });
    await user.click(ojo);
    expect(screen.getByRole('button', { name: 'Ocultar el token' })).toBe(ojo);
    expect(screen.queryByRole('button', { name: PASSWORD_FIELD_SHOW_LABEL })).toBeNull();
  });
});

describe('PasswordField — envío', () => {
  it('R22 — el valor viaja en el FormData bajo el name elegido, oculto o visible', async () => {
    const user = setupUser();
    renderField({ autoComplete: 'current-password' });

    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('autocomplete', 'current-password');
    await user.type(input, 'Secreto.1');

    const form = screen.getByRole('form', { name: 'formulario de prueba' }) as HTMLFormElement;
    expect(new FormData(form).get('credential')).toBe('Secreto.1');

    await user.click(screen.getByRole('button', { name: PASSWORD_FIELD_SHOW_LABEL }));
    expect(new FormData(form).get('credential')).toBe('Secreto.1');
  });

  it('R22 — pasa tal cual el autoComplete de una contraseña nueva', () => {
    renderField({ autoComplete: 'new-password' });
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'new-password');
  });
});

describe('PasswordField — medidas', () => {
  it('R23 — campo de 44 px con letra de 16 px también desde md, y ojo de 44 × 44', () => {
    renderField();

    const clasesCampo = classesOf(screen.getByLabelText('Contraseña'));
    expect(clasesCampo.has('h-11')).toBe(true);
    expect(clasesCampo.has('text-base')).toBe(true);
    expect(clasesCampo.has('md:text-base')).toBe(true);
    expect(clasesCampo.has('md:text-sm')).toBe(false);

    const clasesOjo = classesOf(screen.getByRole('button', { name: PASSWORD_FIELD_SHOW_LABEL }));
    expect(clasesOjo.has('size-11')).toBe(true);
    expect(clasesOjo.has('min-h-11')).toBe(true);
    expect(clasesOjo.has('min-w-11')).toBe(true);
  });
});

describe('PasswordField — variante de secreto', () => {
  it('R24 — pinta el valor en Plex Mono y, oculto, con más espacio entre los puntos', async () => {
    const user = setupUser();
    renderField({ variant: 'secret', label: 'Token de acceso', autoComplete: 'off' });

    const input = screen.getByLabelText('Token de acceso');
    const clases = classesOf(input);
    expect(clases.has('data-[variant=secret]:font-mono')).toBe(true);
    expect(clases.has('data-[variant=secret]:data-[masked=true]:tracking-[0.18em]')).toBe(true);
    expect(input).toHaveAttribute('data-variant', 'secret');
    expect(input).toHaveAttribute('data-masked', 'true');

    await user.click(screen.getByRole('button', { name: PASSWORD_FIELD_SHOW_LABEL }));
    expect(input).toHaveAttribute('data-masked', 'false');
  });

  it('R24 — sin la variante el campo no se marca como secreto', () => {
    renderField();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('data-variant', 'password');
  });

  it('R24 — la fuente mono del tema es Plex Mono', () => {
    const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
    expect(css).toMatch(/--font-mono:\s*var\(--font-plex-mono\)/);
  });
});

describe('PasswordField — error', () => {
  it('R26 — con error marca el campo inválido y enlaza el mensaje', () => {
    renderField({ error: 'La contraseña no es correcta.', describedBy: 'ayuda-externa' });

    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const mensaje = screen.getByText('La contraseña no es correcta.');
    const describedBy = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(describedBy).toContain(mensaje.id);
    expect(describedBy).toContain('ayuda-externa');
  });

  it('R26 — sin error no hay aria-invalid ni mensaje', () => {
    renderField();
    const input = screen.getByLabelText('Contraseña');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R26 — el campo de credencial anterior ya no existe en el código ni en el catálogo', () => {
    // El nombre se compone para que buscarlo en el repo no encuentre este test.
    const nombreAnterior = ['Credential', 'Field'].join('');
    const raiz = process.cwd();
    expect(() => readFileSync(join(raiz, 'components', 'shared', 'credential-field.tsx'))).toThrow();
    const catalogo = readFileSync(join(raiz, 'components', 'shared', 'CATALOGO.md'), 'utf8');
    expect(catalogo).not.toContain(nombreAnterior);
  });
});
