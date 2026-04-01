import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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

const FiltersContext = createContext();

export const FiltersProvider = ({ children }) => {
  const [territory, setTerritoryState] = useState(null);
  const [date, setDateState] = useState(undefined);
  const [place, setPlaceState] = useState(null);
  const [species, setSpeciesState] = useState(null);
  const [seenMode, setSeenMode] = useState("seen");

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

  const setTerritory = async (val) => {
    setTerritoryState(val);
    if (!val) {
      setPlaceState(null);
      await saveGlobalPlace(null);
    }
    await saveGlobalTerritory(val);
  };

  const setDate = async (val) => {
    setDateState(val);
    await saveGlobalDateFilter(val);
  };

  const setPlace = async (val) => {
    setPlaceState(val);
    await saveGlobalPlace(val);
  };

  const setSpecies = async (val) => {
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

export const useFilters = () => useContext(FiltersContext);
