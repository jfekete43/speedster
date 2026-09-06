import type { Cosmetics, HatId } from '@speedster/shared';

export interface Profile {
  name: string;
  cosmetics: Cosmetics;
  unlockedHats: HatId[];
}

const STORAGE_KEY = 'speedster_profile_v1';

function defaultProfile(): Profile {
  return {
    name: 'Runner',
    cosmetics: { color: '#4fd1c5', hat: 'none' },
    unlockedHats: ['none', 'top_hat'],
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw);
    const fallback = defaultProfile();
    return {
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : fallback.name,
      cosmetics: parsed.cosmetics && typeof parsed.cosmetics.color === 'string' ? parsed.cosmetics : fallback.cosmetics,
      unlockedHats: Array.isArray(parsed.unlockedHats) ? parsed.unlockedHats : fallback.unlockedHats,
    };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable (private browsing, etc.) - the profile just won't persist.
  }
}

export const COLOR_OPTIONS = ['#4fd1c5', '#f56565', '#ecc94b', '#9f7aea', '#63b3ed', '#f687b3', '#68d391', '#f6ad55'];

export const HAT_CATALOG: { id: HatId; label: string; unlockHint: string }[] = [
  { id: 'none', label: 'No Hat', unlockHint: 'Always available' },
  { id: 'top_hat', label: 'Top Hat', unlockHint: 'Always available' },
  { id: 'crown', label: 'Crown', unlockHint: 'Win a race (finish 1st)' },
];
