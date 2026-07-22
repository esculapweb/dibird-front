import { Config } from "../constants/config";

// Taxon images come back in three shapes depending on the endpoint:
// an absolute URL (group lists are serialized by an ImageField), a raw
// stored path (species rows come from a `.values()` queryset), or a
// server-absolute route (e.g. /image_taxon/..., the full-size photo proxy)
// that lives at the API host root rather than under /media/.
export const resolveTaxonImage = (path?: string | null): string | null => {
  if (!path) return null;
  if (path.includes("://")) return path;
  if (path.startsWith("/")) return `${Config.baseUrl}${path}`;
  return `${Config.mediaUrl}/${path}`;
};

// List/tree rows carry `name` as a display string — "Osprey / Pandion
// haliaetus" when the localized name differs from the scientific one, plain
// Latin otherwise (see the backend's generate_name). This pulls out just the
// scientific part, and returns "" when it would only repeat the title.
export const latinPart = (
  name?: string | null,
  nameLang?: string | null,
): string => {
  if (!name) return "";
  const separator = name.indexOf(" / ");
  if (separator !== -1) return name.slice(separator + 3);
  return name === nameLang ? "" : name;
};

// Per-country status comes from Avibase as untranslated English free text,
// but it is a closed set of 16 values — map it onto our own locale keys and
// fall back to the raw string if Avibase ever adds one.
const COUNTRY_STATUS_KEYS: Record<string, string> = {
  "rare/accidental": "country_status_rare_accidental",
  endemic: "country_status_endemic",
  "near-endemic": "country_status_near_endemic",
  "breeding endemic": "country_status_breeding_endemic",
  "endemic (country/region)": "country_status_endemic_country",
  "introduced species": "country_status_introduced",
  "uncertain origin": "country_status_uncertain_origin",
  extirpated: "country_status_extirpated",
  "outlying islands only": "country_status_outlying_islands",
  extinct: "country_status_extinct",
  "extinct in the wild": "country_status_extinct_wild",
  "critically endangered": "country_status_critically_endangered",
  endangered: "country_status_endangered",
  vulnerable: "country_status_vulnerable",
  "near-threatened": "country_status_near_threatened",
  "data deficient": "country_status_data_deficient",
};

export const countryStatusKey = (status?: string | null): string | null =>
  status ? (COUNTRY_STATUS_KEYS[status.trim().toLowerCase()] ?? null) : null;

// IUCN Red List category colours, as used on the Red List itself — they are
// part of the category's meaning, so they stay fixed in both themes and only
// the text on top switches for contrast.
const IUCN_BACKGROUNDS: Record<string, string> = {
  EX: "#000000",
  EW: "#542344",
  CR: "#D81E05",
  EN: "#FC7F3F",
  VU: "#F9E814",
  NT: "#CCE226",
  LC: "#60C659",
  DD: "#D1D1C6",
  NE: "#E8E8E8",
};

const IUCN_LIGHT_TEXT = ["EX", "EW", "CR", "EN"];

export const iucnColors = (
  code?: string | null,
): { background: string; text: string } | null => {
  if (!code) return null;
  // "CR (PE)" (possibly extinct) is a qualifier on CR, not its own category.
  const base = code.split(" ")[0].toUpperCase();
  const background = IUCN_BACKGROUNDS[base];
  if (!background) return null;
  return {
    background,
    text: IUCN_LIGHT_TEXT.includes(base) ? "#FFFFFF" : "#1E2A36",
  };
};
