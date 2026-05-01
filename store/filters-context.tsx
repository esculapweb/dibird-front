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
import { seenMode } from "../types";
import { DateFilter } from "../types";

interface FiltersContextType {
  territory: number | null;
  setTerritory: (val: number | null) => Promise<void>;
  date: DateFilter | null;
  setDate: (val: DateFilter | null) => Promise<void>;
  place: number | null;
  setPlace: (val: number | null) => Promise<void>;
  species: number | null;
  setSpecies: (val: number | null) => Promise<void>;
  seenMode: seenMode;
  setSeenMode: (val: seenMode) => void;
  resetFilters: () => Promise<void>;
  reload: () => Promise<void>;
}

const FiltersContext = createContext<FiltersContextType | null>(null);

export const FiltersProvider = ({ children }: { children: ReactNode }) => {
  const [territory, setTerritoryState] = useState<number | null>(null);
  const [date, setDateState] = useState<DateFilter>(null);
  const [place, setPlaceState] = useState<number | null>(null);
  const [species, setSpeciesState] = useState<number | null>(null);
  const [seenMode, setSeenMode] = useState<seenMode>("all");

  useEffect(() => {
    loadGlobalTerritory().then((val) => {
      setTerritoryState((val as number | null) ?? null);
      setSeenMode(val ? "all" : "seen");
    });
    loadGlobalDateFilter().then((val) => {
      setDateState((val) ?? null);
    });
    loadGlobalPlace().then((val) => {
      setPlaceState((val as number | null) ?? null);
    });
    loadGlobalSpecies().then((val) => {
      setSpeciesState((val as number | null) ?? null);
    });
  }, []);

  const setTerritory = async (val: number | null) => {
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

  const setPlace = async (val: number | null) => {
    setPlaceState(val);
    await saveGlobalPlace(val);
  };

  const setSpecies = async (val: number | null) => {
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
    setTerritoryState((territory as number | null) ?? null);
    setDateState((date as DateFilter | null) ?? null);
    setPlaceState((place as number | null) ?? null);
    setSpeciesState((species as number | null) ?? null);
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
