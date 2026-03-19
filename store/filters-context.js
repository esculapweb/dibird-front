import { createContext, useContext, useState, useEffect } from "react";
import {
  loadGlobalTerritory,
  saveGlobalTerritory,
  loadGlobalDateFilter,
  saveGlobalDateFilter,
  loadGlobalPlace,
  saveGlobalPlace,
} from "../util/storageHelper";

const FiltersContext = createContext();

export const FiltersProvider = ({ children }) => {
  const [territory, setTerritoryState] = useState(null);
  const [date, setDateState] = useState(undefined);
  const [place, setPlaceState] = useState(null);

  useEffect(() => {
    loadGlobalTerritory().then((val) => setTerritoryState(val ?? null));
    loadGlobalDateFilter().then((val) => setDateState(val ?? null));
    loadGlobalPlace().then((val) => setPlaceState(val ?? null));
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

  const resetTerritory = () => setTerritoryState(null);
  const resetDate = () => setDateState(null);
  const resetPlace = () => setPlaceState(null);

  return (
    <FiltersContext.Provider
      value={{
        territory,
        setTerritory,
        date,
        setDate,
        place,
        setPlace,
        resetTerritory,
        resetDate,
        resetPlace,
      }}
    >
      {children}
    </FiltersContext.Provider>
  );
};

export const useFilters = () => useContext(FiltersContext);
