import AsyncStorage from "@react-native-async-storage/async-storage";

const SORT_KEY = "sorting";

export const saveSort = async (screen, sortValue) => {
  try {
    const json = await AsyncStorage.getItem(SORT_KEY);
    const allSorts = json ? JSON.parse(json) : {};
    allSorts[screen] = sortValue;
    await AsyncStorage.setItem(SORT_KEY, JSON.stringify(allSorts));
  } catch (e) {
    console.warn("Failed to save sorting", e);
  }
};

export const loadSort = async (screen) => {
  try {
    const json = await AsyncStorage.getItem(SORT_KEY);
    const allSorts = json ? JSON.parse(json) : {};
    return allSorts[screen] || null;
  } catch (e) {
    console.warn("Failed to load sorting", e);
    return null;
  }
};
