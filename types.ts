import { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleProp, ViewStyle } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { CompositeNavigationProp, RouteProp } from "@react-navigation/native";
import { AxiosResponse } from "axios";
import { QueryObserverResult } from "@tanstack/react-query";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";

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

export interface TabOption {
  value: seenMode | compareMode;
  icon: IconType;
  iconInactive: IconType;
  labelKey: string;
  count?: number;
}

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

export type AllowedFilterKey =
  | "territory"
  | "date"
  | "place"
  | "species"
  | "favourite"
  | "unsynced";

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
  tab?: seenMode | compareMode | null;
  territory?: number | null;
  user_id?: number | null;
  year?: number | null;
  radius?: number | null;
  // Client-only: never sent to the server (see util/fetches.ts's
  // fetchObservations/fetchDiaries/fetchPlaces) — filters the list down to
  // items with a queued local create/update/delete that hasn't synced yet.
  unsynced?: boolean | null;
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
  status: string | null;
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
}

export interface TaxonSibling {
  segment: string;
  name: string;
  name_lang: string;
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
  d_status: number | null;
  s_id: number | null;
}

interface TaxonDetailBase {
  taxon_id: number;
  name: string;
  name_lang: string;
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
  license: string;
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
  langs: Record<string, string[]>;
  synonyms: string[];
  protonyms: string[];
}

// Species detail (rank 5) — the richest of the taxon detail shapes.
export interface TaxonSpeciesDetail extends TaxonDetailBase {
  status: { status_id: number; name: string; s_id: number } | null;
  authority: string;
  breeding_regions: string[];
  breeding_subregion: string | null;
  nonbreeding_region: string | null;
  parents: TaxonParentCrumb[];
  subspecies: TaxonSubspecies[];
  photos: TaxonPhoto[];
  sounds: TaxonSound[];
  related: TaxonRelated;
  countries: TaxonCountry[];
  multilangs: TaxonMultilangs;
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
  name: string;
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
  external_username: string | null;
  location_private: boolean;
  distance?: number | null;
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

// Auth стек (все экраны, включая те что раньше были в Drawer)
export type AuthStackParamList = {
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

export type AppStackParamList = {
  Main: undefined;
  Profile: undefined;
  Settings: undefined;
  AlertSettings: undefined;
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
  SpeciesDetail: { segment: string } | { id: number };
  Taxonomy: {
    rank: TaxonRank;
    parentSegment?: string;
    parentRank?: TaxonRank;
    extinct?: boolean;
    title?: string;
  };
  TaxonGroupDetail: { segment: string; rank: 2 | 3 | 4 };
  Achievements: { highlightId?: string } | undefined;
  Privacy: undefined;
  Terms: undefined;
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

// Drawer используется только как контейнер с меню, экран внутри один
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

// Drawer нужен только для openDrawer/closeDrawer на главном экране
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

export type NotificationScreen = keyof Pick<
  AppStackParamList,
  "Notifications" | "Community" | "SpeciesDetail" | "Achievements"
>;

export type NotificationPayload = (
  | { screen: "Community"; highlightObsIds: number[] }
  | { screen: "SpeciesDetail"; speciesId: number }
  | { screen: "Achievements"; achievementId?: string }
  | { screen: "Notifications" }
  | { screen: "Checklist" }
) & { id?: number };

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
