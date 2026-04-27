import { NativeStackNavigationProp } from "@react-navigation/native-stack";

export interface AppError extends Error {
  code?: string;
  status?: number;
  title?: string;
  isTimeout?: boolean;
  isNetworkError?: boolean;
  isServerError?: boolean;
  originalError?: unknown;
  response?: any;
}

interface UserData {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
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
  iconLabel?: string | null;
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

export interface DiaryFormData {
  territory: number;
  place?: number | null;
  date_time: string;
  private?: boolean;
  notes?: string | null;
}

export interface ObservationFormData {
  species: number;
  territory?: number;
  place?: number | null;
  date_time?: string;
  time?: string | null;
  private?: boolean;
  quantity?: number | null;
  notes?: string | null;
  diary?: number | null;
}

export interface PlaceFormData {
  name: string;
  territory: number;
  favourite: boolean;
  location?: {
    type: string;
    coordinates: [number, number];
  } | null;
}

export type RootStackParamList = {
  Stat: {
    filtersOverride?: Filters;
    seenMode?: seenMode;
    o?: string;
  };
  Observations: {
    filtersOverride?: Filters;
  };
  Privacy: undefined;
  Terms: undefined;
  Login: undefined;

  // остальные экраны
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
