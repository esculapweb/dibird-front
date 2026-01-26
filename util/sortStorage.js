import AsyncStorage from "@react-native-async-storage/async-storage";

const SORT_KEY = "sorting";

export const saveSort = async (sort) => {
  try {
    await AsyncStorage.setItem(SORT_KEY, JSON.stringify(sort));
  } catch (e) {
    console.warn("Failed to save sorting", e);
  }
};

export const loadSort = async () => {
  try {
    const json = await AsyncStorage.getItem(SORT_KEY);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.warn("Failed to load sorting", e);
    return null;
  }
};
