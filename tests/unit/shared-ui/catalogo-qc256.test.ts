// Las piezas que crea o cambia el rediseño de las piezas compartidas tienen su fila en el catálogo,
// con el tablero que las dibuja. Cada comprobación corre dos veces: sobre el catálogo real, donde no
// debe encontrar nada, y sobre una copia estropeada, donde debe encontrar justo lo que se rompió.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const CATALOGO = 'components/shared/CATALOGO.md';
const catalogoReal = readFileSync(join(process.cwd(), CATALOGO), 'utf8');

const SIN_UI = 'sin UI';
const tablero = (nombre: string): string => `docs/diseno/canvas/${nombre}.dc.html`;

type PiezaEsperada = {
  readonly pieza: string;
  readonly archivo: string;
  readonly diseno: string;
  /** Textos que la fila debe contener porque son la API real de la pieza. */
  readonly menciona?: readonly string[];
};

const PIEZAS_NUEVAS: readonly PiezaEsperada[] = [
  { pieza: 'Alert', archivo: 'components/ui/alert.tsx', diseno: tablero('Avisos') },
  {
    pieza: 'StatusBadge',
    archivo: 'components/shared/status-badge.tsx',
    diseno: tablero('Estados'),
    menciona: ['`tone`', '`label`'],
  },
  {
    pieza: 'ORDER_STATUS_TONES',
    archivo: 'lib/shared/ui/order-status.ts',
    diseno: SIN_UI,
    menciona: ['ORDER_STATUS_LABELS', 'ORDER_PRIORITY_LEVELS'],
  },
  { pieza: 'STATUS_TONES', archivo: 'lib/shared/ui/status-tone.ts', diseno: SIN_UI },
  {
    pieza: 'PriorityMark',
    archivo: 'components/shared/priority-mark.tsx',
    diseno: tablero('Estados'),
    menciona: ['`level`', '`label`'],
  },
  // QC-265 (D7) le dio a Notice el cierre opcional `dismissible`, dibujado en Asignacion.dc.html,
  // y su fila cita los dos tableros.
  {
    pieza: 'Notice',
    archivo: 'components/shared/notice.tsx',
    diseno: `${tablero('Avisos')}, ${tablero('Asignacion')}`,
  },
  {
    pieza: 'PasswordField',
    archivo: 'components/shared/password-field.tsx',
    diseno: tablero('Campos'),
    menciona: ['`texts`', '`requirements`'],
  },
  { pieza: 'PageShell', archivo: 'components/shared/page-shell.tsx', diseno: tablero('Superficies') },
  {
    pieza: 'PageHeader',
    archivo: 'components/shared/page-header.tsx',
    diseno: tablero('Superficies'),
    menciona: ['`breadcrumb`', '`actions`'],
  },
  { pieza: 'UrlTabs', archivo: 'components/shared/url-tabs.tsx', diseno: tablero('Superficies') },
  {
    pieza: 'ArrowLink',
    archivo: 'components/shared/arrow-link.tsx',
    diseno: tablero('Botones'),
    menciona: ['`back`', '`forward`', '`touch`'],
  },
  { pieza: 'avatarTone', archivo: 'lib/shared/ui/avatar-tone.ts', diseno: SIN_UI },
];

const PIEZAS_EXTENDIDAS: readonly PiezaEsperada[] = [
  {
    pieza: 'Button',
    archivo: 'components/ui/button.tsx',
    diseno: tablero('Botones'),
    menciona: ['`xl`', '`touch`', '"mobile"'],
  },
  {
    pieza: 'Tabs',
    archivo: 'components/ui/tabs.tsx',
    diseno: tablero('Superficies'),
    menciona: ['TabsIndicator'],
  },
  {
    pieza: 'Avatar',
    archivo: 'components/ui/avatar.tsx',
    diseno: tablero('Dominio'),
    menciona: ['`tone`'],
  },
  { pieza: 'Toaster', archivo: 'components/ui/sonner.tsx', diseno: tablero('Avisos') },
  { pieza: 'Spinner', archivo: 'components/shared/spinner.tsx', diseno: tablero('Avisos') },
  {
    pieza: 'RowActionsMenu',
    archivo: 'components/shared/row-actions-menu.tsx',
    diseno: tablero('Tabla'),
    menciona: ['`presentation`'],
  },
  {
    pieza: 'DataTable',
    archivo: 'components/shared/data-table/index.ts',
    diseno: tablero('Tabla'),
    menciona: ['chips', '«Limpiar filtros»', '`texts.clearFilters`', '`card`'],
  },
  {
    pieza: 'ResponsibleAvatars',
    archivo: 'components/shared/responsible-avatars.tsx',
    diseno: tablero('Dominio'),
    menciona: ['`avatarTone`'],
  },
  {
    pieza: 'CredentialRequirements',
    archivo: 'components/shared/credential-requirements.tsx',
    diseno: tablero('Campos'),
  },
  {
    pieza: 'DatePicker',
    archivo: 'components/shared/date-picker.tsx',
    diseno: 'previo al rediseño',
    menciona: ['`trigger`'],
  },
];

const PIEZA_RETIRADA = 'CredentialField';

type Fila = {
  readonly piezas: readonly string[];
  readonly archivo: string;
  readonly texto: string;
  readonly diseno: string;
};

function filasDe(catalogo: string): Fila[] {
  const filas: Fila[] = [];
  for (const linea of catalogo.split('\n')) {
    if (!linea.startsWith('| `')) continue;
    const celdas = linea
      .slice(1, linea.trimEnd().endsWith('|') ? linea.trimEnd().length - 1 : undefined)
      .split(' | ')
      .map((celda) => celda.trim());
    if (celdas.length !== 7) continue;
    const piezas = [...celdas[0].matchAll(/`([^`]+)`/g)].map((coincidencia) => coincidencia[1]);
    filas.push({
      piezas,
      archivo: celdas[1].replace(/`/g, ''),
      texto: linea,
      diseno: celdas[6].replace(/`/g, ''),
    });
  }
  return filas;
}

function hallazgos(catalogo: string): string[] {
  const filas = filasDe(catalogo);
  const encontrados: string[] = [];
  for (const esperada of [...PIEZAS_NUEVAS, ...PIEZAS_EXTENDIDAS]) {
    const fila = filas.find(
      (candidata) => candidata.archivo === esperada.archivo && candidata.piezas.includes(esperada.pieza),
    );
    if (fila === undefined) {
      encontrados.push(`${esperada.pieza}: sin fila en ${esperada.archivo}`);
      continue;
    }
    if (fila.diseno !== esperada.diseno) {
      encontrados.push(`${esperada.pieza}: Diseño «${fila.diseno}», se esperaba «${esperada.diseno}»`);
    }
    for (const texto of esperada.menciona ?? []) {
      if (!fila.texto.includes(texto)) encontrados.push(`${esperada.pieza}: la fila no menciona ${texto}`);
    }
  }
  if (filas.some((fila) => fila.piezas.includes(PIEZA_RETIRADA))) {
    encontrados.push(`${PIEZA_RETIRADA}: la fila sigue en el catálogo`);
  }
  return encontrados;
}

function sinFilaDe(catalogo: string, archivo: string): string {
  return catalogo
    .split('\n')
    .filter((linea) => !(linea.startsWith('| `') && linea.includes(`| \`${archivo}\` |`)))
    .join('\n');
}

describe('catálogo de las piezas compartidas del rediseño', () => {
  it('R45: cada pieza nueva tiene fila con su tablero (o «sin UI») en Diseño', () => {
    const nuevas = new Set(PIEZAS_NUEVAS.map((pieza) => pieza.pieza));
    expect(hallazgos(catalogoReal).filter((hallazgo) => nuevas.has(hallazgo.split(':')[0]))).toEqual([]);
  });

  it('R46: cada pieza extendida tiene su fila al día, y la de CredentialField ya no está', () => {
    expect(hallazgos(catalogoReal)).toEqual([]);
  });

  it('R45: una copia del catálogo sin la fila de PriorityMark falla', () => {
    const copia = sinFilaDe(catalogoReal, 'components/shared/priority-mark.tsx');
    expect(copia).not.toBe(catalogoReal);
    expect(hallazgos(copia)).toEqual([
      'PriorityMark: sin fila en components/shared/priority-mark.tsx',
    ]);
  });

  it('R45: una copia sin la fila del mapa de pedido falla', () => {
    const copia = sinFilaDe(catalogoReal, 'lib/shared/ui/order-status.ts');
    expect(hallazgos(copia)).toEqual(['ORDER_STATUS_TONES: sin fila en lib/shared/ui/order-status.ts']);
  });

  it('R46: una copia con la fila de DataTable sin tablero ni chips falla', () => {
    const copia = catalogoReal
      .split('\n')
      .map((linea) =>
        linea.includes('| `components/shared/data-table/index.ts` |')
          ? linea
              .replace('`docs/diseno/canvas/Tabla.dc.html` |', 'previo al rediseño |')
              .replaceAll('«Limpiar filtros»', 'limpiar')
          : linea,
      )
      .join('\n');
    expect(hallazgos(copia)).toEqual([
      'DataTable: Diseño «previo al rediseño», se esperaba «docs/diseno/canvas/Tabla.dc.html»',
      'DataTable: la fila no menciona «Limpiar filtros»',
    ]);
  });

  it('R46: una copia que vuelve a tener la fila de CredentialField falla', () => {
    const fila =
      '| `CredentialField` | `components/shared/credential-field.tsx` | x | x | x | — | previo al rediseño |';
    expect(hallazgos(`${catalogoReal}\n${fila}\n`)).toEqual(['CredentialField: la fila sigue en el catálogo']);
  });
});
