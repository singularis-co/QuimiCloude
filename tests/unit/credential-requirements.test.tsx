// QC-21 — T4: `CredentialRequirements` renderizado directo con props.
//
// Cubre R1, R2 (parte), R3, R4, R5, R15 (enmendada por QC-273), R16, R20, R21.
//
// El test ITERA `CREDENTIAL_RULES` importado del barrel `@/lib/modules/identity`: si QC-19
// anade, quita o reordena un codigo, este archivo lo exige sin editarse (R3). El estado
// mostrado de las seis se compara SIEMPRE contra `evaluateCredentialRules`, nunca contra un
// estado escrito a mano (R2, R4). Los asserts de copy van contra `CREDENTIAL_RULE_LABELS`,
// nunca contra un literal (R15).

import { render, screen } from '@testing-library/react';

import {
  CredentialRequirements,
  LIVE_CREDENTIAL_RULES,
  type CredentialRuleState,
} from '@/components/shared/credential-requirements';
import { CREDENTIAL_RULE_LABELS } from '@/components/shared/credential-rule-labels';
import { CREDENTIAL_RULES, evaluateCredentialRules, type CredentialRule } from '@/lib/modules/identity';

/** Todas las reglas salvo la de filtradas: las seis comprobables en vivo, en orden del catalogo. */
const LIVE_RULES = CREDENTIAL_RULES.filter((rule) => rule !== 'breached');

function stateFor(rule: CredentialRule, candidate: string): CredentialRuleState {
  return evaluateCredentialRules(candidate).unmet.includes(rule) ? 'unmet' : 'met';
}

describe('CredentialRequirements — catalogo y orden (R1, R3)', () => {
  it('renderiza una entrada por cada regla en vivo de CREDENTIAL_RULES y en su orden', () => {
    const { container } = render(<CredentialRequirements candidate="" />);
    const items = container.querySelectorAll('li[data-rule]');

    expect(items).toHaveLength(LIVE_RULES.length);
    for (const [index, rule] of LIVE_RULES.entries()) {
      expect(items[index]?.getAttribute('data-rule')).toBe(rule);
    }
  });

  it('la lista sale del catalogo importado, no de una copia local', () => {
    // No hay ningun codigo en pantalla que no venga de `CREDENTIAL_RULES`, y no falta
    // ninguno de los que el catalogo declara: si QC-19 lo modifica, este assert lo exige.
    const { container } = render(<CredentialRequirements candidate="" />);
    const renderedRules = [...container.querySelectorAll('li[data-rule]')].map((li) =>
      li.getAttribute('data-rule'),
    );
    expect(renderedRules).toEqual([...LIVE_RULES]);
    expect([...LIVE_CREDENTIAL_RULES]).toEqual(LIVE_RULES);
  });
});

describe('CredentialRequirements — marcado en vivo de las seis (R2, R4, R5)', () => {
  it('con la candidata vacia la lista es visible sin interaccion y muestra cinco incumplidas con max_length cumplida', () => {
    // R5 fue corregido por decision del humano el 2026-09-02: ya no dice "las seis"
    // incumplidas, dice literalmente que con la candidata vacia hay cinco incumplidas y
    // `max_length` cumplida (una cadena vacia no excede el maximo). Este test afirma
    // exactamente eso.
    //
    // Enumeracion literal deliberada (m-5): a diferencia de los tests espejo del describe
    // siguiente, aqui SI hay un segundo oraculo legitimo, porque R5 fija un estado concreto
    // y conocido para este unico caso (la cadena vacia). El mapa de abajo esta escrito a
    // mano, sin llamar a `evaluateCredentialRules`, para que el test pueda detectar tambien
    // un criterio de derivacion erroneo en el componente, no solo entradas ausentes o
    // `data-rule` mal puesto.
    const estadosEsperados: Record<Exclude<CredentialRule, 'breached'>, CredentialRuleState> = {
      min_length: 'unmet',
      max_length: 'met',
      no_uppercase: 'unmet',
      no_lowercase: 'unmet',
      no_digit: 'unmet',
      no_symbol: 'unmet',
    };

    const { container } = render(<CredentialRequirements candidate="" />);

    for (const rule of LIVE_RULES) {
      const item = container.querySelector(`li[data-rule="${rule}"]`);
      expect(item, `falta la entrada de ${rule}`).not.toBeNull();
      expect(item?.getAttribute('data-state')).toBe(estadosEsperados[rule]);
    }

    // Tension declarada: este mapa enumera a mano los codigos "en vivo" del catalogo. Si
    // QC-19 anade una regla a `CREDENTIAL_RULES`, este assert falla de forma ruidosa en vez
    // de quedar silenciosamente incompleto — y el fallo dice que anadir una regla al
    // catalogo obliga a revisar tambien la redaccion de R5, no solo este mapa.
    expect(
      Object.keys(estadosEsperados),
      'CREDENTIAL_RULES gano una regla: R5 enumera reglas concretas para la candidata vacia ' +
        '("cinco incumplidas y max_length cumplida"), asi que un codigo nuevo obliga a revisar ' +
        'la redaccion de R5 en requirements.md y a anadir su estado esperado a este mapa literal.',
    ).toEqual(LIVE_RULES);

    // Visible desde el primer render: nada de foco, escritura ni ratón.
    expect(screen.getAllByRole('listitem')).toHaveLength(LIVE_RULES.length);
  });

  // Test espejo (R2 obliga a que `evaluateCredentialRules` sea la unica fuente de verdad,
  // asi que para una candidata arbitraria no hay un segundo oraculo legitimo). Recalcula el
  // esperado con la MISMA funcion que usa el componente: por eso atrapa entradas ausentes,
  // `data-rule` mal puesto, estados escritos a mano y que el componente ignore la candidata,
  // pero NO un criterio de derivacion erroneo compartido por test y componente. El caso de la
  // candidata vacia si tiene un oraculo literal e independiente, gracias a la R5 nueva: ver
  // el `it` de arriba.
  it('el estado mostrado de las seis coincide con evaluateCredentialRules para cada candidata', () => {
    const candidatas = ['', 'a', 'aaaaaaaa', 'Abc12345', 'Abcdefg1#', 'z'.repeat(70)];

    for (const candidate of candidatas) {
      const { container, unmount } = render(<CredentialRequirements candidate={candidate} />);
      for (const rule of LIVE_RULES) {
        const item = container.querySelector(`li[data-rule="${rule}"]`);
        const expected = stateFor(rule, candidate);
        expect(item?.getAttribute('data-state'), `regla ${rule} con candidata ${JSON.stringify(candidate)}`).toBe(
          expected,
        );
      }
      unmount();
    }
  });

  // Tambien espejo, mismo limite que el `it` anterior: recalcula con `evaluateCredentialRules`,
  // no atrapa un criterio de derivacion erroneo, solo cableado incorrecto entre el componente
  // y esa funcion.
  it('al cambiar la candidata cada una de las seis pasa a cumplida o incumplida', () => {
    const { container, rerender } = render(<CredentialRequirements candidate="a" />);
    for (const rule of LIVE_RULES) {
      const item = container.querySelector(`li[data-rule="${rule}"]`);
      expect(item?.getAttribute('data-state')).toBe(stateFor(rule, 'a'));
    }

    const otraCandidata = 'Abcdefg1#';
    rerender(<CredentialRequirements candidate={otraCandidata} />);
    for (const rule of LIVE_RULES) {
      const item = container.querySelector(`li[data-rule="${rule}"]`);
      expect(item?.getAttribute('data-state')).toBe(stateFor(rule, otraCandidata));
    }
  });
});

describe('CredentialRequirements — sin el requisito de filtradas (QC-273)', () => {
  it('la lista no muestra el requisito de credenciales filtradas para ninguna candidata', () => {
    // La regla la comprueba solo el servidor al guardar: la lista en vivo no la promete.
    const candidatas = ['', 'a', 'Abcdefg1#', 'z'.repeat(70)];
    for (const candidate of candidatas) {
      const { container, unmount } = render(<CredentialRequirements candidate={candidate} />);
      expect(container.querySelector('li[data-rule="breached"]'), `candidata ${JSON.stringify(candidate)}`).toBeNull();
      expect(screen.queryByText(CREDENTIAL_RULE_LABELS.breached)).not.toBeInTheDocument();
      expect(screen.queryByText('Requisito pendiente de comprobar')).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe('CredentialRequirements — copy desde una unica fuente (R15)', () => {
  it('el texto de cada regla sale de CREDENTIAL_RULE_LABELS', () => {
    render(<CredentialRequirements candidate="" />);
    for (const rule of LIVE_RULES) {
      expect(screen.getByText(CREDENTIAL_RULE_LABELS[rule])).toBeInTheDocument();
    }
  });

  it('el prop labels sustituye el texto de una regla', () => {
    const textoPropio = 'Texto de prueba sustituido para min_length';
    render(<CredentialRequirements candidate="" labels={{ min_length: textoPropio }} />);

    expect(screen.getByText(textoPropio)).toBeInTheDocument();
    expect(screen.queryByText(CREDENTIAL_RULE_LABELS.min_length)).not.toBeInTheDocument();
    // El resto del copy sigue saliendo de la constante: la sustitucion es parcial.
    expect(screen.getByText(CREDENTIAL_RULE_LABELS.no_uppercase)).toBeInTheDocument();
  });
});

describe('CredentialRequirements — estados distinguibles sin color (R16)', () => {
  it('cada entrada expone su estado de forma consultable y con texto, no solo por color', () => {
    const { container } = render(<CredentialRequirements candidate="Abc" />);
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(LIVE_RULES.length);

    for (const rule of LIVE_RULES) {
      const item = container.querySelector(`li[data-rule="${rule}"]`);
      expect(item).not.toBeNull();
      // Consultable programaticamente: el atributo `data-state`, no un color de CSS.
      const state = item?.getAttribute('data-state');
      expect(state).toMatch(/^(met|unmet)$/);
      // Y con texto, no solo icono: el `li` contiene un texto de estado no vacio.
      expect(item?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('CredentialRequirements — negativas (R20, R21)', () => {
  it('no muestra ninguna puntuacion ni barra de fuerza', () => {
    render(<CredentialRequirements candidate="Abcdefg1#" />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.queryByText(/debil|fuerte|weak|strong/i)).not.toBeInTheDocument();
  });

  it('no emite la candidata en ningun atributo ni texto', () => {
    const candidatoMarcador = 'CANDIDATA-SECRETA-MARCADOR-9x7Q';
    const { container } = render(<CredentialRequirements candidate={candidatoMarcador} />);

    expect(container.innerHTML).not.toContain(candidatoMarcador);
    for (const attribute of ['data-rule', 'data-state']) {
      for (const li of container.querySelectorAll(`[${attribute}]`)) {
        expect(li.getAttribute(attribute)).not.toContain(candidatoMarcador);
      }
    }
  });
});
