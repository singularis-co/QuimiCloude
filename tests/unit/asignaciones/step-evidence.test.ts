// Logica pura de la evidencia por paso: ruta en el bucket, pertenencia de una ruta a
// <empresa>/<pedido>/, si un paso exige evidencia y que pasos de la lista ACTUAL se quedan sin fotos.
import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_PHASES,
  EVIDENCE_READ_LINK_TTL_SECONDS,
  MAX_EVIDENCE_PER_STEP,
  buildEvidencePath,
  isEvidencePathOf,
  missingEvidencePositions,
  stepRequiresEvidence,
  type EvidenceStep,
} from '@/lib/modules/asignaciones';

const COMPANY = randomUUID();
const ORDER = randomUUID();
const OTHER_COMPANY = randomUUID();
const OTHER_ORDER = randomUUID();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

describe('constantes de la evidencia', () => {
  it('R29: el tope es 3 fotos por paso', () => {
    expect(MAX_EVIDENCE_PER_STEP).toBe(3);
  });

  it('R33: la URL de lectura dura 15 minutos', () => {
    expect(EVIDENCE_READ_LINK_TTL_SECONDS).toBe(900);
  });

  it('las dos fases son fabricacion y envasado', () => {
    expect(EVIDENCE_PHASES).toEqual(['manufacturing', 'packing']);
  });
});

describe('buildEvidencePath (R30)', () => {
  it('R30: construye <empresa>/<pedido>/<uuid>', () => {
    const path = buildEvidencePath(COMPANY, ORDER);
    const [company, order, name, ...rest] = path.split('/');
    expect(company).toBe(COMPANY);
    expect(order).toBe(ORDER);
    expect(name).toMatch(UUID_PATTERN);
    expect(rest).toEqual([]);
  });

  it('R30: cada llamada da una ruta distinta', () => {
    const paths = new Set(Array.from({ length: 50 }, () => buildEvidencePath(COMPANY, ORDER)));
    expect(paths.size).toBe(50);
  });

  it('R30, R31: la ruta construida pasa su propia comprobacion', () => {
    expect(isEvidencePathOf(buildEvidencePath(COMPANY, ORDER), COMPANY, ORDER)).toBe(true);
  });
});

describe('isEvidencePathOf (R31)', () => {
  const name = randomUUID();

  it('R31: acepta la ruta de esa empresa y ese pedido', () => {
    expect(isEvidencePathOf(`${COMPANY}/${ORDER}/${name}`, COMPANY, ORDER)).toBe(true);
  });

  it('R31, R39: rechaza otra empresa', () => {
    expect(isEvidencePathOf(`${OTHER_COMPANY}/${ORDER}/${name}`, COMPANY, ORDER)).toBe(false);
  });

  it('R31: rechaza otro pedido de la misma empresa', () => {
    expect(isEvidencePathOf(`${COMPANY}/${OTHER_ORDER}/${name}`, COMPANY, ORDER)).toBe(false);
  });

  it('R31: rechaza un prefijo que solo empieza igual que la empresa o el pedido', () => {
    expect(isEvidencePathOf(`${COMPANY}x/${ORDER}/${name}`, COMPANY, ORDER)).toBe(false);
    expect(isEvidencePathOf(`${COMPANY}/${ORDER}x/${name}`, COMPANY, ORDER)).toBe(false);
  });

  it('R31: rechaza `..` en cualquier segmento', () => {
    for (const path of [
      `${COMPANY}/${ORDER}/..`,
      `${COMPANY}/${ORDER}/.`,
      `${COMPANY}/../${name}`,
      `../${ORDER}/${name}`,
      `${COMPANY}/${ORDER}/../${OTHER_ORDER}/${name}`,
    ]) {
      expect(isEvidencePathOf(path, COMPANY, ORDER), path).toBe(false);
    }
  });

  it('R31: rechaza segmentos de mas o de menos', () => {
    for (const path of [
      `${COMPANY}/${ORDER}`,
      `${COMPANY}/${ORDER}/`,
      `${COMPANY}/${ORDER}/${name}/extra`,
      `${COMPANY}/${ORDER}//${name}`,
      `/${COMPANY}/${ORDER}/${name}`,
      `x/${COMPANY}/${ORDER}/${name}`,
      name,
      '',
    ]) {
      expect(isEvidencePathOf(path, COMPANY, ORDER), path).toBe(false);
    }
  });

  it('R31: con empresa o pedido vacios no acepta nada', () => {
    expect(isEvidencePathOf(`/${ORDER}/${name}`, '', ORDER)).toBe(false);
    expect(isEvidencePathOf(`${COMPANY}//${name}`, COMPANY, '')).toBe(false);
  });
});

describe('stepRequiresEvidence (R28, R37)', () => {
  const steps: readonly EvidenceStep[] = [{}, { requiresEvidence: true }, { requiresEvidence: false }];

  it('R28: true solo en el paso con el switch encendido (posiciones desde 1)', () => {
    expect(stepRequiresEvidence(steps, 1)).toBe(false);
    expect(stepRequiresEvidence(steps, 2)).toBe(true);
    expect(stepRequiresEvidence(steps, 3)).toBe(false);
  });

  it('R28: una posicion que no existe en la lista actual no exige evidencia', () => {
    for (const position of [0, -1, 4, 99, 1.5, Number.NaN]) {
      expect(stepRequiresEvidence(steps, position), String(position)).toBe(false);
    }
    expect(stepRequiresEvidence([], 1)).toBe(false);
  });

  it('R37: lee la lista que recibe: si el switch se enciende despues, ese paso pasa a exigirla', () => {
    const before: readonly EvidenceStep[] = [{}, {}];
    const after: readonly EvidenceStep[] = [{}, { requiresEvidence: true }];
    expect(stepRequiresEvidence(before, 2)).toBe(false);
    expect(stepRequiresEvidence(after, 2)).toBe(true);
  });
});

describe('missingEvidencePositions (R35, R36, R37)', () => {
  it('R35, R36: sin pasos con evidencia no falta nada', () => {
    expect(missingEvidencePositions([{}, { requiresEvidence: false }], [])).toEqual([]);
    expect(missingEvidencePositions([], [])).toEqual([]);
  });

  it('R35, R36: devuelve en orden las posiciones que exigen evidencia y no tienen ninguna foto', () => {
    const steps: readonly EvidenceStep[] = [
      { requiresEvidence: true },
      {},
      { requiresEvidence: true },
      { requiresEvidence: true },
    ];
    expect(missingEvidencePositions(steps, [])).toEqual([1, 3, 4]);
    expect(missingEvidencePositions(steps, [{ stepPosition: 3 }])).toEqual([1, 4]);
    expect(
      missingEvidencePositions(steps, [{ stepPosition: 1 }, { stepPosition: 1 }, { stepPosition: 3 }, { stepPosition: 4 }]),
    ).toEqual([]);
  });

  it('R35: una foto en un paso que no exige evidencia, o que ya no existe, no cubre a otro', () => {
    const steps: readonly EvidenceStep[] = [{ requiresEvidence: true }, {}];
    expect(missingEvidencePositions(steps, [{ stepPosition: 2 }, { stepPosition: 7 }])).toEqual([1]);
  });

  it('R37: rige la lista actual: un paso que pasa a exigir evidencia despues de empezar tambien falta', () => {
    const rows = [{ stepPosition: 1 }];
    expect(missingEvidencePositions([{ requiresEvidence: true }, {}], rows)).toEqual([]);
    expect(missingEvidencePositions([{ requiresEvidence: true }, { requiresEvidence: true }], rows)).toEqual([2]);
  });
});
