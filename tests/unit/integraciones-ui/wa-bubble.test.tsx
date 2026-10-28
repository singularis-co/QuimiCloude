// La burbuja de vista previa: cada {{clave}} se pinta con su valor o etiqueta, resaltada; lo que no se
// resuelve se ve entre corchetes; y lo que entra lo hace con fundido salvo con movimiento reducido.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  WA_BUBBLE_BODY_TESTID,
  WA_BUBBLE_BUTTON_TESTID,
  WA_BUBBLE_EMPTY_TESTID,
  WA_BUBBLE_FOOTER_TESTID,
  WA_BUBBLE_HEADER_TESTID,
  WA_BUBBLE_TESTID,
  WA_BUBBLE_TEXTS,
  WA_BUBBLE_TIME_TESTID,
  WA_BUBBLE_VARIABLE_TESTID,
  WaBubble,
  type WaBubbleVariable,
} from '@/app/(private)/integraciones/whatsapp/components/wa-bubble';

// Forma de las entradas del diccionario de pantalla: una constante con su ejemplo como vista
// previa y una propia con su valor.
const DICCIONARIO: readonly (WaBubbleVariable & { label: string; kind: 'constant' | 'own' })[] = [
  { key: 'nombre_del_cliente', label: 'Nombre del cliente', preview: 'Laura Gómez', kind: 'constant' },
  { key: 'numero_de_cuenta', label: 'Número de cuenta', preview: '2200-1234', kind: 'own' },
];

afterEach(() => {
  cleanup();
});

function variables(): string[] {
  return screen.getAllByTestId(WA_BUBBLE_VARIABLE_TESTID).map((el) => el.textContent ?? '');
}

describe('WaBubble', () => {
  it('R32: una variable propia se pinta con su valor, resaltada', () => {
    render(<WaBubble body="Paga en la cuenta {{numero_de_cuenta}}." variables={DICCIONARIO} time="09:41" />);

    expect(variables()).toEqual(['2200-1234']);
    expect(screen.getByTestId(WA_BUBBLE_BODY_TESTID).textContent).toBe('Paga en la cuenta 2200-1234.');
  });

  it('R32: una constante se pinta con su ejemplo, resaltada', () => {
    render(<WaBubble body="Hola {{nombre_del_cliente}}" variables={DICCIONARIO} time="09:41" />);

    expect(variables()).toEqual(['Laura Gómez']);
  });

  it('R32: una clave desconocida se pinta como [clave]', () => {
    render(<WaBubble body="Hola {{apodo}}" variables={DICCIONARIO} time="09:41" />);

    expect(variables()).toEqual(['[apodo]']);
  });

  it('R32: un {{n}} sin resolver fuera del panel de relacionar se lee como clave desconocida', () => {
    render(<WaBubble body="Hola {{1}}" variables={DICCIONARIO} time="09:41" />);

    expect(variables()).toEqual(['[1]']);
  });

  it('R32: con el mensaje vacío dice «Escribe el mensaje para verlo aquí.»', () => {
    render(<WaBubble body="   " variables={DICCIONARIO} time="09:41" />);

    expect(screen.getByTestId(WA_BUBBLE_EMPTY_TESTID).textContent).toBe('Escribe el mensaje para verlo aquí.');
    expect(screen.queryByTestId(WA_BUBBLE_BODY_TESTID)).toBeNull();
  });

  it('R32: pinta encabezado, pie en gris, hora y botones debajo', () => {
    render(
      <WaBubble
        header="Pedido de {{nombre_del_cliente}}"
        body="Tu pedido está listo."
        footer="QuimiCloude"
        buttons={[
          { type: 'QUICK_REPLY', text: 'Confirmar' },
          { type: 'URL', text: 'Ver pedido' },
          { type: 'PHONE_NUMBER', text: '' },
        ]}
        variables={DICCIONARIO}
        time="09:41"
      />,
    );

    expect(screen.getByTestId(WA_BUBBLE_HEADER_TESTID).textContent).toBe('Pedido de Laura Gómez');
    expect(screen.getByTestId(WA_BUBBLE_HEADER_TESTID).className).toContain('font-semibold');
    expect(screen.getByTestId(WA_BUBBLE_FOOTER_TESTID).textContent).toBe('QuimiCloude');
    expect(screen.getByTestId(WA_BUBBLE_TIME_TESTID).textContent).toBe('09:41');
    expect(screen.getAllByTestId(WA_BUBBLE_BUTTON_TESTID).map((b) => b.textContent)).toEqual([
      'Confirmar',
      'Ver pedido',
    ]);
  });

  it('R32: el nombre accesible lleva el texto resuelto del mensaje', () => {
    render(
      <WaBubble
        header="Aviso"
        body="Hola {{nombre_del_cliente}}"
        footer="QuimiCloude"
        variables={DICCIONARIO}
        time="09:41"
      />,
    );

    expect(screen.getByRole('img', { name: 'Vista previa del mensaje: Aviso. Hola Laura Gómez. QuimiCloude' }))
      .toBeTruthy();
  });

  it('R44: un hueco sin elegir se lee «[n sin relacionar]» y uno elegido, con su dato', () => {
    render(
      <WaBubble
        body="Hola {{1}}, tu cuenta es {{2}}"
        variables={[{ key: '1', preview: 'Laura Gómez' }]}
        unmappedSlots
        time="09:41"
      />,
    );

    expect(variables()).toEqual(['Laura Gómez', '[2 sin relacionar]']);
    expect(WA_BUBBLE_TEXTS.unmappedSlot('2')).toBe('[2 sin relacionar]');
  });

  it('R44: el encabezado usa su propia relación cuando se le da', () => {
    render(
      <WaBubble
        header="Pedido {{1}}"
        body="Hola {{1}}"
        variables={[{ key: '1', preview: 'Laura Gómez' }]}
        headerVariables={[]}
        unmappedSlots
        time="09:41"
      />,
    );

    expect(screen.getByTestId(WA_BUBBLE_HEADER_TESTID).textContent).toBe('Pedido [1 sin relacionar]');
    expect(screen.getByTestId(WA_BUBBLE_BODY_TESTID).textContent).toBe('Hola Laura Gómez');
  });

  it('R39: cada variable y cada botón entran con fundido de 240 ms y sin él con movimiento reducido', () => {
    render(
      <WaBubble
        body="Hola {{nombre_del_cliente}}"
        buttons={[{ type: 'QUICK_REPLY', text: 'Confirmar' }]}
        variables={DICCIONARIO}
        time="09:41"
      />,
    );

    const animados = [
      ...screen.getAllByTestId(WA_BUBBLE_VARIABLE_TESTID),
      ...screen.getAllByTestId(WA_BUBBLE_BUTTON_TESTID),
    ];
    for (const el of animados) {
      const clases = el.className.split(/\s+/);
      expect(clases).toEqual(
        expect.arrayContaining(['animate-in', 'fade-in', 'slide-in-from-bottom-1', 'duration-240', 'motion-reduce:animate-none']),
      );
    }
  });

  it('R39: al ganar una variable, las que ya estaban no se vuelven a montar', () => {
    const { rerender } = render(
      <WaBubble body="Hola {{nombre_del_cliente}}" variables={DICCIONARIO} time="09:41" />,
    );
    const antes = screen.getByTestId(WA_BUBBLE_VARIABLE_TESTID);

    rerender(
      <WaBubble body="Cuenta {{numero_de_cuenta}}. Hola {{nombre_del_cliente}}" variables={DICCIONARIO} time="09:41" />,
    );

    const despues = screen.getAllByTestId(WA_BUBBLE_VARIABLE_TESTID);
    expect(despues).toHaveLength(2);
    expect(despues[1]).toBe(antes);
    expect(screen.getByTestId(WA_BUBBLE_TESTID)).toBeTruthy();
  });
});
