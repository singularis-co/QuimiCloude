# QC-244 — menu-clientes-desplegable · requirements.md

> Zona: `frontend` · Complejidad: `low` · depends_on: — · Épica: QC-220 (Integraciones) · Rama:
> `feature/QC-244-menu-clientes-desplegable`
>
> Primer eslabón de la cadena QC-244 → QC-245 → QC-246. Esta ficha solo crea el lugar de
> Contactos. El contenido y el permiso de WhatsApp los traen las fichas siguientes.

## Alcance

El item «Clientes» del menú lateral pasa a ser un **grupo desplegable** con dos entradas:

- «Clientes», la pantalla de hoy;
- «Contactos», nueva. Es donde vivirá el chat de WhatsApp de cada cliente.

El item `nav-clientes` de `lib/shared/navigation/private-nav.ts` se convierte en un grupo con el
mismo patrón que «Integraciones»:

- **Grupo «Clientes»:** `testId: 'nav-clientes'`, misma sección, misma posición y mismo icono que
  el item de hoy (ver P1 y P2).
- **Hijo «Clientes»:** `CUSTOMERS_ROUTE` (`/clientes`), `testId: 'nav-clientes-lista'`, permiso
  `clientes.consultar`.
- **Hijo «Contactos»:** ruta nueva `CUSTOMER_CONTACTS_ROUTE` (`/clientes/contactos`) en
  `lib/shared/routes.ts`, `testId: 'nav-clientes-contactos'`, con su propia etiqueta.

**Página placeholder** `app/(private)/clientes/contactos/page.tsx`, con el mismo patrón que los
placeholders de Integraciones (QC-222):

- título «Contactos»;
- texto «Aquí verás las conversaciones de WhatsApp con tus clientes».

**Permiso de Contactos en esta ficha:** `clientes.consultar`, el mismo de Clientes. La ficha del
chat lo cambia por el permiso de WhatsApp que corresponda.

**Visibilidad del grupo:**

- se ve si el usuario puede ver al menos uno de sus hijos;
- sin `clientes.consultar` no aparece nada, igual que hoy.

**Tests que se ajustan:**

- los que fijan el item de hoy, empezando por `tests/unit/clientes-ui/private-nav-clientes.test.ts`.
  Ese test compara el permiso del item con el de `page.tsx`, y la comparación sigue valiendo para
  cada hijo con su página;
- los E2E que dependen de `nav-clientes`.

### Lo que NO entra

- El contenido de Contactos. Es de la ficha del chat, QC-246.
- Cambios en la pantalla de Clientes.
- Permisos nuevos.
- Nada de QC-245 (backend de WhatsApp) ni de QC-246.

## Decisiones cerradas (no reabrir)

| # | Decisión | Por qué | Cubierta por |
|---|---|---|---|
| D1 | Grupo con el mismo patrón que «Integraciones» | Un solo patrón de menú desplegable en el repo. | R1, R2, R6 |
| D2 | Contactos bajo `/clientes/contactos` | Es una vista de los clientes. La URL lo refleja y queda cubierta por el prefijo privado de `/clientes`. | R2, R10 |
| D3 | Placeholder con `clientes.consultar` | Todavía no hay permiso de WhatsApp. Esta ficha no depende de ninguna otra y puede ir ya. | R3, R4, R5, R8 |
| D4 | Se conserva `nav-clientes` como testId del grupo | Menos cambios en los tests que ya lo buscan. | R1, R5 |

## Requisitos (EARS)

### Menú

- **R1.** El sistema DEBE presentar en el menú privado «Clientes» como un **grupo desplegable**
  (`kind: 'group'`), no como un enlace directo. El grupo:
  - lleva la etiqueta `CUSTOMERS_LABEL` y el `testId` `nav-clientes`;
  - está en la sección «Directorio»;
  - va justo detrás de Proveedores en `PRIVATE_NAV_ITEMS`;
  - lleva el icono `square-user`.

  Sección, posición e icono son los del item de hoy (P1, P2).
- **R2.** El grupo «Clientes» DEBE contener exactamente dos hijos, en este orden y sin icono ni
  sección propios:
  1. «Clientes»: destino `CUSTOMERS_ROUTE`, `testId` `nav-clientes-lista`;
  2. «Contactos»: destino `CUSTOMER_CONTACTS_ROUTE`, `testId` `nav-clientes-contactos`.
- **R3.** Cada hijo del grupo DEBE declarar el permiso `clientes.consultar`. Ese código DEBE ser el
  mismo, y el único, que exige con `requirePagePermission` la `page.tsx` de su destino.
- **R4.** SI los permisos efectivos del usuario incluyen `clientes.consultar`, ENTONCES el menú
  filtrado DEBE contener el grupo «Clientes» con sus dos hijos.
- **R5.** SI los permisos efectivos del usuario no incluyen `clientes.consultar`, ENTONCES el menú
  filtrado NO DEBE contener el grupo. Lo que se serializa hacia el cliente NO DEBE llevar:
  - su etiqueta ni la de sus hijos;
  - `CUSTOMERS_ROUTE` ni `CUSTOMER_CONTACTS_ROUTE`;
  - los `testId` `nav-clientes`, `nav-clientes-lista` ni `nav-clientes-contactos`.
- **R6.** CUANDO el usuario activa el grupo «Clientes» en el menú, el sistema DEBE mostrar sus dos
  hijos. CUANDO el usuario activa un hijo, el sistema DEBE navegar a la página de su destino.

### Página de Contactos

- **R7.** MIENTRAS el usuario tiene sesión con `clientes.consultar`, el sistema DEBE servir en
  `CUSTOMER_CONTACTS_ROUTE` una página con:
  - un único título de nivel 1 cuyo texto es la etiqueta de Contactos (R11);
  - un estado vacío cuyo texto es exactamente
    «Aquí verás las conversaciones de WhatsApp con tus clientes.» (P3).

  La página NO DEBE:
  - tener botón, enlace, formulario ni campo;
  - leer `params` ni `searchParams`;
  - llamar a ninguna Server Action ni a ningún caso de uso.
- **R8.** SI una sesión válida sin `clientes.consultar` pide `CUSTOMER_CONTACTS_ROUTE`, ENTONCES el
  sistema DEBE responder 404 con la pantalla no encontrada del layout privado, sin redirigir.
- **R9.** SI se pide `CUSTOMER_CONTACTS_ROUTE` sin sesión, ENTONCES el sistema DEBE redirigir al
  login.
- **R10.** La URL `/clientes/contactos` DEBE declararse una sola vez, como `CUSTOMER_CONTACTS_ROUTE`
  en `lib/shared/routes.ts` y derivada de `CUSTOMERS_ROUTE`. Ningún otro archivo de `lib/`, `app/`
  ni `components/` DEBE escribirla como literal. `PRIVATE_ROUTE_PREFIXES` NO DEBE ganar una fila:
  la de `CUSTOMERS_ROUTE` ya la cubre por segmentos (D2).
- **R11.** La etiqueta «Contactos» DEBE vivir en una sola constante exportada de
  `lib/shared/navigation/private-nav.ts`. El hijo del menú, el título de la página y su metadata la
  DEBEN importar, nunca escribirla.

### Lo que no cambia

- **R12.** La pantalla `CUSTOMERS_ROUTE` DEBE seguir exigiendo el mismo permiso único
  (`clientes.consultar`) y comportarse igual que antes de esta ficha.
- **R13.** El orden de las secciones del menú, el orden y los `testId` de los items de nivel
  superior y el aterrizaje tras el login (`firstVisibleNavHref`) de cada rol de semilla NO DEBEN
  cambiar.
- **R14.** Estas guardias DEBEN quedar en verde sin ninguna excepción nueva:
  - `guard-rutas-privadas-cubiertas`;
  - `guard-pantallas-exigen-permiso`;
  - `guard-nav-permisos-declarados`;
  - `guard-nav-serializable`;
  - la comparación menú-página de R3.

  Una ancla de lista exacta que cambie se tensa a la lista exacta nueva, nunca se afloja.
- **R15.** La feature NO DEBE añadir permisos ni tocar:
  - `lib/modules/**`, `lib/composition/**`, `db/**` ni `middleware.ts`;
  - `components/ui/**` ni `components/shared/**`;
  - `components/private/app-sidebar.tsx`;
  - `package.json`.

## Preguntas abiertas

- **P1 (resuelta, sin reabrir nada).** La ficha dice «sección «Cadena»» e «icono `contact`», pero
  el código de hoy tiene `NAV_SECTION_DIRECTORY` («Directorio») y `'square-user'`. Las dos cosas las
  cambió QC-257 por decisión del humano: su D11 (P3) dice «Clientes pasa a `SquareUser`… QC-244
  ajustará su icono». La ficha pide además «misma sección y misma posición». Se toma lo que hay
  hoy: «Directorio» y `square-user`. Si el humano quiere otro icono para el grupo, cambia solo ese
  dato de R1. Y si es un icono que no está en `NavIconName`, hace falta el pase `/design` del
  cambio visual.
- **P2 (resuelta).** Que el hijo «Clientes» use la misma etiqueta que el grupo (`CUSTOMERS_LABEL`)
  lo pide la ficha («Hijo «Clientes»»). Integraciones no tiene ese caso, porque sus hijos tienen
  nombres distintos al del grupo.
- **P3 (a confirmar al aprobar).** La ficha cita el texto sin puntuación dentro de comillas. El
  spec le pone punto final, como el texto del placeholder de Integraciones («Próximamente podrás
  configurar esta integración.»). Si el humano lo quiere sin punto, solo cambia el literal de R7 y
  de la constante.
