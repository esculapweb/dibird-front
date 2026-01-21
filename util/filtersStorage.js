import AsyncStorage from "@react-native-async-storage/async-storage";

const FILTERS_KEY = "@filters";

export const saveFilters = async (filters) => {
  try {
    await AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  } catch (e) {
    console.warn("Failed to save filters", e);
  }
};

export const loadFilters = async () => {
  try {
    const json = await AsyncStorage.getItem(FILTERS_KEY);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.warn("Failed to load filters", e);
    return null;
  }
};

export const clearFilters = async () => {
  try {
    await AsyncStorage.removeItem(FILTERS_KEY);
  } catch (e) {
    console.warn("Failed to clear filters", e);
  }
};
