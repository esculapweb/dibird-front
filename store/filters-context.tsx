import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  loadGlobalTerritory,
  saveGlobalTerritory,
  loadGlobalDateFilter,
  saveGlobalDateFilter,
  loadGlobalPlace,
  saveGlobalPlace,
  loadGlobalSpecies,
  saveGlobalSpecies,
  clearAllGlobalFilters,
} from "../util/storageHelper";

import { registerOnProfileSaved } from "./profile-context";

interface DateFilter {
  type: string;
  [key: string]: any;
}

interface FiltersContextType {
  territory: string | null;
  setTerritory: (val: string | null) => Promise<void>;
  date: DateFilter | null;
  setDate: (val: DateFilter | null) => Promise<void>;
  place: string | null;
  setPlace: (val: string | null) => Promise<void>;
  species: string | null;
  setSpecies: (val: string | null) => Promise<void>;
  seenMode: string;
  setSeenMode: (val: string) => void;
  resetFilters: () => Promise<void>;
  reload: () => Promise<void>;
}

const FiltersContext = createContext<FiltersContextType | null>(null);

export const FiltersProvider = ({ children }: { children: ReactNode }) => {
  const [territory, setTerritoryState] = useState<string | null>(null);
  const [date, setDateState] = useState<DateFilter | null>(null);
  const [place, setPlaceState] = useState<string | null>(null);
  const [species, setSpeciesState] = useState<string | null>(null);
  const [seenMode, setSeenMode] = useState("all");

  useEffect(() => {
    loadGlobalTerritory().then((val) => {
      setTerritoryState(val ?? null);
      setSeenMode(val ? "all" : "seen");
    });
    loadGlobalDateFilter().then((val) => {
      setDateState(val ?? null);
    });
    loadGlobalPlace().then((val) => {
      setPlaceState(val ?? null);
    });
    loadGlobalSpecies().then((val) => {
      setSpeciesState(val ?? null);
    });
  }, []);

  const setTerritory = async (val: string | null) => {
    setTerritoryState(val);
    if (!val) {
      setPlaceState(null);
      await saveGlobalPlace(null);
    }
    await saveGlobalTerritory(val);
  };

  const setDate = async (val: DateFilter | null) => {
    setDateState(val);
    await saveGlobalDateFilter(val);
  };

  const setPlace = async (val: string | null) => {
    setPlaceState(val);
    await saveGlobalPlace(val);
  };

  const setSpecies = async (val: string | null) => {
    setSpeciesState(val);
    await saveGlobalSpecies(val);
  };

  const resetFilters = async () => {
    await clearAllGlobalFilters();
    setTerritoryState(null);
    setDateState(null);
    setPlaceState(null);
    setSpeciesState(null);
  };

  const reload = useCallback(async () => {
    const territory = await loadGlobalTerritory();
    const date = await loadGlobalDateFilter();
    const place = await loadGlobalPlace();
    const species = await loadGlobalSpecies();
    setTerritoryState(territory ?? null);
    setDateState(date ?? null);
    setPlaceState(place ?? null);
    setSpeciesState(species ?? null);
  }, []);

  useEffect(() => {
    return registerOnProfileSaved(async () => {
      await reload();
    });
  }, []);

  return (
    <FiltersContext.Provider
      value={{
        territory,
        setTerritory,
        date,
        setDate,
        place,
        setPlace,
        species,
        setSpecies,
        seenMode,
        setSeenMode,
        resetFilters,
        reload,
      }}
    >
      {children}
    </FiltersContext.Provider>
  );
};

export const useFilters = (): FiltersContextType => {
  const context = useContext(FiltersContext);
  if (!context)
    throw new Error("useFilters must be used within FiltersProvider");
  return context;
};
