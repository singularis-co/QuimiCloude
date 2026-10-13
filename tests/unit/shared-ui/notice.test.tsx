import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Notice, type NoticeTone } from '@/components/shared/notice';

function classesOf(element: Element): string[] {
  return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

const TOKENS: Readonly<Record<NoticeTone, string>> = {
  success: 'success',
  warning: 'warning',
  info: 'info',
  danger: 'destructive',
};

const TONOS = ['success', 'warning', 'info', 'danger'] as const;

afterEach(cleanup);

describe('Notice', () => {
  it.each(TONOS)('R15 — el tono %s toma fondo, texto y borde de los tokens del tema', (tone) => {
    render(<Notice tone={tone} testId="aviso">Cuerpo</Notice>);
    const token = TOKENS[tone];

    expect(classesOf(screen.getByTestId('aviso'))).toEqual(
      expect.arrayContaining([`bg-${token}-subtle`, `text-${token}-text`, `border-${token}-border`, 'border']),
    );
  });

  it('R15 — el fuente no escribe colores a mano', () => {
    const fuente = readFileSync(join(process.cwd(), 'components/shared/notice.tsx'), 'utf8');

    expect(fuente).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(fuente).not.toMatch(/oklch\(|rgba?\(|hsla?\(/);
  });

  it('R16 — cada tono pinta un icono propio, oculto a lectores', () => {
    const iconos = TONOS.map((tone) => {
      const { unmount } = render(<Notice tone={tone} testId="aviso">Cuerpo</Notice>);
      const icono = screen.getByTestId('aviso').querySelector('svg');
      expect(icono).not.toBeNull();
      expect(icono).toHaveAttribute('aria-hidden', 'true');
      const firma = icono?.innerHTML ?? '';
      unmount();
      return firma;
    });

    expect(new Set(iconos).size).toBe(TONOS.length);
  });

  it('R16 — pinta el título en peso 600 encima del cuerpo, y sin título solo el cuerpo', () => {
    render(
      <Notice tone="success" title="Contraseña establecida" testId="con-titulo">
        Ya puedes entrar con ella.
      </Notice>,
    );
    const titulo = screen.getByText('Contraseña establecida');
    expect(classesOf(titulo)).toContain('font-semibold');
    expect(screen.getByTestId('con-titulo')).toHaveTextContent('Contraseña establecidaYa puedes entrar con ella.');

    render(<Notice tone="warning" testId="sin-titulo">Lo está empacando otra persona.</Notice>);
    expect(screen.getByTestId('sin-titulo').querySelector('[data-slot="alert-title"]')).toBeNull();
    expect(screen.getByTestId('sin-titulo')).toHaveTextContent('Lo está empacando otra persona.');
  });

  it('R15 — compone el Alert de components/ui con el layout del tablero', () => {
    render(<Notice tone="info" testId="aviso">Cuerpo</Notice>);
    const clases = classesOf(screen.getByTestId('aviso'));

    expect(screen.getByTestId('aviso')).toHaveAttribute('data-slot', 'alert');
    expect(clases).toEqual(expect.arrayContaining(['flex', 'gap-3', 'px-3.5', 'py-3', 'rounded-[10px]']));
    expect(clases).not.toContain('grid');
    expect(clases).not.toContain('bg-card');
  });

  it('R17 — el tono danger se expone como alert', () => {
    render(<Notice tone="danger">Falló</Notice>);

    expect(screen.getByRole('alert')).toHaveTextContent('Falló');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(['success', 'warning', 'info'] as const)('R17 — el tono %s se expone como status', (tone) => {
    render(<Notice tone={tone}>Aviso</Notice>);

    expect(screen.getByRole('status')).toHaveTextContent('Aviso');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R18 — entra subiendo 10 px con fundido en la duración lenta y la curva de entrada', () => {
    render(<Notice tone="info" testId="aviso">Cuerpo</Notice>);

    expect(classesOf(screen.getByTestId('aviso'))).toEqual(
      expect.arrayContaining([
        'animate-in',
        'fade-in',
        'slide-in-from-bottom-[10px]',
        'duration-(--dur-slow)',
        'ease-(--ease-enter)',
      ]),
    );
  });

  it('QC-260 R18 — el id opcional va al contenedor del aviso para citarlo desde aria-describedby', () => {
    render(
      <>
        <Notice tone="danger" id="aviso-requisitos" testId="con-id">
          Falta una mayúscula.
        </Notice>
        <input aria-label="Contraseña nueva" aria-describedby="aviso-requisitos" />
      </>,
    );

    expect(screen.getByTestId('con-id')).toHaveAttribute('id', 'aviso-requisitos');
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAccessibleDescription('Falta una mayúscula.');
  });

  it('QC-260 R18 — sin id, el aviso no pinta atributo id', () => {
    render(<Notice tone="info" testId="sin-id">Cuerpo</Notice>);

    expect(screen.getByTestId('sin-id')).not.toHaveAttribute('id');
  });

  it('R18 — la duración lenta del tema son 300 ms', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

    expect(css).toMatch(/--dur-slow:\s*300ms/);
  });
});
