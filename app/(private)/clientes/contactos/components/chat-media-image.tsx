'use client';

import { ImageIcon, ImageOff, Sticker } from 'lucide-react';

import { cn } from '@/lib/utils';

import { CHAT_IMAGE_TEXT } from './contact-texts';

export type ChatMediaImageProps = {
  readonly kind: 'image' | 'sticker';
  readonly src: string | null;
  readonly caption?: string | null;
  /** El fallo de carga lo guarda el mensaje: la miniatura y el visor comparten el mismo estado. */
  readonly failed: boolean;
  readonly onError: () => void;
  /** `thumbnail`: en la burbuja o como sticker. `full`: dentro del visor. */
  readonly size?: 'thumbnail' | 'full';
};

const BOX_BY_KIND = {
  image: 'h-45 w-70 max-w-full rounded-md',
  sticker: 'size-32 rounded-2xl',
} as const;

const FULL_BOX = 'h-[60dvh] w-full max-w-4xl rounded-lg';

export function ChatMediaImage({ kind, src, caption = null, failed, onError, size = 'thumbnail' }: ChatMediaImageProps) {
  const box = size === 'full' ? FULL_BOX : BOX_BY_KIND[kind];

  if (src === null || failed) {
    const placeholder =
      src === null ? (kind === 'image' ? CHAT_IMAGE_TEXT.imagePlaceholder : CHAT_IMAGE_TEXT.stickerPlaceholder) : CHAT_IMAGE_TEXT.unavailable;
    const Icon = src !== null ? ImageOff : kind === 'image' ? ImageIcon : Sticker;
    return (
      <span
        data-media-state={src === null ? 'missing' : 'failed'}
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 bg-muted text-xs text-muted-foreground',
          kind === 'sticker' && size === 'thumbnail' && 'border border-dashed',
          box,
        )}
      >
        <Icon aria-hidden="true" className="size-8" />
        {placeholder}
      </span>
    );
  }

  const alt = caption ?? (kind === 'image' ? CHAT_IMAGE_TEXT.imageAlt : CHAT_IMAGE_TEXT.stickerAlt);
  return (
    // `<img>` y no `next/image`: la ruta del medio es relativa, privada y va con la sesión, y el
    // optimizador no la sirve.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={onError}
      className={cn(box, size === 'full' || kind === 'sticker' ? 'object-contain' : 'object-cover')}
    />
  );
}
