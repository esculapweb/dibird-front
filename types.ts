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


export interface SpeciesData {
  id: number;
  name: string;
  name_lang: string;
  segment: string;
  thumb: string;
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

export type Coords = [number, number]

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
  location: {
    coordinates: Coords;
    type: string;
  };
  name: string;
  preview: string | null;
}



export interface GeoDetails {
  country: string | undefined;
  countryCode: string | undefined;
  city: string | undefined;
  address: string | undefined;
  raw: Record<string, unknown> | undefined;
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






export interface OwnerData {
  avatar: string;
  first_name: string;
  id: number;
  last_name: string;
  private: boolean;
  timezone_id: string;
  username: string;
}

export interface TerritoryData {
  code: string;
  id: number;
  name: string;
  segment: string;
}


export interface ObservationItem {
  created_at: string;
  date_time: string;
  diary: number | null;
  id: number;
  is_owner: boolean;
  notes: string | null;
  owner: OwnerData;
  place: number | null;
  place_data: PlaceData | null;
  private: boolean;
  quantity: number | null;
  species: number;
  species_data: SpeciesData;
  territory: number;
  territory_data: TerritoryData;
  time: string | null;
  updated_at: string;
}

export interface DiaryItem {
  created_at: string;
  date_time: string;
  id: number;
  is_owner: boolean;
  name: string | null;
  observation_count: number;
  owner: OwnerData;
  place: number | null;
  place_data: PlaceData | null;
  private: boolean;
  profile: number;
  territory: number;
  territory_data: TerritoryData;
  updated_at: string;
  user_data: Omit<OwnerData, "private">;
}

export type EditorItem = DiaryItem & ObservationItem;