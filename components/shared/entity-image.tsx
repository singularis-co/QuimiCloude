'use client';

import { useState } from 'react';

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

/**
 * Miniatura de la imagen de una fila, con marcador cuando no hay ninguna.
 *
 * `path` va tal cual a `src`: el consumidor pasa una URL servible (la `imageUrl` que compone su
 * modulo), no la ruta guardada en el bucket. El marcador cubre `path` vacio y el `src` que falla
 * al cargar.
 *
 * `<img>` y no `next/image`: este exige declarar en `next.config.ts` cada dominio de origen, que
 * hoy no declara ninguno, y lo que protege -LCP y ancho de banda- no esta en juego en una
 * miniatura con carga diferida.
 */

/** Marcador de «sin imagen». Vive en `public/`, asi que se sirve por ruta absoluta. */
export const MISSING_IMAGE_SRC = '/inv_not_found.png';

/**
 * Lado de la miniatura en px. Cuadrada para que ninguna fila cambie de alto segun su imagen.
 *
 * 60 y no 40 desde el 2026-09-07 (decision humana: «un 50% mas grande»); 80 desde el 2026-10-14
 * (decision humana: de 60 a 80, centrada en su columna). El numero vive aqui y
 * la clase de Tailwind se deriva de el en el `style`, para que no haya dos sitios que declaren el
 * tamano y puedan divergir -que es lo que pasaba con `size-10` y `width`/`height` a la vez-.
 */
const THUMBNAIL_SIZE = 80;

export const ENTITY_IMAGE_ZOOM_TRIGGER_TESTID = 'entity-image-zoom';
export const ENTITY_IMAGE_ZOOM_TESTID = 'entity-image-zoom-view';
export const ENTITY_IMAGE_ZOOM_LABEL = 'Ver imagen en grande';

export type EntityImageProps = {
  /** URL servible de la imagen, o `null` si la fila no tiene. */
  readonly path: string | null;
  /**
   * Nombre de la fila. Se usa para el texto alternativo, que describe A QUE pertenece la imagen;
   * la miniatura no es decorativa -identifica la fila-, asi que no lleva `alt` vacio.
   */
  readonly name: string;
  readonly testId?: string;
  /** `thumbnail`: miniatura de fila. `fill`: hueco cuadrado de ancho completo. */
  readonly size?: 'thumbnail' | 'fill';
  /** Texto alternativo cuando `name` es vacío. */
  readonly emptyAlt?: string;
};

export function EntityImage({
  path,
  name,
  testId,
  size = 'thumbnail',
  emptyAlt,
}: EntityImageProps) {
  const [fallo, setFallo] = useState(false);
  const usaMarcador = path === null || path === '' || fallo;
  const alt = name === '' && emptyAlt !== undefined ? emptyAlt : name;

  if (size === 'fill') {
    return (
      <div className="flex w-full items-center justify-center overflow-hidden rounded-xl border bg-muted aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={path ?? ''}
          src={usaMarcador ? MISSING_IMAGE_SRC : path}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFallo(true)}
          className="h-full w-full object-contain"
          data-testid={testId}
          data-missing={usaMarcador ? 'true' : undefined}
        />
      </div>
    );
  }

  const thumbnail = (
    // `<img>` y no `next/image`: ver el docblock.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={usaMarcador ? MISSING_IMAGE_SRC : path}
      alt={alt}
      width={THUMBNAIL_SIZE}
      height={THUMBNAIL_SIZE}
      loading="lazy"
      decoding="async"
      // Una vez en marcador, `src` ya no vuelve a fallar: `onError` se desarma solo.
      onError={() => setFallo(true)}
      style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
      className="shrink-0 rounded-md border object-cover"
      data-testid={testId}
      data-missing={usaMarcador ? 'true' : undefined}
    />
  );

  // El boton envuelve SIEMPRE la miniatura, tambien al marcador: si el arbol cambiara al fallar la
  // carga, la `<img>` se volveria a montar. Con marcador queda deshabilitado: no hay nada que ampliar.
  return (
    <Dialog>
      <DialogTrigger
        disabled={usaMarcador}
        className="inline-flex shrink-0 cursor-zoom-in rounded-md align-middle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default"
        aria-label={usaMarcador ? undefined : `${ENTITY_IMAGE_ZOOM_LABEL}: ${alt}`}
        data-testid={ENTITY_IMAGE_ZOOM_TRIGGER_TESTID}
      >
        {thumbnail}
      </DialogTrigger>
      {/* El popup solo se monta al abrir: la imagen grande no se pide hasta entonces. */}
      <DialogContent className="w-auto max-w-[calc(100vw-2rem)] p-2 pt-10 sm:max-w-[min(90vw,64rem)]">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={path ?? ''}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="mx-auto max-h-[80vh] w-auto max-w-full rounded-md object-contain"
          data-testid={ENTITY_IMAGE_ZOOM_TESTID}
        />
      </DialogContent>
    </Dialog>
  );
}
