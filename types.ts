import { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleProp, ViewStyle } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { CompositeNavigationProp, RouteProp } from "@react-navigation/native";
import { AxiosResponse } from "axios";
import { QueryObserverResult } from "@tanstack/react-query";


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
  code?: string;
  status?: number;
  title?: string;
  isTimeout?: boolean;
  isNetworkError?: boolean;
  isServerError?: boolean;
  originalError?: unknown;
  response?: AxiosResponse;
}

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

export interface DateFilter {
  type?: "any" | "today" | "this_year" | "range" | "exact" | "year";
  year?: number | null;
  from?: string | null;
  to?: string | null;
  mode?: "any" | "exact" | "range";
  this_year?: boolean | null;
  today?: boolean | null;
}

export type FilterKey =
  | "territory"
  | "date"
  | "place"
  | "species"
  | "favourite";

export interface Filters {
  territory?: number | null;
  date?: DateFilter | null;
  place?: number | null;
  species?: number | null;
  seen?: boolean | null;
  new?: boolean;
  favourite?: boolean | null;
  speciesName?: string;
  [key: string]: unknown;
}

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
  seen: boolean;
  min_date: string | null;
  max_date: string | null;
  qty_observations: number | null;
  qty_countries: number | null;
  min_created_at: string | null;
  min_territory: string | null;
  max_territory: string | null;
}

export interface ChecklistItem {
  latin: string;
  name_lang: string;
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

export interface DiaryFormData {
  territory: number;
  date_time: string;
  private: boolean;
  place?: number | null;
  notes?: string | null;
}

export interface ObservationFormData {
  species: number;
  territory: number;
  date_time: string;
  private: boolean;
  place?: number | null;
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

export interface PlaceFormData {
  name: string;
  territory: number;
  favourite: boolean;
  location?: LocationType | null;
}

export interface PlaceData {
  id: number;
  name: string;
  preview: string | null;
  location: LocationType | null;
}

export interface GeoDetails {
  country: string | undefined;
  countryCode: string | undefined;
  city: string | undefined;
  address: string | undefined;
  raw: Record<string, unknown> | undefined;
}

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
  territory_data: TerritoryData;
  updated_at: string;
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
  profile: number;
  territory: number;
  territory_data: TerritoryData;
}

export interface DiaryItem extends DiaryBase {
  is_owner: boolean;
  owner: OwnerData;
  created_at: string;
  updated_at: string;
  user_data: Omit<OwnerData, "private">;
}

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

export type EditorItem = DiaryItem & ObservationItem;

export interface IconButtonProps {
  icon: IconType;
  onPress?: () => void | undefined;
  tintColor?: string;
  active?: boolean;
  style?: StyleType;
  size?: number;
  disabled?: boolean;
  loading?: boolean;
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

// --- Navigation ---

export type RootStackParamList = {
  Root: undefined;
  Privacy: undefined;
  Terms: undefined;
};

export interface ScreenWithFilters {
  filtersOverride?: Filters;
  o?: string;
  seenMode?: seenMode;
  backTitle?: string;
}

export type AppStackParamList = {
  Main: ScreenWithFilters | undefined;
  Stat: ScreenWithFilters | undefined;
  Checklist: ScreenWithFilters | undefined;
  Places: ScreenWithFilters | undefined;
  PlaceDetail: { placeId: number };
  PlaceEditor: { placeId?: number; returnToScreen?: string } | undefined;
  Observations: ScreenWithFilters | undefined;
  ObservationDetail: { observationId: number };
  ObservationEditor: {
    observationId?: number;
    diaryId?: number;
    territoryValue?: number;
    defaultTerritory?: string | number | null;
    defaultPlace?: number | null;
    defaultSpecies?: number | null;
    returnMode?: string;
  };
  Diaries: ScreenWithFilters | undefined;
  DiaryDetail: ScreenWithFilters & { diaryId: number };
  DiaryEditor: {
    diary?: DiaryItem;
    defaultTerritory?: number | "";
    defaultPlace?: number | null;
    returnMode?: string;
  };
  Rating: ScreenWithFilters | undefined;
  RatingsCompare: ScreenWithFilters & {
    profile1: number;
    profile2: number;
  };
  UserStat: ScreenWithFilters & { profileId: number };
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
  | "UserStat";

export type ScreenWithFiltersParamList = {
  [K in ScreenWithFiltersOnly]: AppStackParamList[K] extends undefined
    ? ScreenWithFilters | undefined
    : AppStackParamList[K];
};

export type AppDrawerParamList = {
  MainDrawer: undefined;
  Profile: undefined;
};

export type AuthDrawerParamList = {
  Welcome: undefined;
  CheckEmail: { email?: string };
  Login: { emailConfirmed?: boolean; prefillEmail?: string } | undefined;
  Signup: undefined;
  ConfirmEmail: { key: string };
};

// --- Navigation Props ---

export type RootStackNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export type AppStackNavigationProp =
  NativeStackNavigationProp<AppStackParamList>;

export type AuthDrawerNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<AuthDrawerParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type AppDrawerNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<AppDrawerParamList>,
  NativeStackNavigationProp<AppStackParamList>
>;

// -- Route Props

export type RootStackProp<T extends keyof RootStackParamList> = RouteProp<
  RootStackParamList,
  T
>;

export type AppStackRouteProp<T extends keyof AppStackParamList> = RouteProp<
  AppStackParamList,
  T
>;

export type AuthDrawerRouteProp<T extends keyof AuthDrawerParamList> =
  RouteProp<AuthDrawerParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
