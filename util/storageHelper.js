import AsyncStorage from "@react-native-async-storage/async-storage";

const SORT_KEY = "sorting";
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

export const saveGlobalTerritory = (value) =>
  saveItem(GLOBAL_KEY, "territory", value);
export const loadGlobalTerritory = () => loadItem(GLOBAL_KEY, "territory");

export const saveGlobalDateFilter = (value) =>
  saveItem(GLOBAL_KEY, "dateFilter", value);
export const loadGlobalDateFilter = () => loadItem(GLOBAL_KEY, "dateFilter");

export const saveGlobalPlace = (value) =>
  saveItem(GLOBAL_KEY, "placeFilter", value);

export const loadGlobalPlace = () => loadItem(GLOBAL_KEY, "placeFilter");

export const saveGlobalSpecies = (value) =>
  saveItem(GLOBAL_KEY, "species", value);
export const loadGlobalSpecies = () => loadItem(GLOBAL_KEY, "species");

export const clearAllGlobalFilters = async () => {
  await AsyncStorage.removeItem(GLOBAL_KEY);
  await AsyncStorage.removeItem("filters_inited"); 
};

export const initGlobalFilters = async (profileTerritory) => {
  const alreadyInited = await AsyncStorage.getItem("filters_inited");
  if (alreadyInited) return;

  const savedTerritory = await loadGlobalTerritory();
  const savedDate = await loadGlobalDateFilter();

  if (!savedTerritory && profileTerritory)
    await saveGlobalTerritory(profileTerritory);

  if (!savedDate)
    await saveGlobalDateFilter({
      type: "year",
      year: new Date().getFullYear(),
    });

  await AsyncStorage.setItem("filters_inited", "true");
};
