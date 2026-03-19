import { createContext, useContext, useState, useEffect } from "react";
import {
  loadGlobalTerritory,
  saveGlobalTerritory,
  loadGlobalDateFilter,
  saveGlobalDateFilter,
  loadGlobalPlace,
  saveGlobalPlace,
  clearAllGlobalFilters,
} from "../util/storageHelper";
import { onLoginEvent } from "../util/loginEvents";

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

  useEffect(() => {
    const unsub = onLoginEvent((profile) => {
      initFilters(profile.territory ?? null);
    });
    return unsub;
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

  const resetFilters = async () => {
    await clearAllGlobalFilters();
    setTerritoryState(null);
    setDateState(null);
    setPlaceState(null);
  };

  const initFilters = async (profileTerritory) => {
    const newDate = { type: "year", year: new Date().getFullYear() };
    await saveGlobalTerritory(profileTerritory ?? null);
    await saveGlobalDateFilter(newDate);
    await saveGlobalPlace(null);
    setTerritoryState(profileTerritory ?? null);
    setDateState(newDate);
    setPlaceState(null);
  };

  return (
    <FiltersContext.Provider
      value={{
        territory,
        setTerritory,
        date,
        setDate,
        place,
        setPlace,
        resetFilters,
        initFilters,
      }}
    >
      {children}
    </FiltersContext.Provider>
  );
};

export const useFilters = () => useContext(FiltersContext);
