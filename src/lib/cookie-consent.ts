export interface ConsentPreferences {
  necessary: true; // always on — session/role cookies required for login to function
  analytics: boolean;
  marketing: boolean;
}

export const CONSENT_STORAGE_KEY = "chinexa-cookie-consent";
export const CONSENT_VERSION = 1;

interface StoredConsent {
  version: number;
  preferences: ConsentPreferences;
  decidedAt: number;
}

export const DEFAULT_PREFERENCES: ConsentPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export function getStoredConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveConsent(preferences: ConsentPreferences) {
  try {
    const payload: StoredConsent = { version: CONSENT_VERSION, preferences, decidedAt: Date.now() };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("chinexa-consent-updated", { detail: preferences }));
  } catch {}
}
