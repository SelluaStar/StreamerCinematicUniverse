/**
 * Stream discovery language / region preference.
 *
 * A single preference value drives how "top live" / discovery streams are
 * prioritised. It can be:
 *   - "any"   → no language filter (show everything, like the original behaviour)
 *   - "other" → only streams whose language is NOT in the curated list below
 *   - a Twitch/ISO 639-1 code (e.g. "en", "es") → prioritise that content language
 *
 * Twitch Get Streams supports a `language` query param (ISO 639-1), so a specific
 * code is applied server-side. "other" is applied by client-filtering results.
 */

export type StreamLanguagePreference = string; // "any" | "other" | ISO 639-1 code

export const DEFAULT_STREAM_LANGUAGE: StreamLanguagePreference = "en";

/** Curated content languages, using Twitch language codes (ISO 639-1). */
export const CURATED_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ru", label: "Russian" },
  { code: "it", label: "Italian" },
  { code: "tr", label: "Turkish" },
  { code: "pl", label: "Polish" },
  { code: "ar", label: "Arabic" },
];

/** Fast lookup of curated codes for the "other" filter. */
export const CURATED_LANGUAGE_CODES = new Set(CURATED_LANGUAGES.map((entry) => entry.code));

export const REGION_MODE_ANY = "any";
export const REGION_MODE_OTHER = "other";

/** localStorage keys used for guests (and as an offline cache for signed-in users). */
export const STREAM_LANGUAGE_STORAGE_KEY = "scu-stream-language";
export const STREAM_REGION_STORAGE_KEY = "scu-stream-region";

/** All selectable options, in display order, with friendly labels. */
export type StreamLanguageOption = {
  value: StreamLanguagePreference;
  label: string;
  description?: string;
};

export const STREAM_LANGUAGE_OPTIONS: StreamLanguageOption[] = [
  { value: REGION_MODE_ANY, label: "Any", description: "No language filter — show all streams." },
  ...CURATED_LANGUAGES.map((entry) => ({ value: entry.code, label: entry.label })),
  { value: REGION_MODE_OTHER, label: "Other", description: "Languages outside the main list." },
];

export function isKnownStreamLanguage(value: string | null | undefined): value is StreamLanguagePreference {
  if (!value) return false;
  return value === REGION_MODE_ANY || value === REGION_MODE_OTHER || CURATED_LANGUAGE_CODES.has(value);
}

export function normalizeStreamLanguage(value: string | null | undefined): StreamLanguagePreference {
  if (!value) return DEFAULT_STREAM_LANGUAGE;
  const trimmed = value.trim().toLowerCase();
  return isKnownStreamLanguage(trimmed) ? trimmed : DEFAULT_STREAM_LANGUAGE;
}

/** Friendly label for a stored preference value. */
export function streamLanguageLabel(value: string | null | undefined): string {
  const normalized = normalizeStreamLanguage(value);
  return STREAM_LANGUAGE_OPTIONS.find((option) => option.value === normalized)?.label ?? "Any";
}

/**
 * The Helix `language` query param for a preference, or undefined when the
 * request must be made without a language filter ("any" or "other").
 */
export function helixLanguageParam(value: string | null | undefined): string | undefined {
  const normalized = normalizeStreamLanguage(value);
  if (normalized === REGION_MODE_ANY || normalized === REGION_MODE_OTHER) return undefined;
  return normalized;
}

/**
 * Split a stored preference into the two profile columns:
 *   region_mode: "any" | "specific" | "other"
 *   preferred_language: the ISO code (only for "specific"), otherwise null
 */
export function toProfileColumns(value: string | null | undefined): {
  region_mode: string;
  preferred_language: string | null;
} {
  const normalized = normalizeStreamLanguage(value);
  if (normalized === REGION_MODE_ANY) return { region_mode: REGION_MODE_ANY, preferred_language: null };
  if (normalized === REGION_MODE_OTHER) return { region_mode: REGION_MODE_OTHER, preferred_language: null };
  return { region_mode: "specific", preferred_language: normalized };
}

/** Rebuild the single preference value from the two profile columns. */
export function fromProfileColumns(input: {
  region_mode?: string | null;
  preferred_language?: string | null;
}): StreamLanguagePreference {
  const mode = input.region_mode?.trim().toLowerCase();
  if (mode === REGION_MODE_ANY) return REGION_MODE_ANY;
  if (mode === REGION_MODE_OTHER) return REGION_MODE_OTHER;
  if (mode === "specific") return normalizeStreamLanguage(input.preferred_language);
  // Older/looser rows may store the code directly in region_mode.
  if (isKnownStreamLanguage(mode)) return mode as StreamLanguagePreference;
  return normalizeStreamLanguage(input.preferred_language);
}
