#!/usr/bin/env node
/**
 * Cliente de Trello del arnes (`docs/trello.md`). Solo se usa cuando
 * `arnes.config.json > tracker.tipo` es `trello`; con Jira, el leader trabaja con el MCP de
 * `atlassian` (`docs/jira.md`).
 *
 *   node scripts/trello.mjs importar                 F0: regenera `features` de feature_list.json
 *   node scripts/trello.mjs tomar <key>              F1.0: relee, se asigna si esta libre, relee
 *   node scripts/trello.mjs soltar <key>             quita tu member de la tarjeta
 *   node scripts/trello.mjs mover <key> <estado>     mueve a la lista de ese estado del arnes
 *   node scripts/trello.mjs comentar <key> <texto>   comenta en la tarjeta
 *   node scripts/trello.mjs aprobacion <key>         quien movio la tarjeta a in_progress y cuando
 *   node scripts/trello.mjs crear --nombre <titulo> --labels a,b [--key QC-n] [--depende QC-1,QC-2]
 *                                 [--estado pending] [--desc <texto>]
 *   node scripts/trello.mjs yo                       GET /members/me (para /tracker-connect)
 *
 * REST directo con el `fetch` nativo de Node: cero dependencias (CLAUDE.md regla 7). Las
 * credenciales salen de `TRELLO_KEY` y `TRELLO_TOKEN` del entorno y viajan en la cabecera
 * `Authorization`, nunca en la URL: asi un error que imprima la ruta no filtra el token.
 *
 * Las respuestas se validan a mano, lo minimo: los scripts del arnes no importan `zod` (es una
 * dependencia de la app, no del arnes, y un proyecto que reciba el arnes puede no tenerla).
 *
 * La logica pura (tarjeta -> ficha) esta exportada y no toca la red:
 * `tests/guards/guard-trello-cliente.test.ts`.
 *
 * Salida: 0 bien; 1 error; 2 uso incorrecto; 3 la tarjeta tiene otro member (no se toma).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const API = 'https://api.trello.com/1';
export const CHECKLIST_DEPENDE = 'Depende de';
const KEY = /^[A-Z][A-Z0-9]*-\d+$/;
const ESTADOS = ['pending', 'spec_ready', 'in_progress', 'done', 'cancelled'];

// --------------------------------------------------------------------------- logica pura

/** El tracker del perfil, con el bloque `jira` antiguo como respaldo (igual que el validador). */
export function resolverTracker(config) {
  const t = config?.tracker;
  if (t) {
    return {
      tipo: t.tipo,
      board: t.board,
      prefijo: t.prefijo,
      historicos: Array.isArray(t.prefijos_historicos) ? t.prefijos_historicos : [],
      estados: t.estados ?? {},
    };
  }
  return { tipo: 'jira', board: undefined, prefijo: config?.jira?.project, historicos: [], estados: config?.jira?.estados ?? {} };
}

const nombresDeLabels = (card) => (card.labels ?? []).map((l) => String(l?.name ?? '').trim()).filter(Boolean);

/** Valor del label `<prefijo>:<valor>`, o `null`. */
function valorDeLabel(labels, prefijo) {
  const l = labels.find((n) => n.startsWith(`${prefijo}:`));
  return l ? l.slice(prefijo.length + 1).trim() || null : null;
}

/** La key de la tarjeta: el label `key:<KEY>` manda (features migradas); si no, `<prefijo>-<idShort>`. */
export function keyDeTarjeta(card, prefijo) {
  const migrada = valorDeLabel(nombresDeLabels(card), 'key');
  if (migrada) {
    if (!KEY.test(migrada)) throw new Error(`la tarjeta "${card.name}" tiene el label key:${migrada}, que no es PROYECTO-NUMERO`);
    return migrada;
  }
  if (!prefijo) throw new Error('falta tracker.prefijo en arnes.config.json: no se puede derivar la key');
  return `${prefijo}-${card.idShort}`;
}

/** 0 members = `null`; 1 = `{accountId, displayName}`; mas de 1 = array (el validador lo rechaza en vuelo). */
export function assigneeDe(card) {
  const miembros = Array.isArray(card.members) && card.members.length > 0
    ? card.members.map((m) => ({ accountId: m.id, displayName: m.fullName ?? m.username ?? m.id }))
    : (card.idMembers ?? []).map((id) => ({ accountId: id, displayName: id }));
  if (miembros.length === 0) return null;
  if (miembros.length === 1) return miembros[0];
  return miembros;
}

/** Items del checklist «Depende de»: cada uno es una key. Sin checklist, `[]`. */
export function dependenciasDe(card) {
  const lista = (card.checklists ?? []).find((c) => String(c?.name ?? '').trim() === CHECKLIST_DEPENDE);
  if (!lista) return [];
  return (lista.checkItems ?? [])
    .slice()
    .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
    .map((i) => String(i.name ?? '').trim())
    .filter(Boolean);
}

/**
 * Tarjeta de Trello -> ficha de `feature_list.json` (`docs/trello.md > El contrato de campos`).
 * `listas` traduce `idList` a nombre de lista. Una lista sin traduccion en `estados` LANZA:
 * nunca se adivina el estado (`docs/jira.md > Los estados del board`).
 */
export function tarjetaAFicha(card, { prefijo, estados, listas }) {
  const key = keyDeTarjeta(card, prefijo);
  const labels = nombresDeLabels(card);
  const nombreLista = listas instanceof Map ? listas.get(card.idList) : listas?.[card.idList];
  if (nombreLista === undefined) throw new Error(`${key}: la tarjeta esta en una lista desconocida (${card.idList})`);
  const status = estados?.[nombreLista];
  if (status === undefined) {
    throw new Error(
      `${key}: la lista "${nombreLista}" no esta en arnes.config.json > tracker.estados. ` +
      'Anade la fila con el humano y repite la importacion (docs/trello.md > Los estados del board).',
    );
  }
  const epicLabel = labels.find((n) => n.startsWith('epic:'));
  const epicMatch = epicLabel ? /^epic:\s*([A-Z][A-Z0-9]*-\d+)\s+(.+)$/.exec(epicLabel) : null;
  if (epicLabel && !epicMatch) throw new Error(`${key}: el label "${epicLabel}" no tiene la forma epic:<KEY> <nombre>`);
  const slug = valorDeLabel(labels, 'slug');
  return {
    key,
    id: Number(key.split('-').pop()),
    epic: epicMatch ? epicMatch[1] : null,
    epic_name: epicMatch ? epicMatch[2].trim() : null,
    name: slug,
    description: card.desc ?? '',
    status,
    sdd: labels.includes('sdd'),
    complexity: valorDeLabel(labels, 'complexity'),
    zone: valorDeLabel(labels, 'zone'),
    branch: slug ? `feature/${key}-${slug}` : null,
    depends_on: dependenciasDe(card),
    spec_path: slug ? `specs/${key}-${slug}` : null,
    assignee: assigneeDe(card),
  };
}

/**
 * Las dos excepciones de F0 a "manda el board" (`docs/jira.md > Si Jira y el disco divergen`):
 * una `in_progress` no se degrada, y `zone`/`complexity` evaluadas no se borran. Devuelve las
 * fichas fusionadas y los avisos para el leader.
 */
export function fusionarConCopia(nuevas, anteriores) {
  const previas = new Map((anteriores ?? []).filter((f) => f?.key).map((f) => [f.key, f]));
  const avisos = [];
  const fichas = nuevas.map((f) => {
    const antes = previas.get(f.key);
    if (!antes) return f;
    const r = { ...f };
    if (antes.status === 'in_progress' && f.status !== 'in_progress') {
      r.status = 'in_progress';
      avisos.push(`${f.key} sigue in_progress en disco aunque la tarjeta esta en ${f.status}: cierrala o cancelala a mano`);
    }
    for (const campo of ['zone', 'complexity']) {
      if (f[campo] == null && antes[campo] != null) {
        r[campo] = antes[campo];
        avisos.push(`${f.key} perdio el label ${campo}:${antes[campo]}: reescribelo en la tarjeta y anotalo en progress/deudas.md`);
      }
    }
    return r;
  });
  return { fichas, avisos };
}

/** Nombre de la lista del board para un estado del arnes: la primera de `estados` que exista. */
export function listaParaEstado(estado, estados, listas) {
  const nombres = Object.entries(estados ?? {}).filter(([, v]) => v === estado).map(([n]) => n);
  for (const n of nombres) {
    const l = listas.find((x) => x.name === n);
    if (l) return l;
  }
  return null;
}

// --------------------------------------------------------------------------- red

function exigir(cond, msg) {
  if (!cond) throw new Error(`respuesta inesperada de Trello: ${msg}`);
}

function credenciales() {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    console.error(
      'faltan TRELLO_KEY y/o TRELLO_TOKEN en el entorno. Generalos en https://trello.com/power-ups/admin ' +
      'y exportalos en tu terminal (docs/trello.md > Montar un colaborador nuevo). No los pegues en el chat.',
    );
    process.exit(1);
  }
  return { key, token };
}

async function trello(metodo, ruta, { query, cuerpo } = {}) {
  const { key, token } = credenciales();
  const url = new URL(`${API}${ruta}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `OAuth oauth_consumer_key="${key}", oauth_token="${token}"`,
      Accept: 'application/json',
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`Trello ${metodo} ${ruta} -> ${res.status}: ${texto.slice(0, 200)}`);
  try {
    return texto ? JSON.parse(texto) : null;
  } catch {
    throw new Error(`Trello ${metodo} ${ruta} no devolvio JSON`);
  }
}

function raizDelRepo() {
  try {
    const comun = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (comun) return path.dirname(comun);
  } catch {
    /* sin git: directorio actual */
  }
  return path.resolve('.');
}

function leerConfig(raiz) {
  const ruta = existsSync('arnes.config.json') ? 'arnes.config.json' : path.join(raiz, 'arnes.config.json');
  if (!existsSync(ruta)) throw new Error('falta arnes.config.json: corre /arnes-init');
  const t = resolverTracker(JSON.parse(readFileSync(ruta, 'utf8')));
  if (t.tipo !== 'trello') throw new Error(`arnes.config.json > tracker.tipo es "${t.tipo}": este cliente es solo para Trello (docs/jira.md para Jira)`);
  if (!t.board) throw new Error('falta arnes.config.json > tracker.board (id del board de Trello)');
  if (!t.prefijo) throw new Error('falta arnes.config.json > tracker.prefijo');
  return t;
}

function miMember(raiz) {
  const ruta = path.join(raiz, '.arnes.local.json');
  const id = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')).trello_member_id : null;
  if (!id) throw new Error('sin trello_member_id en .arnes.local.json: corre /tracker-connect');
  return id;
}

async function listasDelBoard(t) {
  const listas = await trello('GET', `/boards/${t.board}/lists`, { query: { filter: 'all', fields: 'name,closed' } });
  exigir(Array.isArray(listas), 'las listas no son un array');
  for (const l of listas) exigir(typeof l?.id === 'string' && typeof l?.name === 'string', 'lista sin id o name');
  return listas;
}

async function tarjetasDelBoard(t) {
  const cards = await trello('GET', `/boards/${t.board}/cards`, {
    query: {
      fields: 'name,desc,idShort,idList,labels,idMembers,closed',
      members: 'true',
      member_fields: 'fullName,username',
      checklists: 'all',
    },
  });
  exigir(Array.isArray(cards), 'las tarjetas no son un array');
  for (const c of cards) {
    exigir(typeof c?.id === 'string' && typeof c?.idList === 'string', 'tarjeta sin id o idList');
    exigir(Number.isInteger(c?.idShort), `la tarjeta ${c?.id} no trae idShort`);
    exigir(Array.isArray(c?.labels ?? []), `la tarjeta ${c?.id} trae labels que no son un array`);
  }
  return cards.filter((c) => !c.closed);
}

async function tarjetaPorKey(t, key) {
  const card = (await tarjetasDelBoard(t)).find((c) => keyDeTarjeta(c, t.prefijo) === key);
  if (!card) throw new Error(`no hay ninguna tarjeta ${key} en el board`);
  return card;
}

async function idMembersDe(idCard) {
  const c = await trello('GET', `/cards/${idCard}`, { query: { fields: 'idMembers' } });
  exigir(Array.isArray(c?.idMembers), 'la tarjeta no trae idMembers');
  return c.idMembers;
}

// --------------------------------------------------------------------------- subcomandos

async function importar(raiz) {
  const t = leerConfig(raiz);
  const listas = await listasDelBoard(t);
  const nombres = new Map(listas.map((l) => [l.id, l.name]));
  const cards = await tarjetasDelBoard(t);
  const nuevas = cards.map((c) => tarjetaAFicha(c, { prefijo: t.prefijo, estados: t.estados, listas: nombres }));
  nuevas.sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }));
  const destino = path.join(raiz, 'feature_list.json');
  const anterior = existsSync(destino) ? JSON.parse(readFileSync(destino, 'utf8')) : {};
  const { fichas, avisos } = fusionarConCopia(nuevas, anterior.features);
  writeFileSync(destino, `${JSON.stringify({ ...anterior, features: fichas }, null, 2)}\n`);
  console.log(`${fichas.length} fichas importadas del board ${t.board} a ${destino}`);
  for (const a of avisos) console.log(`AVISO: ${a}`);
}

async function tomar(raiz, key) {
  const t = leerConfig(raiz);
  const yo = miMember(raiz);
  const card = await tarjetaPorKey(t, key);
  const antes = await idMembersDe(card.id);
  const otros = antes.filter((m) => m !== yo);
  if (otros.length > 0) {
    console.error(`${key} ya tiene member: ${otros.join(', ')}. No se toma; elige otra.`);
    process.exit(3);
  }
  if (!antes.includes(yo)) await trello('POST', `/cards/${card.id}/idMembers`, { query: { value: yo } });
  const despues = await idMembersDe(card.id);
  if (despues.length !== 1 || despues[0] !== yo) {
    console.error(`${key} quedo con members ${despues.join(', ')} tras asignarte: alguien la tomo a la vez. Sueltala y elige otra.`);
    process.exit(3);
  }
  console.log(`${key} es tuya (member ${yo}). Siguiente: ./scripts/wt.sh new ${key} <slug>`);
}

async function soltar(raiz, key) {
  const t = leerConfig(raiz);
  const yo = miMember(raiz);
  const card = await tarjetaPorKey(t, key);
  if ((await idMembersDe(card.id)).includes(yo)) await trello('DELETE', `/cards/${card.id}/idMembers/${yo}`);
  console.log(`${key}: ya no eres member. Devuelve la tarjeta a su estado anterior con "mover" si hace falta.`);
}

async function mover(raiz, key, estado) {
  if (!ESTADOS.includes(estado)) throw new Error(`"${estado}" no es un estado del arnes (${ESTADOS.join(', ')})`);
  const t = leerConfig(raiz);
  const lista = listaParaEstado(estado, t.estados, (await listasDelBoard(t)).filter((l) => !l.closed));
  if (!lista) throw new Error(`ninguna lista abierta del board traduce a ${estado} en tracker.estados`);
  const card = await tarjetaPorKey(t, key);
  await trello('PUT', `/cards/${card.id}`, { cuerpo: { idList: lista.id } });
  console.log(`${key} -> ${lista.name} (${estado})`);
}

async function comentar(raiz, key, texto) {
  if (!texto) throw new Error('falta el texto del comentario');
  const t = leerConfig(raiz);
  const card = await tarjetaPorKey(t, key);
  await trello('POST', `/cards/${card.id}/actions/comments`, { cuerpo: { text: texto } });
  console.log(`${key}: comentario publicado`);
}

async function aprobacion(raiz, key) {
  const t = leerConfig(raiz);
  const nombres = new Map((await listasDelBoard(t)).map((l) => [l.id, l.name]));
  const card = await tarjetaPorKey(t, key);
  const acciones = await trello('GET', `/cards/${card.id}/actions`, { query: { filter: 'updateCard:idList' } });
  exigir(Array.isArray(acciones), 'las acciones no son un array');
  const estadoDe = (lista) => t.estados[lista?.name ?? nombres.get(lista?.id)];
  const ap = acciones
    .filter((a) => estadoDe(a?.data?.listBefore) === 'spec_ready' && estadoDe(a?.data?.listAfter) === 'in_progress')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!ap) {
    console.log(`${key}: sin aprobacion por tarjeta (nadie la movio del estado de spec_ready al de in_progress)`);
    process.exit(1);
  }
  const quien = ap.memberCreator?.fullName ?? ap.idMemberCreator;
  console.log(`${key}: aprobada por ${quien} (${ap.idMemberCreator}) el ${ap.date}`);
}

async function crear(raiz, opciones) {
  const nombre = opciones['--nombre'];
  if (!nombre) throw new Error('falta --nombre');
  const t = leerConfig(raiz);
  const estado = opciones['--estado'] ?? 'pending';
  const etiquetas = (opciones['--labels'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (opciones['--key']) {
    if (!KEY.test(opciones['--key'])) throw new Error(`--key ${opciones['--key']} no es PROYECTO-NUMERO`);
    etiquetas.push(`key:${opciones['--key']}`);
  }
  const lista = listaParaEstado(estado, t.estados, (await listasDelBoard(t)).filter((l) => !l.closed));
  if (!lista) throw new Error(`ninguna lista abierta del board traduce a ${estado} en tracker.estados`);

  const existentes = await trello('GET', `/boards/${t.board}/labels`, { query: { fields: 'name', limit: 1000 } });
  exigir(Array.isArray(existentes), 'los labels no son un array');
  const idLabels = [];
  for (const n of etiquetas) {
    let l = existentes.find((x) => x?.name === n);
    if (!l) {
      l = await trello('POST', '/labels', { cuerpo: { name: n, color: null, idBoard: t.board } });
      exigir(typeof l?.id === 'string', `el label ${n} no se creo`);
      existentes.push(l);
    }
    idLabels.push(l.id);
  }

  const card = await trello('POST', '/cards', {
    cuerpo: { idList: lista.id, name: nombre, desc: opciones['--desc'] ?? '', idLabels },
  });
  exigir(typeof card?.id === 'string' && Number.isInteger(card?.idShort), 'la tarjeta creada no trae id/idShort');

  const deps = (opciones['--depende'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (deps.length > 0) {
    const cl = await trello('POST', `/cards/${card.id}/checklists`, { cuerpo: { name: CHECKLIST_DEPENDE } });
    exigir(typeof cl?.id === 'string', 'el checklist no se creo');
    for (const d of deps) await trello('POST', `/checklists/${cl.id}/checkItems`, { cuerpo: { name: d } });
  }
  const key = opciones['--key'] ?? `${t.prefijo}-${card.idShort}`;
  console.log(`${key} creada en ${lista.name}`);
}

async function yo() {
  const m = await trello('GET', '/members/me', { query: { fields: 'id,fullName,username' } });
  exigir(typeof m?.id === 'string', 'members/me no trae id');
  console.log(JSON.stringify({ id: m.id, fullName: m.fullName, username: m.username }));
}

function leerOpciones(args) {
  const o = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      o[args[i]] = args[i + 1];
      i++;
    }
  }
  return o;
}

const USO = 'uso: node scripts/trello.mjs <importar|tomar|soltar|mover|comentar|aprobacion|crear|yo> ... (cabecera del script)';

async function main() {
  const [sub, ...args] = process.argv.slice(2);
  const raiz = raizDelRepo();
  const pideKey = ['tomar', 'soltar', 'mover', 'comentar', 'aprobacion'];
  if (pideKey.includes(sub) && !KEY.test(args[0] ?? '')) {
    console.error(`${sub} necesita una key (PROYECTO-NUMERO). ${USO}`);
    process.exit(2);
  }
  switch (sub) {
    case 'importar': return importar(raiz);
    case 'tomar': return tomar(raiz, args[0]);
    case 'soltar': return soltar(raiz, args[0]);
    case 'mover': return mover(raiz, args[0], args[1]);
    case 'comentar': return comentar(raiz, args[0], args.slice(1).join(' '));
    case 'aprobacion': return aprobacion(raiz, args[0]);
    case 'crear': return crear(raiz, leerOpciones(args));
    case 'yo': return yo();
    default:
      console.error(USO);
      process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
