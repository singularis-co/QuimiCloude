# docs/trello.md — El board manda, el disco trabaja (Trello)

Aplica cuando `arnes.config.json > tracker.tipo` es `trello`. Con Jira (o sin bloque `tracker`),
`docs/jira.md`. El modelo es el mismo: el arnés **importa** el board a `feature_list.json`,
trabaja contra el disco y el gate nunca llama al tracker. Aquí solo está lo que cambia; los
porqués comunes se enlazan a `docs/jira.md`.

- **El cliente es `scripts/trello.mjs`**: REST directo con el `fetch` de Node, sin dependencias.
  Credenciales en `TRELLO_KEY` y `TRELLO_TOKEN`, del entorno (nunca en el repo ni en el chat).
- **Una tarjeta abierta = una feature.** Las épicas no son tarjetas: se nombran con un label.
- **Las tasks `T0..T7` no suben al board** (`docs/jira.md`, cabecera).

### Por qué

El 2026-10-13 se decidió dejar Jira por el costo de sus licencias. Se descartaron dos caminos:

- **MCP de comunidad.** Ninguno pasa los cuatro checks de `docs/architecture.md > Dependencias
  de terceros`. `@delorenj/mcp-server-trello` (2.877 descargas/semana) no sabe quitar un member,
  crear labels ni leer el historial de listas, y las tres cosas son el ciclo (soltar, F1.0, F1.4).
  `atlassian-trello-mcp` tiene 170 descargas/semana.
- **MCP oficial de Atlassian** (`mcp.trello.com`): solo OAuth remoto, sin stdio, y con las
  operaciones de escritura en "coming soon".

La API REST de Trello es estable y pequeña: un script sin dependencias cubre todo el ciclo.

## El board de este repo

Se declara en `arnes.config.json > tracker`, que se versiona:

```json
"tracker": {
  "tipo": "trello",
  "board": "<id del board de Trello>",
  "prefijo": "QT",
  "prefijos_historicos": ["QC"],
  "estados": {
    "Por hacer": "pending",
    "En revisión": "spec_ready",
    "En curso": "in_progress",
    "Finalizado": "done",
    "Cancelado": "cancelled"
  }
}
```

- `board` es el id **completo** del board (24 caracteres hex). El corto de la URL
  (`trello.com/b/<corto>/…`) sirve para leer, pero `POST /labels` lo rechaza con `400 Invalid id`
  y `crear` falla. Se saca con `GET /boards/<corto>?fields=id`.
- `prefijo` da la key de las tarjetas nuevas: `<prefijo>-<idShort>`.
- `prefijos_historicos` son los prefijos de las features migradas de otro tracker, que conservan
  su key (`## Migrar desde Jira`). El validador acepta los dos.
- Con `tracker` presente, el bloque `jira` ya no se lee.

QuimiCloude cortó a Trello el 2026-10-22 con este bloque; los nombres de las listas son los del
board real.

## Montar el board (una vez)

1. Un board de Trello en un workspace del equipo. Su id va en `tracker.board`.
2. Una **lista por estado del arnés** (`pending`, `spec_ready`, `in_progress`, `done`,
   `cancelled`), con el nombre que el equipo quiera. La traducción va en `tracker.estados`.
3. Nada más: los labels (`zone:`, `slug:`…) los crea `scripts/trello.mjs crear` cuando faltan.

## Los estados del board

Las mismas reglas que `docs/jira.md > Los estados del board`, cambiando «estado» por **lista**:

- **F0 traduce por el nombre de la lista**, con `tracker.estados` y con nada más.
- **Una lista que no esté en la tabla detiene la importación**, nombrando la lista y la tarjeta.
- **Varias listas pueden ir al mismo estado.** `mover` usa la primera de la tabla que exista.
- **La aprobación F1.4 es mover la tarjeta** de la lista de `spec_ready` a la de `in_progress`.
  `node scripts/trello.mjs aprobacion <key>` imprime quién la movió y cuándo (lo lee de
  `GET /cards/{id}/actions?filter=updateCard:idList`).

`scripts/validate-features.mjs` valida `tracker.estados` igual que `jira.estados`.

## Montar un colaborador nuevo

**Cada persona usa su propia clave y su propio token.** Nada viaja en el repo.

1. El admin del board invita a la persona al board (miembro normal, no observador).
2. La persona genera su clave y su token en `https://trello.com/power-ups/admin`: crea un
   Power-Up (cualquier nombre), genera la **API key** y, desde ella, el **token** con lectura y
   escritura.
3. Los exporta en su terminal, **fuera del chat** (`.env.example` trae los dos comandos). En
   Windows, la variable de usuario no entra en procesos vivos: cierra la terminal o el VS Code.
4. Corre **`/tracker-connect`**: verifica con `node scripts/trello.mjs yo` y escribe
   `trello_member_id` en `.arnes.local.json`.

**Sin credenciales, el gate sigue corriendo**; lo que se pierde es lo mismo que en
`docs/jira.md > Montar un colaborador nuevo`. El porqué de no compartir el token, también allí.

## Verificar que la conexión es real

```bash
node scripts/trello.mjs yo
```

Imprime `{id, fullName, username}` de la cuenta dueña del token. Comprueba que es la tuya.

| Error | Qué falta |
|---|---|
| `faltan TRELLO_KEY y/o TRELLO_TOKEN` | el paso 3: la variable no llega al proceso |
| `401 … invalid key` / `invalid token` | clave o token mal copiados, o token revocado |
| `401` o `404` al importar, con `yo` en verde | no eres miembro del board de `tracker.board` |

## El contrato de campos

Las mismas fichas que con Jira (`docs/jira.md > El contrato de campos`). Cambia de dónde sale cada
dato:

| Campo de cada ficha | De dónde sale |
|---|---|
| `key` | label `key:<KEY>` si la tarjeta lo tiene (migradas); si no, `<tracker.prefijo>-<idShort>` |
| `id` | número de la key |
| `epic` / `epic_name` | label `epic:<KEY> <nombre>` (`epic:QC-17 Identidad y acceso`) |
| `description` | descripción de la tarjeta |
| `status` | nombre de la lista, traducido con `tracker.estados` |
| `assignee` | el member de la tarjeta: `{accountId: idMember, displayName: fullName}`, o `null` |
| `depends_on` | ítems del checklist **«Depende de»**; cada ítem es una key |
| `zone`, `complexity`, `name` (slug), `sdd` | los mismos labels que en Jira |
| `branch`, `spec_path` | derivados de key y slug, como en Jira |

- **El label `key:` manda sobre el `idShort`.** Es lo que deja a una feature migrada conservar
  rama, `specs/` y `progress/`.
- **`depends_on` por checklist**: Trello no tiene links entre tarjetas; un checklist con nombre
  fijo se lee y se edita a mano sin herramientas.

## El assignee: el candado visible del equipo

Igual que `docs/jira.md > El assignee: el candado visible del equipo`, con members:

- **Exactamente un member** por feature en vuelo. Con más de uno, `importar` escribe `assignee`
  como array y el validador **falla**: deja solo a quien la tiene.
- **F1.0 — tomar:** `node scripts/trello.mjs tomar <key>` relee la tarjeta en vivo, sigue solo si
  no tiene member o el member eres tú, te añade y relee. Sale con **3** si la tiene otra persona.
  Después, `./scripts/wt.sh new <key> <slug>`; si sale con 4 (`TOMADA`), `soltar` y elige otra.
- **Soltar:** `node scripts/trello.mjs soltar <key>` y `mover <key> <estado anterior>`.

Trello tampoco tiene "asignar si nadie la tiene" atómico: la rama publicada sigue siendo el
cerrojo de verdad.

## Quién sincroniza y cuándo

El **leader**, con `scripts/trello.mjs`. Los mismos pasos que `docs/jira.md > Quién sincroniza y
cuándo`:

| Paso | Comando |
|---|---|
| **F0** | `importar`: regenera `features` de `feature_list.json` en la raíz del worktree principal |
| **F1.0** | `tomar <key>`; las labels `zone:`/`complexity:` se añaden en la tarjeta |
| **F1.3** | `mover <key> spec_ready` y `comentar <key> "specs/<key>-<slug>/"` |
| **F1.4** | el humano mueve la tarjeta; `aprobacion <key>` lo confirma |
| **F2.0** | `mover <key> in_progress` |
| **F2.5** | `mover <key> done` y `comentar <key> "<URL del PR>"`. El member se queda |
| **Al soltar** | `soltar <key>` y `mover <key> <estado anterior>` |
| **Al acotar** | `crear --nombre … --labels … [--depende …]` para la ficha que falta; `mover <key> cancelled` para la huérfana |

## Si el tracker y el disco divergen

**Manda el board**, con las dos excepciones de `docs/jira.md > Si Jira y el disco divergen`.
`importar` las aplica solo: no degrada una `in_progress` y no borra `zone`/`complexity` ya
evaluadas, y avisa de cada caso para que lo reescribas en la tarjeta y lo anotes en
`progress/deudas.md`.

## Migrar desde Jira

Una sola vez, en el corte. Jira queda **en solo lectura** después.

1. Monta el board (`## Montar el board (una vez)`) y pega el bloque `tracker` en
   `arnes.config.json`, con `prefijos_historicos: ["<jira.project>"]`.
2. Lee con el MCP de `atlassian` **solo los issues vivos**: los que no están en el estado de
   `done` ni en el de `cancelled`. El historial no se migra.
3. Por cada uno, créalo con su key:

   ```bash
   node scripts/trello.mjs crear --nombre "<summary>" --desc "<description>" \
     --labels "slug:<slug>,zone:<z>,complexity:<c>,sdd,epic:<KEY> <nombre>" \
     --key QC-131 --depende QC-107,QC-111 --estado <estado del arnes>
   ```

4. Asigna cada tarjeta en vuelo a su dueño (`tomar`, por cada persona).
5. Cada persona corre `/tracker-connect`; el leader corre `importar` y `./init.sh`.

Las migradas conservan su key `QC-n`, así que rama, `specs/` y `progress/` no se tocan. Las nuevas
nacen con el prefijo nuevo.

## Lo que NO cambia

- **El gate no llama al tracker.** `./init.sh` corre sin red, en local y en CI.
- **El estado de trabajo sigue en disco** (regla 3 de `CLAUDE.md`).
- **El candado, el cupo personal y el conflicto de archivos** (`docs/equipo.md`): mismas reglas,
  mismo validador.
- **El marcador `board-pendiente`** (`docs/jira.md > Cuando el disco descubre que el board está
  desactualizado`) vale igual: si Trello no responde, se siembra con la marca.
