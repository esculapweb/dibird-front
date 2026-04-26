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

export type seenMode = "seen" | "unseen" | "all";

export interface DateFilter {
  type?: string;
  year?: number;
  from?: string;
  to?: string;
}

export type FilterKey = "territory" | "date" | "place" | "species";

export interface Filters {
  territory?: number | null;
  date?: DateFilter | null;
  place?: number | null;
  species?: number | null;
  seen?: boolean | null;
  new?: boolean;
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
