import type { StatusTone } from '@/lib/shared/ui/status-tone';

import type { VersionLineMark } from './recipe-version-diff';

export const RECIPE_VERSION_MARK_TONES: Record<VersionLineMark['kind'] | 'removed', StatusTone> = {
  same: 'neutral',
  changed: 'waiting',
  added: 'success',
  removed: 'danger',
};

export const RECIPE_VERSION_UNDER_REVIEW_TONE: StatusTone = 'waiting';
export const RECIPE_VERSION_UNDER_REVIEW_LABEL = 'Por revisar';
