import AsyncStorage from "@react-native-async-storage/async-storage";
import { DateFilter } from "../types";

const SORT_KEY = "sorting";
const GLOBAL_KEY = "global";

const saveItem = async (key: string, screen: string, value: unknown): Promise<void> => {
  try {
    const json = await AsyncStorage.getItem(key);
    const allData: Record<string, unknown> = json ? JSON.parse(json) : {};
    allData[screen] = value;
    await AsyncStorage.setItem(key, JSON.stringify(allData));
  } catch (e) {
    console.warn(`Failed to save ${key}`, e);
  }
};

const loadItem = async (key: string, screen: string): Promise<unknown> => {
  try {
    const json = await AsyncStorage.getItem(key);
    const allData: Record<string, unknown> = json ? JSON.parse(json) : {};

    return allData[screen] ?? null;
  } catch (e) {
    return null;
  }
};

const clearItem = async (key: string, screen: string): Promise<void> => {
  try {
    const json = await AsyncStorage.getItem(key);
    const allData: Record<string, unknown> = json ? JSON.parse(json) : {};
    delete allData[screen];
    await AsyncStorage.setItem(key, JSON.stringify(allData));
  } catch (e) {
    console.warn(`Failed to clear ${key}`, e);
  }
};

export const saveSort = (screen: string, value: string): Promise<void> => saveItem(SORT_KEY, screen, value);
export const loadSort = (screen: string): Promise<unknown> => loadItem(SORT_KEY, screen);
export const clearSort = (screen: string): Promise<void> => clearItem(SORT_KEY, screen);

export const saveGlobalTerritory = (value: number | null): Promise<void> => saveItem(GLOBAL_KEY, "territory", value);
export const loadGlobalTerritory = (): Promise<unknown> => loadItem(GLOBAL_KEY, "territory");

export const saveGlobalDateFilter = (value: DateFilter | null): Promise<void> => saveItem(GLOBAL_KEY, "dateFilter", value);
export const loadGlobalDateFilter = (): Promise<unknown> => loadItem(GLOBAL_KEY, "dateFilter");


export const saveGlobalPlace = (value: number | null): Promise<void> => saveItem(GLOBAL_KEY, "placeFilter", value);
export const loadGlobalPlace = (): Promise<unknown> => loadItem(GLOBAL_KEY, "placeFilter");

export const saveGlobalSpecies = (value: number | null): Promise<void> => saveItem(GLOBAL_KEY, "species", value);
export const loadGlobalSpecies = (): Promise<unknown> => loadItem(GLOBAL_KEY, "species");


export const clearAllGlobalFilters = async (): Promise<void> => {
  await AsyncStorage.multiRemove([GLOBAL_KEY, "filters_inited"]);
};

export const initGlobalFilters = async (profileTerritory: number | null): Promise<void> => {
  const alreadyInited = await AsyncStorage.getItem("filters_inited");
  if (alreadyInited) return;

  const savedTerritory = await loadGlobalTerritory();
  const savedDate = await loadGlobalDateFilter();

  if (!savedTerritory && profileTerritory)
    await saveGlobalTerritory(profileTerritory);

  if (!savedDate)
    await saveGlobalDateFilter({
      type: "this_year",
    });

  await AsyncStorage.setItem("filters_inited", "true");
};
