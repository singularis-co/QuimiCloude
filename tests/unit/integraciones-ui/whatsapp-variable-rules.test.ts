import { describe, expect, it } from 'vitest';

import {
  VARIABLE_RULES_TEXTS,
  keyFromLabel,
  keyProblemOf,
  valueFormatWarning,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variable-rules';
import { WHATSAPP_VARIABLE_KEY_LIMITS, WHATSAPP_VARIABLE_KEY_PATTERN } from '@/lib/modules/integraciones';

describe('keyFromLabel', () => {
  it('R51: quita tildes y mayúsculas y cambia los espacios por _', () => {
    expect(keyFromLabel('Número de cuenta')).toBe('numero_de_cuenta');
  });

  it('R51: la ñ pierde la virgulilla', () => {
    expect(keyFromLabel('ñandú')).toBe('nandu');
  });

  it('R51: cada tramo de signos pasa a un solo _', () => {
    expect(keyFromLabel('Horario (L-V) / sábados')).toBe('horario_l_v_sabados');
  });

  it('R51: quita lo que va antes de la primera letra', () => {
    expect(keyFromLabel('2º horario')).toBe('horario');
    expect(keyFromLabel('  -- IBAN')).toBe('iban');
  });

  it('R51: no deja _ al final', () => {
    expect(keyFromLabel('Cuenta!!!')).toBe('cuenta');
  });

  it('R51: corta a 40 caracteres sin dejar _ al final', () => {
    const label = `${'a'.repeat(39)} b`;
    const key = keyFromLabel(label);
    expect(key).toBe('a'.repeat(39));
    expect([...keyFromLabel('x'.repeat(80))].length).toBe(WHATSAPP_VARIABLE_KEY_LIMITS.keyMaxLength);
  });

  it('R51: la clave siempre casa con el patrón del dominio o queda vacía', () => {
    const labels = ['Número de cuenta', '2º horario', 'ñandú', 'Ünïcödé Çà', 'a'.repeat(60), 'Día 1 y 2', '_x_', '€uro'];
    for (const label of labels) {
      const key = keyFromLabel(label);
      expect(key === '' || WHATSAPP_VARIABLE_KEY_PATTERN.test(key), `${label} → ${key}`).toBe(true);
    }
  });
});

describe('keyProblemOf', () => {
  it('R52: una etiqueta sin letras deja la clave vacía y no se puede guardar', () => {
    const key = keyFromLabel('123');
    expect(key).toBe('');
    expect(keyProblemOf(key, [])).toBe(VARIABLE_RULES_TEXTS.keyEmpty);
  });

  it('R52: la clave de otra variable propia está repetida', () => {
    expect(keyProblemOf('numero_de_cuenta', ['numero_de_cuenta'])).toBe(
      VARIABLE_RULES_TEXTS.keyTaken('numero_de_cuenta'),
    );
  });

  it('R52: la clave de una constante del sistema está repetida', () => {
    expect(keyProblemOf(keyFromLabel('Nombre del cliente'), [])).toBe(
      VARIABLE_RULES_TEXTS.keyTaken('nombre_del_cliente'),
    );
  });

  it('R52: una clave nueva no tiene problema', () => {
    expect(keyProblemOf('numero_de_cuenta', ['horario'])).toBeNull();
  });
});

describe('valueFormatWarning', () => {
  it('R57: avisa con espacios al principio o al final', () => {
    expect(valueFormatWarning('abc', ' abc')).toBe(true);
    expect(valueFormatWarning('abc', 'abc ')).toBe(true);
  });

  it('R57: avisa con dos espacios seguidos', () => {
    expect(valueFormatWarning('abc', 'a  bc')).toBe(true);
  });

  it('R57: avisa si antes eran solo dígitos y ahora no', () => {
    expect(valueFormatWarning('123456', '12-34-56')).toBe(true);
  });

  it('R57: sin aviso si nada de eso pasa', () => {
    expect(valueFormatWarning('123456', '654321')).toBe(false);
    expect(valueFormatWarning('Banco A', 'Banco B')).toBe(false);
    expect(valueFormatWarning('Banco A', '123')).toBe(false);
  });
});
