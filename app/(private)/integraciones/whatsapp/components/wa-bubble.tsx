import { ExternalLink, Phone, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const WA_BUBBLE_TESTID = 'wa-bubble';
export const WA_BUBBLE_HEADER_TESTID = 'wa-bubble-header';
export const WA_BUBBLE_BODY_TESTID = 'wa-bubble-body';
export const WA_BUBBLE_EMPTY_TESTID = 'wa-bubble-empty';
export const WA_BUBBLE_FOOTER_TESTID = 'wa-bubble-footer';
export const WA_BUBBLE_TIME_TESTID = 'wa-bubble-time';
export const WA_BUBBLE_VARIABLE_TESTID = 'wa-bubble-variable';
export const WA_BUBBLE_BUTTON_TESTID = 'wa-bubble-button';

export const WA_BUBBLE_TEXTS = {
  title: 'Vista previa',
  ariaPrefix: 'Vista previa del mensaje: ',
  emptyBody: 'Escribe el mensaje para verlo aquí.',
  unknownKey: (key: string) => `[${key}]`,
  unmappedSlot: (slot: string) => `[${slot} sin relacionar]`,
} as const;

/** Entrada del fundido de cada variable y botón nuevos: 240 ms, sube 4 px, sin él si se pide menos movimiento. */
export const WA_BUBBLE_ENTER_CLASS =
  'animate-in fade-in slide-in-from-bottom-1 duration-240 ease-(--ease-enter) motion-reduce:animate-none';

export type WaBubbleVariable = {
  readonly key: string;
  /** Lo que se pinta en lugar de `{{key}}`: el valor de una propia o la etiqueta de una constante. */
  readonly preview: string;
};

export type WaBubbleButton = {
  readonly type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  readonly text: string;
};

export type WaBubbleProps = {
  readonly body: string;
  readonly header?: string | null;
  readonly footer?: string | null;
  readonly buttons?: readonly WaBubbleButton[];
  /** Resolución de cada `{{key}}` del encabezado y el cuerpo. Si una clave se repite, gana la primera. */
  readonly variables: readonly WaBubbleVariable[];
  /** Resolución propia del encabezado, cuando sus huecos numerados no son los del cuerpo. */
  readonly headerVariables?: readonly WaBubbleVariable[];
  /** Si es `true`, un `{{n}}` sin resolver se lee «[n sin relacionar]» en vez de «[n]». */
  readonly unmappedSlots?: boolean;
  /** Hora ya formateada que se pinta al pie de la burbuja. */
  readonly time: string;
  readonly className?: string;
};

type Segment =
  | { readonly kind: 'text'; readonly text: string; readonly id: string }
  | { readonly kind: 'variable'; readonly text: string; readonly id: string };

const MARK = /\{\{([^{}]+)\}\}/g;
const SLOT = /^\d+$/;

function lookupOf(variables: readonly WaBubbleVariable[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const v of variables) if (!map.has(v.key)) map.set(v.key, v.preview);
  return map;
}

function segmentsOf(
  text: string,
  lookup: ReadonlyMap<string, string>,
  unmappedSlots: boolean,
): readonly Segment[] {
  const out: Segment[] = [];
  const seen = new Map<string, number>();
  let last = 0;
  for (const match of text.matchAll(MARK)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ kind: 'text', text: text.slice(last, index), id: `t${out.length}` });
    const key = (match[1] ?? '').trim();
    const resolved = lookup.get(key);
    const fallback =
      unmappedSlots && SLOT.test(key) ? WA_BUBBLE_TEXTS.unmappedSlot(key) : WA_BUBBLE_TEXTS.unknownKey(key);
    // El id por clave y aparición mantiene montadas las variables ya pintadas al escribir delante
    // de ellas, para que solo entre con fundido la nueva.
    const nth = seen.get(key) ?? 0;
    seen.set(key, nth + 1);
    out.push({ kind: 'variable', text: resolved ?? fallback, id: `v:${key}:${nth}` });
    last = index + match[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last), id: `t${out.length}` });
  return out;
}

function renderSegments(segments: readonly Segment[]): ReactNode {
  return segments.map((s) =>
    s.kind === 'text' ? (
      <span key={s.id}>{s.text}</span>
    ) : (
      <span
        key={s.id}
        data-testid={WA_BUBBLE_VARIABLE_TESTID}
        className={cn(
          'rounded-[4px] bg-[#d9fdd3] px-[3px] font-medium text-[#0b5c52] dark:bg-[#005c4b] dark:text-[#d9fdd3]',
          WA_BUBBLE_ENTER_CLASS,
        )}
      >
        {s.text}
      </span>
    ),
  );
}

const BUTTON_ICON = {
  QUICK_REPLY: Undo2,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
} as const;

const SURFACE_CLASS = 'bg-white shadow-[0_1px_0.5px_rgb(11_20_26/0.13)] dark:bg-[#202c33]';
const MUTED_CLASS = 'text-[#667781] dark:text-[#8696a0]';

export function WaBubble({
  body,
  header = null,
  footer = null,
  buttons = [],
  variables,
  headerVariables,
  unmappedSlots = false,
  time,
  className,
}: WaBubbleProps) {
  const lookup = lookupOf(variables);
  const headerLookup = headerVariables ? lookupOf(headerVariables) : lookup;
  const headerSegments = segmentsOf(header ?? '', headerLookup, unmappedSlots);
  const bodySegments = segmentsOf(body, lookup, unmappedSlots);
  const hasHeader = (header ?? '').trim() !== '';
  const hasFooter = (footer ?? '').trim() !== '';
  const isEmptyBody = body.trim() === '';
  const visibleButtons = buttons.filter((b) => b.text !== '');

  const plain = (segments: readonly Segment[]) => segments.map((s) => s.text).join('');
  const label =
    WA_BUBBLE_TEXTS.ariaPrefix +
    [
      hasHeader ? plain(headerSegments) : '',
      isEmptyBody ? WA_BUBBLE_TEXTS.emptyBody : plain(bodySegments),
      hasFooter ? footer : '',
    ]
      .filter(Boolean)
      .join('. ');

  return (
    <div
      role="img"
      aria-label={label}
      data-testid={WA_BUBBLE_TESTID}
      className={cn(
        'box-border flex min-h-80 w-full flex-col gap-1.5 rounded-xl bg-[#efeae2] py-5 pr-4 pl-6 dark:bg-[#0b141a]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('self-center pb-1.5 text-[11px] font-medium tracking-[.04em] uppercase', MUTED_CLASS)}
      >
        {WA_BUBBLE_TEXTS.title}
      </span>
      <div
        aria-hidden="true"
        className={cn(
          'relative max-w-[300px] rounded-[0_10px_10px_10px] px-2.5 pt-2 pb-1.5 text-[14.2px] leading-[1.38] text-[#111b21] dark:text-[#e9edef]',
          "before:absolute before:top-0 before:-left-2 before:border-solid before:border-t-0 before:border-r-8 before:border-b-10 before:border-l-0 before:border-transparent before:border-r-white before:content-[''] dark:before:border-r-[#202c33]",
          SURFACE_CLASS,
        )}
      >
        {hasHeader ? (
          <div
            data-testid={WA_BUBBLE_HEADER_TESTID}
            className="pb-1 font-semibold [overflow-wrap:anywhere] whitespace-pre-wrap"
          >
            {renderSegments(headerSegments)}
          </div>
        ) : null}
        {isEmptyBody ? (
          <div data-testid={WA_BUBBLE_EMPTY_TESTID} className={cn('italic', MUTED_CLASS)}>
            {WA_BUBBLE_TEXTS.emptyBody}
          </div>
        ) : (
          <div data-testid={WA_BUBBLE_BODY_TESTID} className="[overflow-wrap:anywhere] whitespace-pre-wrap">
            {renderSegments(bodySegments)}
          </div>
        )}
        {hasFooter ? (
          <div
            data-testid={WA_BUBBLE_FOOTER_TESTID}
            className={cn('pt-1 text-[13px] [overflow-wrap:anywhere] whitespace-pre-wrap', MUTED_CLASS)}
          >
            {footer}
          </div>
        ) : null}
        <div data-testid={WA_BUBBLE_TIME_TESTID} className={cn('pt-0.5 text-right text-[11px]', MUTED_CLASS)}>
          {time}
        </div>
      </div>
      {visibleButtons.map((button, index) => {
        const Icon = BUTTON_ICON[button.type];
        return (
          <div
            // El índice, no el texto: escribir en un botón no debe repetir su entrada.
            key={index}
            aria-hidden="true"
            data-testid={WA_BUBBLE_BUTTON_TESTID}
            className={cn(
              'box-border flex min-h-10 max-w-[300px] items-center justify-center gap-1.5 rounded-[10px] text-sm font-medium text-[#027eb5] dark:text-[#53bdeb]',
              SURFACE_CLASS,
              WA_BUBBLE_ENTER_CLASS,
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{button.text}</span>
          </div>
        );
      })}
    </div>
  );
}
