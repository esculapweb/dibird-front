import { createContext, useContext, useState, useEffect } from "react";
import {
  loadGlobalTerritory,
  saveGlobalTerritory,
  loadGlobalDateFilter,
  saveGlobalDateFilter,
} from "../util/storageHelper";

const FiltersContext = createContext();

export const FiltersProvider = ({ children }) => {
  const [territory, setTerritoryState] = useState(null);
  const [date, setDateState] = useState(undefined);

  useEffect(() => {
    loadGlobalTerritory().then((val) => setTerritoryState(val ?? null));
    loadGlobalDateFilter().then((val) => setDateState(val ?? null));
  }, []);

  const setTerritory = async (val) => {
    setTerritoryState(val);
    saveGlobalTerritory(val);
  };

  const setDate = async (val) => {
    setDateState(val);
    await saveGlobalDateFilter(val);
  };

  const resetTerritory = () => {
    setTerritoryState(null);
  };

  const resetDate = () => {
    setDateState(null);
  };

  return (
    <FiltersContext.Provider
      value={{ territory, setTerritory, date, setDate, resetTerritory, resetDate }}
    >
      {children}
    </FiltersContext.Provider>
  );
};

export const useFilters = () => useContext(FiltersContext);
