import { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleProp, ViewStyle } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { CompositeNavigationProp, RouteProp } from "@react-navigation/native";
import { AxiosResponse } from "axios";
import { QueryObserverResult } from "@tanstack/react-query";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";
// Type only: services/analytics pulls in services/errors, which imports from
// here — at runtime this import is erased and there is no cycle.
import type { GatedAction, SpeciesEntryPoint } from "./services/analytics";

// Re-exported so screens and components keep importing their types from one
// place; the definition stays next to the event that reads it.
export type { SpeciesEntryPoint };

export type IconType = ComponentProps<typeof Ionicons>["name"];
export type StyleType = StyleProp<ViewStyle>;
export type Theme = "light" | "dark";

export interface IconButtonConfig extends IconButtonProps {
  condition: boolean;
}

export type Coords = [number, number];

export type LocationCoords = { lat: number | null; lng: number | null } | null;

export type LocationType = {
  type: string;
  coordinates: Coords;
  // Only on the bbox polygon the backend substitutes for a private location
  // (`generate_bbox_polygon` in myapi/serializers.py): the centroid of the
  // ring, so a map has something to centre on without unpacking the polygon.
  center?: Coords;
};

export type PolygonGeometry = {
  type: "Polygon";
  coordinates: Coords[][];
};

export interface AppError extends Error {
  code: string;
  status?: number;
  title?: string;
  isTimeout?: boolean;
  isNetworkError?: boolean;
  isServerError?: boolean;
  originalError?: unknown;
  response?: AxiosResponse;
}

export type ErrorExtractor = (error: AppError) => {
  title: string;
  message: string;
};

export interface UIError {
  code: string;
  status?: number;
  title: string;
  message: string;
}

export interface Errors {
  date_time?: string | boolean | null;
  territory?: string;
  species?: string;
  quantity?: string;
  notes?: string;
  name?: string;
}

export type ApiErrorToast = {
  title: string;
  message: string;
};

export type ErrorCode =
  | "TIMEOUT"
  | "NETWORK"
  | "SERVER"
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "UNKNOWN";

interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

export interface EmptyStateProps {
  icon?: IconType;
  message: string;
  actions?: EmptyStateAction[];
}

export type FetchFunction<T> = (
  filters: Filters,
  sort: string | null,
  search: string,
  page: number,
  locationCoords?: Coords | null,
) => Promise<PaginatedResponse<T>>;

export interface QueryType {
  data: DropdownItem[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => Promise<QueryObserverResult<DropdownItem[], AppError>>;
}

export interface Credentials {
  email: string;
  password: string;
  userName?: string;
  confirmPassword?: string;
}

export interface CredentialsValidation {
  email: boolean;
  password: boolean;
  userName: boolean;
  confirmPassword: boolean;
}

export type ExportStatus =
  | "idle"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

export interface GdprExport {
  id: number;
  status: ExportStatus;
  download_token?: string;
  created_at: string;
  downloaded_at: string;
  expires_at: string;
}

/** The import has no `expired`: the file is deleted right away, there is nothing to store. */
export type ObservationImportStatus =
  | "idle"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface ObservationImport {
  id: number;
  status: Exclude<ObservationImportStatus, "idle">;
  source: "ebird";
  make_public: boolean;
  /** Rows in the file. */
  total: number;
  imported: number;
  skipped: number;
  /** Latin names missing from the taxonomy; truncated by the backend. */
  unmatched: string[];
  created_at: string;
  finished_at: string | null;
}

interface UserData {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
}

export interface OwnerData {
  avatar: string;
  first_name: string;
  id: number;
  last_name: string;
  private: boolean;
  timezone_id: string;
  username: string;
}

export interface Profile {
  user_data: UserData;
  avatar: string;
  avatar_thumbnail: string;
  private: boolean;
  private_diary: boolean;
  user: number | null;
  registration_ip: string;
  timezone: string;
  territory?: number | null;
  // Local file:// URI for an avatar upload/removal made while offline, not
  // yet synced to the server — see profileRepository.queuePendingAvatar.
  pendingAvatarUri?: string | null;
  pendingAvatarOp?: "upload" | "delete" | null;
}

export interface ImageAsset {
  uri: string;
  width?: number;
  height?: number;
}

export interface AvatarResponse {
  avatar_thumbnail: string;
}

export type seenMode = "seen" | "unseen" | "all";
export type compareMode = "common" | "different" | "all";

// Which half of a country page is open: its birds (what the page is for) or
// its description. Travels in shared links as `tab` — see taxonShareLink.ts.
export type territoryTab = "species" | "info";
// How that country's birds are laid out: the taxonomic tree ("by groups") or
// the plain sortable list. Travels in shared links as `view`.
export type territoryView = "tree" | "flat";

export interface TabOption<T extends string = string> {
  value: T;
  icon: IconType;
  iconInactive: IconType;
  labelKey: string;
  count?: number;
}

export type SpeciesDetailTab =
  | "overview"
  | "traits"
  | "sounds"
  | "countries"
  | "names";

export type DateFilterType =
  | "all"
  | "today"
  | "this_year"
  | "range"
  | "exact"
  | "year";

export type DateFilter = {
  type?: "all" | "today" | "this_year" | "range" | "year";
  year?: number | null;
  from?: string | null;
  to?: string | null;
  mode?: "any" | "exact" | "range";
  this_year?: boolean | null;
  today?: boolean | null;
} | null;

// Who made the observation: a person in the app (no external source on the
// row) or the eBird import. Matches the `source=` query param of the
// community feed (see ObservationFilterSet.filter_source on the backend).
export type ObservationSource = "dibird" | "ebird";

export type AllowedFilterKey =
  | "territory"
  | "date"
  | "place"
  | "species"
  | "favourite"
  | "unsynced"
  | "private"
  | "radius"
  | "source"
  | "has_photo";

export interface Filters {
  date?: DateFilter | null;
  date_time_max?: string | null;
  date_time_min?: string | null;
  diary?: number | null;
  favourite?: boolean | null;
  new?: boolean;
  o?: string | null;
  place?: number | null;
  profile1?: number | null;
  profile2?: number | null;
  seen?: boolean | null;
  species?: number | null;
  speciesName?: string;
  // Own lists only (observations/diaries): true — only what is hidden from
  // everyone else, false — only what is published. Nobody else's list can
  // carry a private record at all.
  private?: boolean | null;
  // Community feed only: "dibird" is `external_source IS NULL` server-side
  // (a record made by a person in the app), "ebird" is the import.
  source?: ObservationSource | null;
  tab?: seenMode | compareMode | null;
  territory?: number | null;
  user_id?: number | null;
  year?: number | null;
  // Kilometres around the device's current position, sent together with
  // lng/lat (see fetchPlaces/fetchCommunityObservations) — without them the
  // server has no centre to apply it to and ignores the filter.
  radius?: number | null;
  // A scope preset computed entirely by the server: `alerts` is the territory and
  // the radius around the point from the alert settings. Coordinates are not sent
  // with it, the backend already has the centre (see components/Main/RareNearby.tsx).
  near?: "alerts" | null;
  // Client-only: never sent to the server (see util/fetches.ts's
  // fetchObservations/fetchDiaries/fetchPlaces) — filters the list down to
  // items with a queued local create/update/delete that hasn't synced yet.
  unsynced?: boolean | null;
  // Species rare for the country the observation was made in — the community
  // feed only (see ObservationFilterSet.filter_rare on the backend).
  rare?: boolean | null;
  // Observations that carry photos (true) or that carry none (false); a
  // missing value means the list isn't filtered by photos at all. Server-side
  // on both the own list and the community feed (see
  // ObservationFilterSet.filter_has_photo on the backend).
  has_photo?: boolean | null;
}

export type AllFiltersKey = keyof Filters;

export interface PaginatedResponse<T> {
  pagination: {
    count: number;
    per_page: number;
    current: number;
    final: number;
    next: number | null;
    previous: number | null;
  };
  results: T[];
}

export interface StatPaginatedResponse<T> extends PaginatedResponse<T> {
  total_species: number;
  seen_species: number;
}

export const emptyPaginatedResponse = <T>(): PaginatedResponse<T> => ({
  results: [],
  pagination: {
    count: 0,
    per_page: 0,
    current: 1,
    final: 1,
    next: null,
    previous: null,
  },
});

export interface DropdownItem {
  value: string | number;
  label: string;
  name_lang?: string;
  icon?: string | null;
  iconLabel?: IconType | null;
  iconLabelRight?: IconType | null;
  distance?: number | null;
}

export interface SpeciesDropdownItem extends DropdownItem {
  name?: string;
  thumb?: string;
  seen?: boolean;
  segment?: string;
  ioc_id?: number;
}

export interface PlaceDropdownItem extends DropdownItem {
  preview?: string;
  location?: LocationType;
  distance?: number;
  name?: string;
}

export interface TerritoryDropdownItem extends DropdownItem {
  code: string;
}

export interface SpeciesItem {
  species_id: number;
  sp_name: string;
  sp_latin: string;
  sp_name_lang: string;
  sp_thumb: string | null;
  segment: string;
  seen: boolean;
  // IUCN category code. Absent from responses cached before the backend
  // started sending it.
  status?: string | null;
  min_date: string | null;
  max_date: string | null;
  qty_observations: number | null;
  qty_countries: number | null;
  min_created_at: string | null;
  min_territory: string | null;
  max_territory: string | null;
  // Not sorted client-side without this: taxonomic order (ioc_id/-ioc_id) has
  // no other reproducible field, so offline re-sort silently no-ops until the
  // backend adds it to /myapi/stat2/ results.
  ioc_id?: number;
}

export interface ChecklistItem {
  latin: string;
  name_lang: string;
  segment: string;
  seen: boolean;
  species_id?: number;
  id?: number;
  // IUCN category code ("LC", "VU", …).
  status: string | null;
  // How the species occurs on that particular territory ("Rare/Accidental",
  // "Endemic", …) — Avibase free text, mapped by territoryStatusNote. Absent
  // from responses cached before the backend started sending it.
  occurrence?: string | null;
  thumb: string | null;
  type: "order" | "family" | "genus" | "species";
  total?: number;
  seen_count?: number;
}

export interface SpeciesData {
  id: number;
  name: string;
  name_lang: string;
  segment: string;
  thumb: string | null;
  // IUCN category code. Absent from responses cached before the backend
  // started sending it.
  status?: string | null;
}

// Taxonomy catalog (order -> family -> genus -> species), backed by
// /api/taxon/ and /api/taxon/<segment>/ — ranks match settings.RANKS on the
// backend (1 is unused/root, 2..5 are the browsable levels).
export type TaxonRank = 2 | 3 | 4 | 5;

export interface TaxonListItem {
  name: string;
  name_lang: string;
  segment: string;
  thumb?: string | null;
  status?: string | null;
  status_name?: string | null;
  s_id?: number | null;
  // How the species occurs on the territory the list is filtered by
  // ("Rare/Accidental", …) — sent only for a `territory` filtered list, and
  // the same free English text the checklist tree carries (see
  // territoryStatusNote).
  occurrence?: string | null;
}

export interface TaxonSibling {
  segment: string;
  name: string;
  name_lang: string;
  thumb?: string | null;
}

export interface TaxonParentCrumb {
  depth: number;
  parent_name: string;
  parent_name_lang: string;
  parent_segment: string;
}

export interface TaxonDescendant {
  depth: number;
  numchild: number;
  thumb: string | null;
  d_name: string;
  d_name_lang: string;
  d_segment: string;
  // IUCN category code ("LC", "VU", …) — the status table is keyed by code.
  d_status: string | null;
  s_id: number | null;
}

interface TaxonDetailBase {
  taxon_id: number;
  name: string;
  name_lang: string;
  latin_name: string;
  segment: string;
  extinct: boolean;
  metadata: {
    title: string;
    meta_description: string;
    h1: string;
    short: string;
    image: string | null;
  };
  alternates: { lang_id: string; segment: string }[];
  // Keyed by child rank id; each value is already a fully localized,
  // number-agreed label (e.g. {"5": "2 вида"}), not a plain count.
  count: Record<string, string> | null;
  paging: {
    prev: TaxonSibling | null;
    next: TaxonSibling | null;
  };
  redirect?: string;
}

// Order/Family/Genus detail: a description plus its direct children.
export interface TaxonGroupDetail extends TaxonDetailBase {
  parents?: TaxonParentCrumb[];
  descendants: TaxonDescendant[];
}

export interface TaxonSubspecies {
  name: string;
  extinct: boolean;
  authority: string;
  breeding_subregion: string | null;
  nonbreeding_region: string | null;
  // The same ranges with the IOC shorthand spelled out and localized by the
  // backend ("w, c" -> "запад, центр"). Absent on responses cached before
  // the field existed, hence optional.
  breeding_subregion_text?: string | null;
  nonbreeding_region_text?: string | null;
}

export interface TaxonPhoto {
  thumb: string;
  url: string;
  ownername: string;
}

export interface TaxonSound {
  xeno_id: number;
  type: string;
  recorder: string;
  country: string;
  // Nullable on the backend (`Xeno.license`): for some recordings the licence has
  // not been pulled in yet by the `xeno --license` command.
  license: string | null;
  sound?: string;
}

export interface TaxonRelated {
  count: number;
  species: { name: string; name_lang: string; segment: string; thumb: string | null }[];
}

export interface TaxonCountry {
  code: string;
  name: string;
  segment: string;
  status: string;
  region: string | null;
}

export interface TaxonMultilangs {
  // Keyed by ISO 639-1 code; `label` is the language's name already
  // localized to the current UI language by the backend.
  langs: Record<string, { label: string; names: string[] }>;
  synonyms: string[];
  protonyms: string[];
}

// Trait filters accepted by /api/taxon/ (see the backend's
// TaxonMetaFilterSet). Ranges are in the trait's own units — grams for mass,
// eggs for clutch — and the multi-selects are sent comma-separated.
export interface TaxonTraitFilters {
  mass_min?: number | null;
  mass_max?: number | null;
  clutch_min?: number | null;
  clutch_max?: number | null;
  habitat?: string[];
  migration?: string[];
  trophic_level?: string[];
  trophic_niche?: string[];
  // IUCN categories, by their code ("EN", "CR (PE)") — the API takes them
  // comma-separated, like the trait vocabularies.
  status?: string[];
  // Distribution filter: api.Territory id from the country dropdown; the
  // catalogue keeps only species that occur in this territory.
  territory?: number | null;
}

export type TaxonTraitFilterKey = keyof TaxonTraitFilters;

export interface TraitFilterOption {
  value: string;
  label: string;
  count: number;
}

// /api/trait-filters/ — what the filter sheet can offer, straight from the
// data (so a vocabulary added upstream shows up without an app release).
export interface TraitFilterOptions {
  mass: { units: string; min: number | null; max: number | null };
  clutch: { units: string; min: number | null; max: number | null };
  habitat: TraitFilterOption[];
  migration: TraitFilterOption[];
  trophic_level: TraitFilterOption[];
  trophic_niche: TraitFilterOption[];
  // IUCN categories, in the Red List's own order (most threatened first) —
  // it is a scale, so unlike the vocabularies it is not sorted by count.
  // Absent from responses cached before the backend started sending it.
  status?: TraitFilterOption[];
}

// Curated facts from Avibase (body measurements, diet, breeding, lifespan),
// already grouped, localized and formatted by the backend — the app only
// prints what it gets.
export interface TaxonTrait {
  key: string;
  label: string;
  value: string;
  // Raw number behind `value` (null for categorical traits) — the compare
  // screen needs it to tell which species is bigger, since `value` is both
  // localized and sometimes rescaled (3350 g -> "3,35 кг").
  num: number | null;
  // Measurements are averaged across every source that has them: how many
  // agreed, how far apart they were ("3,4–3,45 кг"), and the already
  // localized "2 источника". Empty/1 when a single source had the figure.
  sample_size: number;
  spread: string;
  sources_label: string;
  male: string | null;
  female: string | null;
  source: string;
  source_url: string | null;
}

export interface TaxonTraitGroup {
  key: string;
  label: string;
  traits: TaxonTrait[];
}

export interface TaxonTraitHighlight {
  key: string;
  label: string;
  value: string;
}

// Species detail (rank 5) — the richest of the taxon detail shapes.
export interface TaxonSpeciesDetail extends TaxonDetailBase {
  status: { status_id: string; name: string; s_id: number } | null;
  authority: string;
  breeding_regions: string[];
  breeding_subregion: string | null;
  nonbreeding_region: string | null;
  breeding_subregion_text?: string | null;
  nonbreeding_region_text?: string | null;
  parents: TaxonParentCrumb[];
  subspecies: TaxonSubspecies[];
  photos: TaxonPhoto[];
  sounds: TaxonSound[];
  related: TaxonRelated;
  countries: TaxonCountry[];
  multilangs: TaxonMultilangs;
  // Absent on responses cached before traits existed.
  traits?: TaxonTraitGroup[];
  trait_highlights?: TaxonTraitHighlight[];
}

// Countries and territories catalogue, backed by /api/territory/ (list and
// detail), /api/checklist/ (a territory's species tree) and
// /api/territory-compare/. Not to be confused with TerritoryDropdownItem,
// which is the user's own filter dropdown.
export interface TerritoryListItem {
  name: string;
  segment: string;
  // ISO-3166 alpha-2 ("AR"), rendered as a flag through isoToFlagEmoji.
  code: string | null;
  // Localized region name ("South America"). A plain string here, unlike the
  // detail response's `region` object; absent from responses cached before the
  // backend started sending it.
  region_name?: string | null;
  // A paragraph of HTML, not plain text.
  short: string | null;
  // Same shape as TaxonDetailBase.count: localized, number-agreed labels
  // keyed by rank ({"5": "1111 species"}), not numbers.
  count: Record<string, string> | null;
}

// One option of the country list's region filter (/api/region-list/), already
// narrowed to the regions /api/territory/?region= actually accepts.
export interface TerritoryRegionOption {
  id: number;
  label: string;
}

export interface TerritoryDetail {
  // Avibase's own territory id, used by the site's /api/checklist/.
  id_avibase: number;
  // Our own Territory.pk — the key /myapi/checklist2/ and /api/taxon/'s
  // `territory` filter take. Absent from responses cached before the backend
  // started sending it.
  territory_id?: number | null;
  name: string;
  // Locative form of the name ("in Argentina") where the language has one.
  name_loct: string | null;
  code: string | null;
  metadata: {
    title: string;
    meta_description: string;
    h1: string;
    short: string;
  } | null;
  region: {
    name: string;
    code_google: string | null;
    name_gent: string;
  } | null;
  count: Record<string, string> | null;
  paging: {
    // `code` (ISO-3166 alpha-2, for the flag) is absent from responses cached
    // before the backend started sending it.
    prev: { segment: string; name: string; code?: string | null } | null;
    next: { segment: string; name: string; code?: string | null } | null;
  } | null;
  alternates: { lang_id: string; segment: string }[];
  // Set instead of the rest of the payload when the segment has been renamed
  // (see BaseViewSet.retrieve on the backend) — the response is partial then.
  redirect?: string;
}

// One row of /api/territory-compare/: a species and whether each of the two
// territories has it.
export interface TerritoryCompareSpecies {
  name: string;
  name_lang: string;
  segment: string;
  status: string | null;
  // Raw stored path (the row comes from a .values() queryset) — resolve it
  // through resolveTaxonImage. Absent from responses cached before the
  // backend started sending it.
  thumb?: string | null;
  in_object: [boolean, boolean];
}

export interface TerritoryCompareResponse {
  all_count: number;
  common_count: number;
  different_count: number;
  territory_data: { name: string; segment: string; code: string | null }[];
  // Species totals per territory, and how many of them the other one lacks.
  territory_all_count: [number, number];
  territory_diff_count: [number, number];
  species_data: TerritoryCompareSpecies[];
}

export interface DiaryFormData {
  territory: number | null;
  date_time?: string | null;
  private?: boolean;
  place?: number | null;
  location_private: boolean;
  notes?: string | null;
  name?: string | null;
}

export interface ObservationFormData {
  species?: number | null;
  territory?: number | null;
  date_time?: string | null;
  private?: boolean;
  place?: number | null;
  location_private: boolean;
  time?: string | null;
  quantity?: number | null;
  notes?: string | null;
  diary?: number | null;
}

export interface ProfileFormData {
  first_name: string;
  last_name: string;
  username: string;
  territory?: number | null;
  timezone?: string;
  private: boolean;
  private_diary: boolean;
}

export interface EditorFormData {
  territory: number | null;
  place: number | null;
  date_time: string | null | undefined;
  time: string | null;
  private: boolean | undefined;
  location_private: boolean;
  quantity: number | null;
  notes: string | null;
  name?: string | null;
  diary: number | null;
  species?: number | null;
}

export interface CountryItem {
  territory_id: number;
  name: string;
  code: string;
  favourite: boolean;
}

export interface PlaceFormData {
  name: string;
  territory: number | null;
  favourite?: boolean;
  location?: LocationType | null;
}

export interface PlaceData {
  id: number;
  // null for someone else's place: the name is the owner's own wording, and
  // the server hands it out only to them (PlaceSimpleSerializer.get_name).
  // Public eBird hotspots keep theirs.
  name: string | null;
  preview: string | null;
  location: LocationType | null;
}

export interface ReverseGeocode {
  name: string;
  country: string;
  country_code: string;
  city: string;
  address: string;
}

export type MapPressEvent = Feature<Geometry, GeoJsonProperties>;

export interface TerritoryData {
  code: string;
  id: number;
  name: string;
  segment: string;
}

interface ObservationBaseItem {
  created_at: string;
  id: number;
  notes: string | null;
  quantity: number | null;
  time: string | null;
}

export interface ObservationPhoto {
  // Negative for a photo picked locally and not uploaded yet — same temp-id
  // convention observation/diary/place already use for unsynced creates.
  id: number;
  // Server-relative media paths (Config.mediaUrl is prefixed by the UI);
  // null while the photo exists only on this device.
  image: string | null;
  thumbnail: string | null;
  sort_order: number;
  created_at: string;
  // Client-only: file:// URI of a pending upload. Kept inside the item so the
  // photo strip renders immediately and still renders after an app restart
  // while offline, exactly like profileTable.pendingAvatarUri does for the
  // avatar. Never sent to the server.
  local_uri?: string;
  _pendingSync?: "pending" | "error";
  _syncError?: string | null;
}

/**
 * Complaint about someone else's content. The server takes exactly one target
 * — an observation, one of its photos, or a profile — and answers 400 to
 * anything else, so this is a union rather than three optional fields.
 */
export type ReportTarget =
  | { observation: number }
  | { photo: number }
  | { target_profile: number };

// Kept in sync with ContentReport.Reason on the server (myapi/models.py): the
// value is stored as sent, an unknown one is a 400. Which of them a user is
// actually offered depends on what is being reported — see REASONS_BY_TARGET
// in hooks/useModeration.tsx.
export const REPORT_REASONS = [
  "sexual",
  "violence",
  "hate",
  "spam",
  "irrelevant",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export interface BlockedUser {
  // The block itself; unblocking is addressed by `blocked` instead — see
  // unblockUser in util/fetches.ts.
  id: number;
  blocked: number;
  blocked_data: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    avatar: string;
  };
  created_at: string;
}

export interface ObservationItem extends ObservationBaseItem {
  date_time: string;
  diary: number | null;
  is_owner: boolean;
  owner: OwnerData;
  place: number | null;
  place_data: PlaceData | null;
  private: boolean;
  species: number;
  species_data: SpeciesData;
  territory?: number | null;
  territory_data: TerritoryData;
  updated_at: string;
  external_source: "ebird" | null;
  // Rare for `territory` — annotated by the community feed only
  // (api/rarity.py annotate_rare), absent everywhere else.
  rare?: boolean;
  external_username: string | null;
  location_private: boolean;
  distance?: number | null;
  // Optional because a row cached before photos existed simply has no such
  // field — every read has to survive that.
  photos?: ObservationPhoto[];
  // Client-only: set when this item has an unsynced local create/update/delete
  // queued (see hooks/repositories/observationRepository.ts). Never sent to the server.
  _pendingSync?: "pending" | "error";
  _syncError?: string | null;
}

export interface DiaryObservationItem extends ObservationBaseItem {
  species_data: SpeciesData;
}

interface DiaryBase {
  date_time: string;
  id: number;
  name: string | null;
  observation_count: number;
  place: number | null;
  place_data: PlaceData | null;
  private: boolean;
  location_private: boolean;
  profile: number;
  territory: number;
  territory_data: TerritoryData;
  // Client-only: set when this item has an unsynced local create/update/delete
  // queued (see hooks/repositories/diaryRepository.ts). Never sent to the server.
  _pendingSync?: "pending" | "error";
  _syncError?: string | null;
}

export interface DiaryItem extends DiaryBase {
  is_owner: boolean;
  owner: OwnerData;
  created_at: string;
  updated_at: string;
  user_data: Omit<OwnerData, "private">;
}

export type EditorItem = DiaryItem & ObservationItem;

export interface DiaryListItem extends DiaryBase {
  observation_data: {
    species_data: {
      name_lang: string;
      segment: string;
      thumb: string;
    };
  }[];
}

export interface PlaceItemBase {
  id: number;
  name: string;
  favourite: boolean;
  location: LocationType;
  distance?: number | null;
  preview?: string | null;
  // Client-only: set when this item has an unsynced local create/update/delete
  // queued (see hooks/repositories/placeRepository.ts). Never sent to the server.
  _pendingSync?: "pending" | "error";
  _syncError?: string | null;
}

export interface PlaceItem extends PlaceItemBase {
  diary_count: number;
  // Diaries attached to this place by their own FK. Unlike diary_count, which
  // the server derives through observations, this one also sees an outing with
  // nothing recorded in it yet — which is what the diaries map is sized by.
  //
  // Optional because it genuinely can be absent: a place synthesised offline
  // (placeRepository) never had a server row, and a page cached before this
  // field shipped predates it. Readers treat missing as zero.
  diary_place_count?: number;
  observation_count: number;
  species_count: number;
  territory: number;
  territory_data: TerritoryData;
  created_at: string;
  updated_at: string;
}

export interface IconButtonProps {
  icon: IconType;
  onPress?: () => void | undefined;
  tintColor?: string;
  active?: boolean;
  style?: StyleType;
  size?: number;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}

export interface RatingItem {
  avatar: string | null;
  first_name: string;
  last_name: string;
  username: string;
  native_territory: number | null;
  profile_id: number;
  seen_qty: number;
  territory_code: string | null;
  territory_name: string | null;
  last_update: string;
}

export interface RatingCompareItem {
  in_object: [boolean, boolean];
  name_lang: string;
  name_latin: string;
  taxon_id: number;
  thumb: string | null;
  segment: string;
  // IUCN category code. Absent from responses cached before the backend
  // started sending it.
  status?: string | null;
}

export interface RatingCompareProfileCounts {
  all: number;
  common: number;
  different: number;
  profile: [number, number];
  profile_diff: [number, number];
}

export interface RatingCompareProfile {
  avatar: string;
  first_name: string;
  user_id: number;
  last_name: string;
  username: string;
}

export interface DashboardStat {
  seen: number;
  observations: number;
  diaries: number;
  rank: number;
  total: number;
}

export interface ActivityResponse {
  data: number[];
  meta: {
    group: string;
    from: string;
    to: string;
    points: number;
    total: number;
    delta: number;
    delta_label: string;
    recent_threshold: number;
    recent_window: number;
    period_label_key: string;
    delta_label_key: string;
    label_params: {
      year: number;
    };
  };
}

export interface ReasonBirdOfTheDay {
  avibase_status: string | null;
  avibase_weight: number;
  ioc_status: string | null;
  ioc_weight: number;
  obs_30d: number;
  obs_90d: number;
  days_since_community: number;
  recency_score: number;
  user_seen_state:
    | "never_seen"
    | "seen_outside_window"
    | "seen_60d_outside"
    | "seen_in_window"
    | "seen_recently";
  final_score: number;
  hint_key: string;
}

export interface BirdOfTheDayType {
  taxon_id: number;
  territory_id: number;
  date: string;
  sp_name_lang: string;
  sp_latin: string;
  sp_thumb: string | null;
  sp_segment: string;
  featured_count_year: number;
  reason: ReasonBirdOfTheDay;
}

export type NotificationType =
  | "notable_obs"
  | "watchlist_activity"
  | "system"
  | "checklist"
  | "achievement";

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  data: {
    screen?: string;
    obsId?: number;
    speciesId?: number;
    achievementId?: string;
    checklistId?: string;
    highlightObsIds?: number[];
    [key: string]: unknown;
  };
  is_read: boolean;
  created_at: string;
}

export type MinimalRoute = {
  name: string;
  params?: object;
};

type NavRoute = {
  name: string;
  params?: object;
  state?: NavState;
};

export type NavState = {
  routes: NavRoute[];
  index?: number;
};

// The Auth stack (all screens, including those that used to be in the Drawer)
export type AuthStackParamList = CatalogParamList & {
  Welcome: undefined;
  Login: { emailConfirmed?: boolean; prefillEmail?: string } | undefined;
  Signup: undefined;
  CheckEmail: { email?: string };
  ConfirmEmail: { key: string };
  Privacy: undefined;
  Terms: undefined;
};

export interface ScreenWithFilters {
  filtersOverride?: Filters;
  o?: string;
  seenMode?: seenMode;
  backTitle?: string;
  highlightObsIds?: number[];
}

export type WelcomeScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<AuthDrawerParamList>,
  NativeStackNavigationProp<AuthStackParamList>
>;

export type AppStackParamList = CatalogParamList & {
  // Declared in AppStack conditionally — only while the onboarding has not been
  // passed (see store/onboarding-context.tsx). In the type it is always there: it
  // has no parameters, and a conditional key would force every use of the stack to
  // know about the onboarding state.
  Onboarding: undefined;
  Main: undefined;
  Profile: undefined;
  Settings: undefined;
  AlertSettings: undefined;
  Import: undefined;
  Stat: ScreenWithFilters | undefined;
  Checklist: ScreenWithFilters | undefined;
  Places: ScreenWithFilters | undefined;
  PlaceDetail: { placeId: number; initialPlace?: PlaceItem };
  PlaceEditor: { place?: PlaceItem; returnToScreen?: string } | undefined;
  Observations: ScreenWithFilters | undefined;
  ObservationDetail: {
    observationId: number;
    initialObservation?: ObservationItem;
  };
  ObservationEditor: {
    observation?: ObservationItem;
    observationId?: number;
    diaryId?: number;
    territoryValue?: number;
    diaryLocationPrivate?: boolean;
    defaultTerritory?: number | null;
    defaultPlace?: number | null;
    defaultSpecies?: number | null;
    returnMode?: string;
  };
  Diaries: ScreenWithFilters | undefined;
  DiaryDetail: ScreenWithFilters & { diaryId: number; initialDiary?: DiaryListItem };
  DiaryEditor: {
    diary?: DiaryItem;
    defaultTerritory?: number | null;
    defaultPlace?: number | null;
    returnMode?: string;
  };
  Rating: ScreenWithFilters | undefined;
  RatingsCompare: ScreenWithFilters & {
    profile1: number;
    profile2: number;
  };
  UserStat: ScreenWithFilters & { profileId: number };
  Notifications: undefined;
  Community: ScreenWithFilters | undefined;
  CommunityDetail: { observationId: number };
  Achievements: { highlightId?: string } | undefined;
  Privacy: undefined;
  Terms: undefined;
  BlockedUsers: undefined;
};

/**
 * The reference screens: the species catalogue and the territories. Moved out of
 * `AppStackParamList` into a separate group because they show no personal data and
 * are therefore registered in both stacks — the signed-in one (`AppStack`) and the
 * guest one (`AuthStack`). None of them reads the profile, so the same
 * implementation works without an account too.
 *
 * Navigation inside the group is typed with `CatalogNavigationProp`: it knows
 * nothing about `ObservationEditor` and the other personal screens, and that is
 * deliberate — the guest stack has no such routes, and navigating to them must be
 * caught by the compiler rather than crash at runtime. The only such navigation is
 * "add an observation" on the species page, and it goes through `useRequireAuth`.
 */
export type CatalogParamList = {
  // Seeds the open tab when the link was shared from a particular one
  // (linking.ts / taxonShareLink.ts), same as the catalogue's initialSort etc.
  SpeciesDetail: ({ segment: string } | { id: number }) & {
    initialTab?: SpeciesDetailTab;
    // Which of the app's many roads to this page was taken — read by
    // `species_viewed` only (see SpeciesEntryPoint). Not part of any shared
    // link: taxonShareLink builds the URL from the segment and the tab alone.
    source?: SpeciesEntryPoint;
    // The action the guest did not get to without an account: after the login
    // services/authReturn brings them back to this screen with this parameter, and
    // the screen replays what was started (hooks/useRequireAuth). The screen clears
    // the parameter itself, otherwise the action would repeat on every return here.
    pendingAction?: GatedAction;
  };
  Taxonomy: {
    rank: TaxonRank;
    parentSegment?: string;
    parentRank?: TaxonRank;
    extinct?: boolean;
    title?: string;
    // Opens with the keyboard up — used by the "all species" shortcut, whose
    // whole point is searching by name.
    focusSearch?: boolean;
    // When set, the screen picks instead of navigates: tapping a species
    // hands it to the callback registered under this key and pops back.
    pickerKey?: string;
    // Seeds the trait/country filters, sort and name search when the screen is
    // opened from a shared catalogue deep link (linking.ts / taxonShareLink.ts).
    initialTraits?: TaxonTraitFilters;
    initialSort?: string;
    initialSearch?: string;
  };
  TaxonGroupDetail: { segment: string; rank: 2 | 3 | 4; initialSort?: string };
  SpeciesCompare: { segmentA?: string; segmentB?: string } | undefined;
  TerritoryList:
    | {
        // Same picker contract as Taxonomy.pickerKey: tapping a country hands
        // it to the callback registered under this key instead of opening it.
        pickerKey?: string;
        title?: string;
        initialSort?: string;
        initialSearch?: string;
        // Region id from a shared link (see linking.ts) — same `region` param
        // /api/territory/ takes.
        initialRegion?: number;
      }
    | undefined;
  // Everything after `segment` is what a shared link restores: which tab and
  // layout were open, and how the flat species list was sorted and filtered.
  TerritoryDetail: {
    segment: string;
    initialTab?: territoryTab;
    initialView?: territoryView;
    initialSort?: string;
    initialTraits?: TaxonTraitFilters;
  };
  TerritoryCompare:
    | {
        segment1?: string;
        segment2?: string;
        initialTab?: compareMode;
        initialSort?: string;
        initialSearch?: string;
      }
    | undefined;
};

export type ScreenWithFiltersOnly =
  | "Main"
  | "Stat"
  | "Checklist"
  | "Places"
  | "Observations"
  | "Diaries"
  | "DiaryDetail"
  | "Rating"
  | "RatingsCompare"
  | "UserStat"
  | "Community";

export type ScreenWithFiltersParamList = {
  [K in ScreenWithFiltersOnly]: AppStackParamList[K] extends undefined
    ? ScreenWithFilters | undefined
    : AppStackParamList[K];
};

// The Drawer is used only as a container with a menu, there is a single screen inside
export type AppDrawerParamList = {
  MainScreen: undefined;
};

export type AuthDrawerParamList = {
  WelcomeMain: undefined;
};

export type AppStackNavigationProp =
  NativeStackNavigationProp<AppStackParamList>;

export type AuthStackNavigationProp =
  NativeStackNavigationProp<AuthStackParamList>;

// Navigation inside the reference. Deliberately narrower than
// AppStackNavigationProp: these screens also live in the guest stack, which has no
// personal routes, and an attempt to navigate to them must be a compilation error
// rather than a crash for a user without an account. See CatalogParamList.
export type CatalogNavigationProp =
  NativeStackNavigationProp<CatalogParamList>;

export type CatalogRouteProp<T extends keyof CatalogParamList> = RouteProp<
  CatalogParamList,
  T
>;

// The Drawer is only needed for openDrawer/closeDrawer on the main screen
export type AppDrawerNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<AppDrawerParamList>,
  NativeStackNavigationProp<AppStackParamList>
>;

export type AnyDrawerNavigationProp = DrawerNavigationProp<
  AppDrawerParamList | AuthDrawerParamList
>;

export type AppStackRouteProp<T extends keyof AppStackParamList> = RouteProp<
  AppStackParamList,
  T
>;

export type AuthStackRouteProp<T extends keyof AuthStackParamList> = RouteProp<
  AuthStackParamList,
  T
>;

export type NotificationPayload = (
  | { screen: "Community"; highlightObsIds: number[] }
  // A single find opens its card, several open the feed with them highlighted.
  | { screen: "CommunityDetail"; obsId: number }
  | { screen: "SpeciesDetail"; speciesId: number }
  | { screen: "Achievements"; achievementId?: string }
  | { screen: "Notifications" }
  | { screen: "Checklist" }
) & { id?: number };

/**
 * A notification about a release of the app itself, created by the backend at
 * the app's own request (hooks/useAppUpdateNotifications).
 *
 * These carry no `screen`: "applied" says everything it has to say in the card
 * itself, and "pending" restarts the app instead of navigating — which is why
 * they are recognised by `kind` rather than routed through
 * util/notificationRoute.
 */
export type AppUpdateKind = "ota" | "build";
export type AppUpdateStage = "pending" | "applied";

export const getAppUpdateStage = (
  data: AppNotification["data"],
): AppUpdateStage | null => {
  if (data?.kind !== "app_update") return null;
  return data.stage === "pending" || data.stage === "applied"
    ? data.stage
    : null;
};

/**
 * The screens a notification can point at.
 *
 * Derived from the payload rather than listed by hand — the hand-written list it
 * replaces had gone stale (no `Checklist`, no `CommunityDetail`) while nothing
 * used it. Its point now is the constraint it carries: util/notificationRoute
 * indexes `AppStackParamList` with it, so a payload naming a screen the stack
 * does not have stops compiling. Before that, such a payload was a tap that
 * silently did nothing — which is exactly how `CommunityDetail` went unnoticed.
 */
export type NotificationScreen = NotificationPayload["screen"];

/**
 * Note what this does *not* check: only `screen`, and only that it is a string.
 * The payload comes from the backend, so every other field is a claim rather
 * than a fact — see util/notificationRoute, which re-checks the ids it needs.
 */
export function isNotificationPayload(
  data: unknown,
): data is NotificationPayload {
  return (
    typeof data === "object" &&
    data !== null &&
    "screen" in data &&
    typeof (data as Record<string, unknown>).screen === "string"
  );
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends AppStackParamList {}
  }
}
