import AsyncStorage from "@react-native-async-storage/async-storage";

const SORT_KEY = "sorting";
const FILTERS_KEY = "filters";
const GLOBAL_KEY = "global";

const saveItem = async (key, screen, value) => {
  try {
    const json = await AsyncStorage.getItem(key);
    const allData = json ? JSON.parse(json) : {};
    allData[screen] = value;
    await AsyncStorage.setItem(key, JSON.stringify(allData));
  } catch (e) {
    console.warn(`Failed to save ${key}`, e);
  }
};

const loadItem = async (key, screen) => {
  try {
    const json = await AsyncStorage.getItem(key);
    const allData = json ? JSON.parse(json) : {};
    return allData[screen] ?? null;
  } catch (e) {
    console.warn(`Failed to load ${key}`, e);
    return null;
  }
};

const clearItem = async (key, screen) => {
  try {
    const json = await AsyncStorage.getItem(key);
    const allData = json ? JSON.parse(json) : {};
    delete allData[screen];
    await AsyncStorage.setItem(key, JSON.stringify(allData));
  } catch (e) {
    console.warn(`Failed to clear ${key}`, e);
  }
};

export const saveSort = (screen, value) => saveItem(SORT_KEY, screen, value);
export const loadSort = (screen) => loadItem(SORT_KEY, screen);
export const clearSort = (screen) => clearItem(SORT_KEY, screen);

export const saveFilters = (screen, value) => saveItem(FILTERS_KEY, screen, value);
export const loadFilters = (screen) => loadItem(FILTERS_KEY, screen);
export const clearFilters = (screen) => clearItem(FILTERS_KEY, screen);

export const saveGlobalTerritory = (value) => saveItem(GLOBAL_KEY, "territory", value);
export const loadGlobalTerritory = () => loadItem(GLOBAL_KEY, "territory");
export const clearGlobalTerritory = () => clearItem(GLOBAL_KEY, "territory");

export const initGlobalTerritory = async (profileTerritory) => {
  const saved = await loadGlobalTerritory();
  if (!saved && profileTerritory) {
    await saveGlobalTerritory(profileTerritory);
  }
};