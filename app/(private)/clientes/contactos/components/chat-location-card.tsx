import { MapPin } from 'lucide-react';

import { CHAT_LOCATION_TEXT } from './contact-texts';

export type ChatLocationCardProps = {
  readonly latitude: number;
  readonly longitude: number;
  readonly name: string | null;
  readonly address: string | null;
};

export function mapUrlFor(latitude: number, longitude: number): string {
  const params = new URLSearchParams({ api: '1', query: `${latitude},${longitude}` });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function ChatLocationCard({ latitude, longitude, name, address }: ChatLocationCardProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
        <MapPin aria-hidden="true" className="size-3.5" />
        {CHAT_LOCATION_TEXT.title}
      </span>
      <a
        href={mapUrlFor(latitude, longitude)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-70 max-w-full flex-col overflow-hidden rounded-md border bg-card text-card-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex h-27.5 items-center justify-center bg-success-subtle text-primary">
          <MapPin aria-hidden="true" className="size-7" />
        </span>
        <span className="flex flex-col gap-0.5 px-2.5 py-2">
          {name !== null && <span className="text-[13px] font-semibold">{name}</span>}
          {address !== null && <span className="text-xs text-muted-foreground">{address}</span>}
          <span className="text-xs font-medium text-primary">{CHAT_LOCATION_TEXT.openMap}</span>
        </span>
      </a>
    </div>
  );
}
