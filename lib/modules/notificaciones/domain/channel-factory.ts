import type { ChannelKey, NotificationChannel } from '../ports/notification-channel';

export type ChannelRegistry = Partial<Record<ChannelKey, NotificationChannel>>;

export type ChannelFactory = {
  /** Los canales registrados de `keys`, en su orden. Uno sin registrar se omite. */
  channelsFor(keys: readonly ChannelKey[]): readonly NotificationChannel[];
};

export function createChannelFactory(registry: ChannelRegistry): ChannelFactory {
  return {
    channelsFor: (keys) => keys.flatMap((key) => registry[key] ?? []),
  };
}
