import { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleProp, ViewStyle } from "react-native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import {
  DrawerNavigationProp,
  DrawerScreenProps,
} from "@react-navigation/drawer";
import {
  CompositeNavigationProp,
  CompositeScreenProps,
} from "@react-navigation/native";
import { AxiosResponse } from "axios";

export type IconType = ComponentProps<typeof Ionicons>["name"];
export type StyleType = StyleProp<ViewStyle>;
export type Theme = "light" | "dark";

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

export interface QueryType {
  data: DropdownItem[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => void;
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

export interface TabOption {
  value: "seen" | "unseen" | "all";
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
  location?: {
    coordinates: Coords;
    type: string;
  };
  distance?: number;
  name?: string;
}

export interface TerritoryDropdownItem extends DropdownItem {
  code: string;
}

export interface PaginatedResult<T> {
  pagination: {
    current: number;
    final: number;
  };
  results: T[];
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
  species_id: number;
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

export type Coords = [number, number];

export interface PlaceFormData {
  name: string;
  territory: number;
  favourite: boolean;
  location?: {
    type: string;
    coordinates: Coords;
  } | null;
}

export interface PlaceData {
  id: number;
  name: string;
  preview: string | null;
  location: {
    type: string;
    coordinates: Coords;
  } | null;
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
  location: {
    type: string;
    coordinates: Coords;
  };
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
  PlaceEditor: { placeId?: number; returnToScreen?: string };
  Observations: ScreenWithFilters | undefined;
  ObservationDetail: { observationId: number };
  ObservationEditor: { observationId?: number; defaultTerritory?: number | "" };
  Diaries: ScreenWithFilters | undefined;
  DiaryDetail: { diaryId: number };
  DiaryEditor: {
    diary?: DiaryItem;
    defaultTerritory?: number | "";
    defaultPlace?: number | null;
    returnMode?: string;
  };
  Rating: ScreenWithFilters | undefined;
  RatingsCompare:
    | (ScreenWithFilters & {
        profile1: number;
        profile2: number;
      })
    | undefined;
  UserStat: { profileId: number };
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

// --- Screen Props ---

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AppStackScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;

export type AuthDrawerScreenProps<T extends keyof AuthDrawerParamList> =
  DrawerScreenProps<AuthDrawerParamList, T>;

export type AppDrawerScreenProps<T extends keyof AppDrawerParamList> =
  CompositeScreenProps<
    DrawerScreenProps<AppDrawerParamList, T>,
    NativeStackScreenProps<AppStackParamList>
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
