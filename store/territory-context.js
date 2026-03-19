import { createContext, useContext, useState, useEffect } from "react";
import {
  loadGlobalTerritory,
  saveGlobalTerritory,
  loadGlobalDateFilter,
  saveGlobalDateFilter,
} from "../util/storageHelper";

const TerritoryContext = createContext();

export const TerritoryProvider = ({ children }) => {
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
    <TerritoryContext.Provider
      value={{ territory, setTerritory, date, setDate, resetTerritory, resetDate }}
    >
      {children}
    </TerritoryContext.Provider>
  );
};

export const useTerritory = () => useContext(TerritoryContext);
