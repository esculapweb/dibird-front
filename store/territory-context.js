import { createContext, useContext, useState, useEffect } from "react";
import {
  loadGlobalTerritory,
  saveGlobalTerritory,
} from "../util/storageHelper";

const TerritoryContext = createContext();

export const TerritoryProvider = ({ children }) => {
  const [territory, setTerritoryState] = useState(null);

  useEffect(() => {
    loadGlobalTerritory().then((val) => setTerritoryState(val));
  }, []);

  const setTerritory = (val) => {
    setTerritoryState(val);
    saveGlobalTerritory(val);
  };

  const resetTerritory = () => {
    setTerritoryState(null);
  };

  return (
    <TerritoryContext.Provider
      value={{ territory, setTerritory, resetTerritory }}
    >
      {children}
    </TerritoryContext.Provider>
  );
};

export const useTerritory = () => useContext(TerritoryContext);
