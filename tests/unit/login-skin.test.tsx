// Contrato de la piel del login.
//
// Nivel 1: `app/globals.css` leido como TEXTO. Es lo unico que se puede afirmar en Vitest sobre
// la cascada: jsdom no compila la hoja de Tailwind ni resuelve `@layer`, `@supports` ni las media
// queries, asi que un `toHaveStyle('44px')` aqui seria teatro. Lo computado se mide en navegador,
// en `e2e/acceso-rediseno.spec.ts` (nivel 3).
//
// Nivel 2: el marcado renderizado en jsdom, mas la no-regresion de `components/ui/`.
//
// Los casos marcados «ENMIENDA QC-226» sustituyen a los de las burbujas, el vidrio de dos modos y
// los delimitadores antiguos; cada uno conserva la pregunta del caso al que sustituye.
//
// ENMIENDA QC-260 (R1–R6, R9; `design.md > 10`): la pantalla la pinta `AccessScreen` y su CSS
// vive en el bloque «Pantallas de acceso». Los casos de QC-226 R16–R22 y QC-30 sobre los tres
// isotipos que flotan, el vidrio, el tema oscuro forzado, la entrada unica de la tarjeta y el logo
// vertical se sustituyen por los del spec de QC-260; cada caso conserva la pregunta del original
// y lleva su nota «ENMIENDA QC-260».

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';

import LoginPage from '@/app/(public)/login/page';
import type { LoginFormState } from '@/lib/modules/identity/adapters/driving/login-form-state';
import { BRAND_LABEL } from '@/lib/shared/navigation/private-nav';

// `__dirname` y no `import.meta.url`: en el proyecto `ui` (jsdom) la URL del modulo no es de
// esquema `file` y `fileURLToPath` lanza. Mismo patron que `tests/unit/theme/sidebar-panel.test.tsx`.
const RAIZ = join(__dirname, '..', '..');

function leerTexto(...ruta: string[]): string {
  return readFileSync(join(RAIZ, ...ruta), 'utf8');
}

function leerGlobalsCss(): string {
  return leerTexto('app', 'globals.css');
}

// ENMIENDA QC-260: los delimitadores «Pantalla de login» pasan a «Pantallas de acceso».
const INICIO_ACCESO = '/* ══ Pantallas de acceso — INICIO ══ */';
const FIN_ACCESO = '/* ══ Pantallas de acceso — FIN ══ */';

/** Valor de `--shadow-dlg` en `docs/diseno/canvas/qc.css`, copiado tal cual. */
const SOMBRA_DLG = '0 24px 64px -16px rgb(0 30 30 / 0.4)';

/**
 * Devuelve el indice del caracter siguiente al `}` que cierra el bloque que empieza en la
 * primera `{` a partir de `desde`. Balanceo simple de llaves, igual que en
 * `tests/unit/theme/sidebar-panel.test.tsx`: basta porque este archivo no usa llaves dentro de
 * cadenas ni anida `@layer`.
 */
function finDelBloque(css: string, desde: number): number {
  const inicioCuerpo = css.indexOf('{', desde) + 1;
  let profundidad = 1;
  let cursor = inicioCuerpo;
  while (profundidad > 0 && cursor < css.length) {
    const caracter = css[cursor];
    if (caracter === '{') profundidad += 1;
    if (caracter === '}') profundidad -= 1;
    cursor += 1;
  }
  return cursor;
}

type Declaracion = { selector: string; texto: string };

/**
 * Recorre un fragmento de CSS y devuelve cada declaracion junto al selector (o prelude) del
 * bloque MAS INTERNO que la contiene. Asi «este valor solo aparece bajo `[data-access='card']`»
 * se puede afirmar sobre la regla real y no sobre una busqueda de texto plano.
 */
function declaracionesDe(css: string): Declaracion[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const declaraciones: Declaracion[] = [];
  const pila: string[] = [];
  let buffer = '';

  const registrar = () => {
    const texto = buffer.trim();
    if (texto.length > 0 && pila.length > 0) {
      declaraciones.push({ selector: pila[pila.length - 1], texto });
    }
  };

  for (const caracter of sinComentarios) {
    if (caracter === '{') {
      pila.push(buffer.trim());
      buffer = '';
    } else if (caracter === '}') {
      registrar();
      pila.pop();
      buffer = '';
    } else if (caracter === ';') {
      registrar();
      buffer = '';
    } else {
      buffer += caracter;
    }
  }

  return declaraciones;
}

/** Textos de las declaraciones cuyo selector incluye `selector`, con los espacios normalizados. */
function textosDe(fragmento: string, selector: string): string[] {
  return declaracionesDe(fragmento)
    .filter((declaracion) => declaracion.selector.includes(selector))
    .map((declaracion) => declaracion.texto.replace(/\s+/g, ' '));
}

/** El cuerpo de la primera regla `@media`/`@supports`/`@keyframes` cuyo prelude empieza por `prelude`. */
function cuerpoDe(bloque: string, prelude: string): string {
  const inicio = bloque.indexOf(prelude);
  expect(inicio, `no esta ${prelude}`).toBeGreaterThan(-1);
  return bloque.slice(inicio, finDelBloque(bloque, inicio));
}

describe('nivel 1 · contrato de texto del CSS de la pantalla de login', () => {
  it('R32 (ENMIENDA QC-226, QC-260): encierra todo lo de las pantallas de acceso entre sus dos delimitadores de bloque', () => {
    // Si algo del acceso se escapa fuera de los delimitadores, se mezcla con el resto del archivo.
    const css = leerGlobalsCss();

    const inicio = css.indexOf(INICIO_ACCESO);
    const fin = css.indexOf(FIN_ACCESO);

    expect(inicio).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(inicio);

    const fuera = css.slice(0, inicio) + css.slice(fin + FIN_ACCESO.length);
    expect(fuera).not.toContain('data-access');
    expect(fuera).not.toContain('access-molecule-spin');

    // Del bloque de QC-226 no queda nada en ninguna parte del archivo.
    for (const resto of ['data-login', '--login-', 'login-molecule-float', 'login-card-enter', 'login-card-fade']) {
      expect(css).not.toContain(resto);
    }
  });

  it('R18 (ENMIENDA QC-226, QC-260): no deja marcado ni CSS de las burbujas ni variables --qc30-, y el fondo propio del login ya no existe', () => {
    const css = leerGlobalsCss();

    expect(css).not.toContain('--qc30-');
    expect(css).not.toContain('qc30-login-bubble-rise');
    expect(css).not.toContain("[data-login='bubble");
    expect(css).not.toContain('QC-30 · pantalla de login');

    // ENMIENDA QC-260: `LoginBackground` lo absorbe `AccessScreen` y se borra.
    expect(existsSync(join(RAIZ, 'app', '(public)', 'login', 'components', 'login-background.tsx'))).toBe(false);
  });

  it('R23 (ENMIENDA QC-226, QC-260): declara el bloque de acceso fuera de toda capa de cascada', () => {
    // Una regla sin capa gana a las utilidades de Tailwind v4: el relleno, el radio y la sombra de
    // la tarjeta pisan los del primitivo `Card`.
    const css = leerGlobalsCss();

    const indices = [
      css.indexOf(INICIO_ACCESO),
      css.indexOf(FIN_ACCESO),
      css.indexOf("[data-access='screen']"),
      css.indexOf("[data-access='card']"),
    ];
    for (const indice of indices) {
      expect(indice).toBeGreaterThan(-1);
    }

    const layerRuleRegex = /@layer\s+[\w,\s-]+\s*\{/g;
    let match: RegExpExecArray | null;
    while ((match = layerRuleRegex.exec(css)) !== null) {
      const inicioDelLayer = match.index;
      const finDelLayer = finDelBloque(css, match.index);
      for (const indice of indices) {
        expect(indice > inicioDelLayer && indice < finDelLayer).toBe(false);
      }
    }
  });

  it('deja intactas y sin reindentar las reglas del panel flotante de la barra lateral', () => {
    // R24 — se afirma que las reglas de QC-29 SIGUEN PRESENTES, nunca que sean las unicas ni que
    // el bloque tenga un tamano concreto.
    const css = leerGlobalsCss();

    expect(
      css.match(
        /\[data-slot='sidebar-inner'\],\s*\n\[data-slot='sidebar'\]\[data-mobile='true'\]\s*\{\s*\n\s*border-radius:\s*22px;\s*\n\s*background-image:\s*var\(--sidebar-panel-gradient\);/,
      ),
    ).not.toBeNull();

    expect(css.match(/\[data-slot='sidebar-menu-button'\]\s*\{\s*\n\s*min-height:\s*44px;/)).not.toBeNull();
  });

  it('R20 (ENMIENDA QC-226, QC-260): la tarjeta es opaca, sin vidrio: ni backdrop-filter, ni @supports, ni rama de transparencia reducida', () => {
    // La pregunta de los tres casos de vidrio de QC-226 era «se ve bien en todo navegador». Con la
    // tarjeta opaca del tablero `Login` no hay rama que dependa del soporte de `backdrop-filter`.
    const bloque = bloqueAcceso();

    expect(bloque).not.toContain('backdrop-filter');
    expect(bloque).not.toContain('@supports');
    expect(bloque).not.toContain('prefers-reduced-transparency');
    expect(bloque).not.toContain('--login-card-glass');
  });

  it('R18 (ENMIENDA QC-226, QC-260): define exactamente cinco moleculas, ni una mas', () => {
    // Se cuentan indices DISTINTOS, no ocurrencias del selector.
    const bloque = bloqueAcceso();

    const indices = new Set(
      [...bloque.matchAll(/data-access-index='(\d+)'/g)].map((match) => match[1]),
    );

    expect([...indices].sort()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('R22 (ENMIENDA QC-226, QC-260): con movimiento reducido deja las moleculas quietas y visibles y los bloques de la tarjeta en su sitio', () => {
    const bloque = bloqueAcceso();
    const reducido = cuerpoDe(bloque, '@media (prefers-reduced-motion: reduce)');

    expect(textosDe(reducido, "[data-access='molecule']")).toEqual(['animation: none']);

    // Quietas, no ocultas: nada dentro de la regla esconde la capa ni las moleculas.
    for (const texto of textosDe(reducido, '')) {
      expect(texto).not.toMatch(/^(display|visibility|opacity)\s*:/);
    }

    // ENMIENDA QC-260 (R4): sin desplazamiento, en vez del fundido de la tarjeta de QC-226.
    expect(textosDe(reducido, "[data-access='card']")).toEqual(['animation: none']);
  });

  it('R22 (ENMIENDA QC-226, QC-260): con movimiento reducido no queda ningun fundido ni desplazamiento propio', () => {
    // El fundido de QC-226 se sustituye por «sin animacion»: la regla reducida solo apaga.
    const bloque = bloqueAcceso();
    expect(bloque).not.toContain('@keyframes login-card-fade');

    const reducido = cuerpoDe(bloque, '@media (prefers-reduced-motion: reduce)');
    for (const declaracion of declaracionesDe(reducido)) {
      expect(declaracion.texto.replace(/\s+/g, ' ')).toBe('animation: none');
    }
  });

  it('R22 (ENMIENDA QC-226, QC-260): la regla de movimiento reducido esta acotada a las pantallas de acceso', () => {
    const reducido = cuerpoDe(bloqueAcceso(), '@media (prefers-reduced-motion: reduce)');
    const selectores = new Set(declaracionesDe(reducido).map((declaracion) => declaracion.selector));

    expect(selectores.size).toBeGreaterThan(0);
    for (const selector of selectores) {
      expect(selector.startsWith('[data-access=')).toBe(true);
    }
  });

  it('mantiene las medidas de 400px, 18px y 28px dentro del ambito de acceso (ENMIENDA QC-260)', () => {
    // R16, R17 — cada declaracion que use una de esas medidas tiene que colgar de un selector
    // `[data-access=…]`; si una se escribe suelta, se filtra a toda la aplicacion.
    // ENMIENDA QC-260: los 44 px de campos y botones ya no los fuerza el bloque, los dan
    // `PasswordField`, `SubmitButton` (`touch`) y el campo «Usuario» (`design.md > 4`).
    const medidas = ['400px', '18px', '28px'] as const;
    const declaraciones = declaracionesDe(bloqueAcceso());

    for (const medida of medidas) {
      const conLaMedida = declaraciones.filter((declaracion) => declaracion.texto.includes(medida));
      expect(conLaMedida.length).toBeGreaterThan(0);
      for (const declaracion of conLaMedida) {
        expect(declaracion.selector).toContain('[data-access=');
      }
    }

    expect(declaraciones.filter((declaracion) => declaracion.texto.includes('44px'))).toEqual([]);
  });

  it('no deja ninguna de esas medidas fuera del bloque de acceso', () => {
    // R17 — el resto de la aplicacion conserva sus 32 px de alto y las medidas de tarjeta de hoy.
    const css = leerGlobalsCss();
    const inicio = css.indexOf(INICIO_ACCESO);
    const fin = css.indexOf(FIN_ACCESO);
    const declaracionesFuera = declaracionesDe(
      css.slice(0, inicio) + css.slice(fin + FIN_ACCESO.length),
    );

    for (const medida of ['400px', '18px', '28px'] as const) {
      expect(declaracionesFuera.filter((declaracion) => declaracion.texto.includes(medida))).toEqual(
        [],
      );
    }

    // Excepcion unica y preexistente: el `min-height: 44px` del item de menu de la barra lateral
    // (QC-29, T15, R20). Se afirma por SELECTOR y no por numero de ocurrencias.
    const con44Fuera = declaracionesFuera.filter((declaracion) => declaracion.texto.includes('44px'));
    expect(con44Fuera.length).toBeGreaterThan(0);
    for (const declaracion of con44Fuera) {
      expect(declaracion.selector).toContain("[data-slot='sidebar-menu-button']");
    }
  });

  it('R19 (ENMIENDA QC-226, QC-260): gira cada molecula con ciclos de 70, 55, 90, 48 y 40 s, lineal y alternando el sentido', () => {
    // QC-260 R3: ciclos entre 40 y 90 s, del tablero `Login`.
    const bloque = bloqueAcceso();

    const esperado = [
      { indice: '1', animacion: 'animation: access-molecule-spin 70s linear infinite' },
      { indice: '2', animacion: 'animation: access-molecule-spin 55s linear infinite reverse' },
      { indice: '3', animacion: 'animation: access-molecule-spin 90s linear infinite' },
      { indice: '4', animacion: 'animation: access-molecule-spin 48s linear infinite reverse' },
      { indice: '5', animacion: 'animation: access-molecule-spin 40s linear infinite' },
    ] as const;
    for (const molecula of esperado) {
      expect(textosDe(bloque, `[data-access-index='${molecula.indice}']`)).toContain(
        molecula.animacion,
      );
    }

    const ciclos = [...bloque.matchAll(/access-molecule-spin (\d+(?:\.\d+)?)s/g)].map((match) =>
      Number(match[1]),
    );
    expect(ciclos).toHaveLength(5);
    for (const ciclo of ciclos) {
      expect(ciclo).toBeGreaterThanOrEqual(40);
      expect(ciclo).toBeLessThanOrEqual(90);
    }
  });

  it('no redeclara el radio de campo y boton, ni el anillo de foco, ni la tipografia', () => {
    // R20 — la cara complementaria de «no altera las primitivas de components/ui»: alli se
    // afirma que `rounded-lg` y el foco SIGUEN en el primitivo; aqui, que el bloque no los pisa
    // desde la hoja.
    const declaraciones = declaracionesDe(bloqueAcceso());

    const propiedadDe = (texto: string) => texto.split(':')[0].trim();
    const enCampoOBoton = (selector: string) =>
      selector.includes("[data-slot='input']") || selector.includes("[data-slot='button']");

    expect(
      declaraciones.filter(
        (declaracion) =>
          enCampoOBoton(declaracion.selector) && propiedadDe(declaracion.texto) === 'border-radius',
      ),
    ).toEqual([]);

    const propiedadesDeAnillo = ['outline', 'outline-width', 'outline-color', '--ring', 'ring-width'];
    expect(
      declaraciones.filter((declaracion) =>
        propiedadesDeAnillo.includes(propiedadDe(declaracion.texto)),
      ),
    ).toEqual([]);

    expect(
      declaraciones.filter((declaracion) => propiedadDe(declaracion.texto) === 'font-family'),
    ).toEqual([]);
  });

  it('R17 (ENMIENDA QC-226, QC-260): la unica variable propia del bloque es la sombra del tablero, en el ambito de la pantalla', () => {
    // QC-260 R6: los tokens de color son los del tema activo; el bloque no redefine ninguno.
    const personalizadas = declaracionesDe(bloqueAcceso())
      .map((declaracion) => ({
        selector: declaracion.selector.trim(),
        propiedad: declaracion.texto.split(':')[0].trim(),
      }))
      .filter((declaracion) => declaracion.propiedad.startsWith('--'));

    expect(personalizadas).toEqual([{ selector: "[data-access='screen']", propiedad: '--shadow-dlg' }]);
  });

  it('R18 (ENMIENDA QC-226, QC-260): transcribe tamano y posicion de cada molecula del tablero', () => {
    const bloque = bloqueAcceso();

    const esperado = [
      { indice: '1', textos: ['width: 140px', 'height: 140px', 'left: 4%', 'top: 8%'] },
      { indice: '2', textos: ['width: 96px', 'height: 96px', 'right: 7%', 'top: 12%'] },
      { indice: '3', textos: ['width: 170px', 'height: 170px', 'right: 4%', 'bottom: 6%'] },
      { indice: '4', textos: ['width: 80px', 'height: 80px', 'left: 10%', 'bottom: 10%'] },
      { indice: '5', textos: ['width: 60px', 'height: 60px', 'left: 46%', 'top: 3%'] },
    ] as const;
    for (const molecula of esperado) {
      const textos = textosDe(bloque, `[data-access-index='${molecula.indice}']`);
      for (const texto of molecula.textos) {
        expect(textos).toContain(texto);
      }
    }

    // El color es uno para todas: blanco al 13 % sobre el degradado.
    expect(textosDe(bloque, "[data-access='molecules']")).toContain('color: rgb(255 255 255 / 0.13)');
  });

  it('R17, R20 (ENMIENDA QC-226, QC-260): pinta el fondo con el degradado de la barra lateral y la sombra del tablero', () => {
    // Digitos tal cual, solo se normalizan los espacios: el riesgo es una cifra mal copiada.
    const pantalla = textosDe(bloqueAcceso(), "[data-access='screen']");

    expect(pantalla).toContain('background: var(--sidebar-panel-gradient)');
    expect(pantalla).toContain(`--shadow-dlg: ${SOMBRA_DLG}`);
    expect(bloqueAcceso()).not.toContain('--login-screen-background');
  });

  it('R17 (ENMIENDA QC-226, QC-260): el ambito de acceso no fuerza el esquema de color', () => {
    // QC-260 R6 y P1: el acceso sigue el tema de la aplicacion.
    expect(bloqueAcceso()).not.toContain('color-scheme');
  });

  it('R20 (ENMIENDA QC-226, QC-260): la tarjeta declara una sola sombra, la del tablero', () => {
    const sombras = textosDe(bloqueAcceso(), "[data-access='card']").filter((texto) =>
      texto.startsWith('box-shadow'),
    );
    expect(sombras).toEqual(['box-shadow: var(--shadow-dlg)']);
  });

  it('R19 (ENMIENDA QC-226, QC-260): las moleculas solo giran, con transform', () => {
    const giro = cuerpoDe(bloqueAcceso(), '@keyframes access-molecule-spin');
    const textos = declaracionesDe(giro).map((declaracion) =>
      declaracion.texto.replace(/\s+/g, ' '),
    );

    expect(textos).toEqual(['transform: rotate(360deg)']);
  });

  it('R21 (ENMIENDA QC-226, QC-260): los bloques de la tarjeta entran una vez, con screen-enter en --dur-slow y --ease-enter', () => {
    // QC-260 R5: entrada escalonada de los bloques en lugar de la entrada unica de la tarjeta.
    const bloque = bloqueAcceso();
    const sinReducido = bloque.slice(0, bloque.indexOf('@media (prefers-reduced-motion: reduce)'));

    expect(textosDe(sinReducido, "[data-access='card'] > *")).toEqual([
      'animation: screen-enter var(--dur-slow) var(--ease-enter) both',
    ]);

    // Una sola vez: ni `infinite` ni un numero de iteraciones en la animacion de la tarjeta.
    for (const texto of textosDe(bloque, "[data-access='card']")) {
      if (!texto.startsWith('animation')) continue;
      expect(texto).not.toContain('infinite');
    }
  });

  it('R18 (ENMIENDA QC-226, QC-260): deja la capa de moleculas sin capturar el puntero y por debajo de la tarjeta', () => {
    // Sin `z-index`: la capa es absoluta y va antes en el DOM; la tarjeta, relativa, queda encima.
    const bloque = bloqueAcceso();

    const capa = textosDe(bloque, "[data-access='molecules']");
    expect(capa).toContain('pointer-events: none');
    expect(capa).toContain('position: absolute');

    expect(textosDe(bloque, "[data-access='card']")).toContain('position: relative');
  });

  it('fija 400px, 18px y el relleno del tablero en la tarjeta del login (ENMIENDA QC-260)', () => {
    // R16 — la cara POSITIVA del test de medidas. ENMIENDA QC-260: el relleno pasa a
    // `32px 28px 20px` (tablero `Login`); los 44 px de campo y boton se afirman en el marcado.
    const declaraciones = declaracionesDe(bloqueAcceso());

    const declara = (texto: string) =>
      declaraciones.some(
        (declaracion) =>
          declaracion.selector.trim() === "[data-access='card']" &&
          declaracion.texto.replace(/\s+/g, ' ') === texto,
      );

    for (const texto of ['max-width: 400px', 'border-radius: 18px', 'padding: 32px 28px 20px']) {
      expect(declara(texto)).toBe(true);
    }
  });

  it('tampoco pisa el anillo de foco de campo y boton por la via del box-shadow', () => {
    // R20 — una sombra sobre el campo o el boton tapa igual de bien el anillo del primitivo.
    const declaraciones = declaracionesDe(bloqueAcceso());

    const enCampoOBoton = (selector: string) =>
      selector.includes("[data-slot='input']") || selector.includes("[data-slot='button']");

    expect(
      declaraciones.filter(
        (declaracion) =>
          enCampoOBoton(declaracion.selector) &&
          declaracion.texto.split(':')[0].trim() === 'box-shadow',
      ),
    ).toEqual([]);
  });
});

/** El fragmento de `app/globals.css` que va entre los dos delimitadores de acceso, ambos incluidos. */
function bloqueAcceso(): string {
  const css = leerGlobalsCss();
  const inicio = css.indexOf(INICIO_ACCESO);
  const fin = css.indexOf(FIN_ACCESO);
  if (inicio === -1 || fin <= inicio) {
    throw new Error('el bloque delimitado de acceso no esta en app/globals.css');
  }
  return css.slice(inicio, fin + FIN_ACCESO.length);
}

// Se mockea la action por el mismo motivo que en `tests/unit/login-form.test.tsx`: la pagina monta
// el formulario real y no se quiere pegar contra la Server Action.
const { loginActionMock } = vi.hoisted(() => ({
  loginActionMock:
    vi.fn<(prevState: LoginFormState, formData: FormData) => Promise<LoginFormState>>(),
}));

vi.mock('@/lib/modules/identity/adapters/driving/login-action', () => ({
  loginAction: loginActionMock,
}));

describe('nivel 2 · contrato del marcado de la pantalla de login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('expone un unico landmark main, que es el ambito de acceso (ENMIENDA QC-260)', () => {
    // R15 — la capa decorativa es un `div`, no un elemento seccionador: no anade un segundo main.
    render(<LoginPage />);

    const landmarks = screen.getAllByRole('main');
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]).toHaveAttribute('data-access', 'screen');
  });

  it('R16 (ENMIENDA QC-260): la cabecera de la tarjeta es un unico h1 con el isotipo y la marca escrita', () => {
    // QC-260 R9: ya no es el logo vertical; el nombre accesible sigue siendo `BRAND_LABEL`.
    render(<LoginPage />);

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: BRAND_LABEL })).toBe(titulos[0]);

    const titulo = titulos[0];
    const logos = [...titulo.querySelectorAll('img')];
    expect(logos.length).toBeGreaterThan(0);
    for (const logo of logos) {
      expect(logo.getAttribute('src')).toContain('isotipo');
      expect(logo).toHaveAttribute('alt', '');
    }

    expect(titulo.textContent?.trim()).toBe(BRAND_LABEL);
    expect(document.querySelector('[data-slot="card-title"]')).toBeNull();
  });

  it('R17 (ENMIENDA QC-226, QC-260): ningun nodo fuerza el ambito oscuro y el Toaster queda fuera', () => {
    render(<LoginPage />);

    const main = screen.getByRole('main');
    expect(main).not.toHaveClass('dark');
    expect(main.querySelector('.dark')).toBeNull();
    // El `Toaster` lo monta el layout publico, fuera de la pagina: no puede quedar dentro del main.
    expect(main.querySelector('[data-sonner-toaster]')).toBeNull();
  });

  it('R18 (ENMIENDA QC-226, QC-260): monta las cinco moleculas como capa decorativa e inalcanzable por teclado', () => {
    render(<LoginPage />);

    const capa = document.querySelector<HTMLElement>('[data-access="molecules"]');
    if (!capa) {
      throw new Error('la pagina de login no monto la capa de moleculas');
    }

    expect(capa).toHaveAttribute('aria-hidden', 'true');
    const moleculas = capa.querySelectorAll('svg[data-access="molecule"]');
    expect([...moleculas].map((molecula) => molecula.getAttribute('data-access-index'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);

    for (const molecula of moleculas) {
      expect(molecula.hasAttribute('tabindex')).toBe(false);
      expect(molecula.getAttribute('viewBox')).toBe('0 0 48 48');
    }

    expect(
      capa.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'),
    ).toHaveLength(0);
  });

  it('R18 (ENMIENDA QC-226, QC-260): las moleculas no llevan style en linea ni tamano en el marcado', () => {
    render(<LoginPage />);

    const capa = document.querySelector<HTMLElement>('[data-access="molecules"]');
    if (!capa) {
      throw new Error('la pagina de login no monto la capa de moleculas');
    }

    expect(capa.hasAttribute('style')).toBe(false);
    for (const nodo of capa.querySelectorAll('*')) {
      expect(nodo.hasAttribute('style')).toBe(false);
    }
    for (const molecula of capa.querySelectorAll('svg')) {
      expect(molecula.hasAttribute('width')).toBe(false);
      expect(molecula.hasAttribute('height')).toBe(false);
    }
  });

  it('R18 (ENMIENDA QC-226, QC-260): pinta las moleculas del tablero con el color heredado', () => {
    // QC-260: un solo color, `currentColor`, que fija el CSS de la capa; ya no hay trazos de colores.
    render(<LoginPage />);

    const hexagono = '21,10.5 32.7,17.3 32.7,30.8 21,37.5 9.3,30.8 9.3,17.3';
    const moleculas = [...document.querySelectorAll('svg[data-access="molecule"]')];

    for (const molecula of moleculas) {
      expect(molecula).toHaveAttribute('stroke', 'currentColor');
      expect(molecula).toHaveAttribute('fill', 'none');
    }
    for (const indice of ['1', '2', '3', '5']) {
      const svg = document.querySelector(`svg[data-access-index="${indice}"]`);
      expect(svg?.querySelector('polygon')).toHaveAttribute('points', hexagono);
    }
    expect(document.querySelector('svg[data-access-index="4"] polygon')).toBeNull();
  });

  it('R18 (ENMIENDA QC-226, QC-260): coloca la capa de moleculas como hermana de la tarjeta y antes que ella', () => {
    // El orden del DOM es lo que la deja por debajo.
    render(<LoginPage />);

    const main = screen.getByRole('main');
    const capa = document.querySelector<HTMLElement>('[data-access="molecules"]');
    const tarjeta = document.querySelector<HTMLElement>('[data-access="card"]');
    if (!capa || !tarjeta) {
      throw new Error('faltan la capa de moleculas o la tarjeta en la pantalla de login');
    }

    const hijos = [...main.children];
    expect(hijos).toContain(capa);
    expect(hijos).toContain(tarjeta);
    expect(hijos.indexOf(capa)).toBeLessThan(hijos.indexOf(tarjeta));
  });

  it('deja el enlace de recuperacion en el pie de la tarjeta y fuera del formulario', () => {
    // R1 — la anatomia de la pantalla no se mueve.
    render(<LoginPage />);

    const enlace = screen.getByTestId('login-forgot-password');
    const formulario = screen.getByTestId('login-form');

    expect(formulario.contains(enlace)).toBe(false);
  });

  it('no altera las primitivas de components/ui', () => {
    // R19 — el gate corre sin red y no puede diffear contra `origin/dev`, asi que se afirma que
    // las clases que la piel del login podria haber tentado a cambiar SIGUEN en el primitivo.
    expect(leerTexto('components', 'ui', 'input.tsx')).toContain('h-8');
    // ENMIENDA QC-256: la talla por defecto del boton pasa de `h-8` a `h-9`.
    expect(leerTexto('components', 'ui', 'button.tsx')).toContain('h-9');
    expect(leerTexto('components', 'ui', 'card.tsx')).toContain('rounded-xl');
    expect(leerTexto('components', 'ui', 'card.tsx')).toContain('[--card-spacing:--spacing(4)]');
  });

  it('conserva el radio y el anillo de foco de campo y boton en las primitivas', () => {
    // R20 — misma tecnica de lectura de texto que el test de arriba, y por el mismo motivo.
    const input = leerTexto('components', 'ui', 'input.tsx');
    const button = leerTexto('components', 'ui', 'button.tsx');

    // ENMIENDA QC-227: el foco translucido de 3 px pasa a anillo opaco de 1 px en el campo y a contorno de 2 px en el boton, para que el foco sea opaco.
    expect(input).toContain('rounded-lg');
    expect(input).toContain('focus-visible:ring-1');
    expect(button).toContain('rounded-lg');
    expect(button).toContain('focus-visible:outline-2');
  });

  it('mide el alto de la pantalla con la unidad de viewport dinamica (ENMIENDA QC-260)', () => {
    // R23 — `100vh` miente en movil, donde la barra del navegador se retrae y expande.
    // ENMIENDA QC-260 (R1): `min-h-svh` pasa a `min-h-dvh`.
    render(<LoginPage />);

    const main = screen.getByRole('main');

    expect(main).toHaveClass('min-h-dvh');
    expect(main.className).not.toContain('min-h-screen');
  });

  it('R16 (ENMIENDA QC-260): campos y controles del login con objetivo tactil de 44 px y letra de 16 px', () => {
    // Antes lo forzaba el bloque CSS (`min-height: 44px`); ahora lo dan las clases de las piezas.
    render(<LoginPage />);

    for (const campo of [screen.getByTestId('login-username'), screen.getByTestId('login-password')]) {
      expect(campo).toHaveClass('h-11', 'text-base', 'md:text-base');
    }
    for (const control of [
      screen.getByTestId('login-submit'),
      screen.getByTestId('login-password-toggle'),
      screen.getByTestId('login-forgot-password'),
    ]) {
      expect(control).toHaveClass('min-h-11', 'min-w-11');
    }
  });
});
