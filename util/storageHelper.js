import AsyncStorage from "@react-native-async-storage/async-storage";

const SORT_KEY = "sorting";
const FILTERS_KEY = "filters";

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


const LAST_OBSERVATION_DATE_KEY = "lastObservationDate";


export const getLastObservationDate = async () => {
  try {
    const isoDate = await AsyncStorage.getItem(LAST_OBSERVATION_DATE_KEY);
    return isoDate ? new Date(isoDate) : null;
  } catch (e) {
    console.warn("Failed to get last observation date", e);
    return null;
  }
};

export const setLastObservationDate = async (date) => {
  try {
    await AsyncStorage.setItem(
      LAST_OBSERVATION_DATE_KEY,
      date instanceof Date ? date.toISOString() : date
    );
  } catch (e) {
    console.warn("Failed to save last observation date", e);
  }
};