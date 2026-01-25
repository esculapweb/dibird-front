import AsyncStorage from "@react-native-async-storage/async-storage";

import api, {
  saveTokens,
  clearTokens,
  getRefreshToken,
} from "../services/api";

const post = async (url, data) => {
  try {
    const response = await api.post(url, data, { withCredentials: false });
    return response?.data;
  } catch (e) {
    console.warn("AUTH API ERROR:", url);
    console.warn(e.response?.data || e.message);
    throw e;
  }
};

export const Login = async (email, password) => {
  const { access, refresh } = await post("/api-auth/login/", {
    email,
    password,
  });

  await saveTokens({
    access,
    refresh,
  });

  return access;
};

export const CreateUser = async (email, password, username) => {
  const data = await post("/api-auth/registration/", {
    email,
    username,
    password1: password,
    password2: password,
  });
  return data;
};

export const Logout = async () => {
  try {
    const data = { refresh: await getRefreshToken() };
    const r = await api.post("/api-auth/logout/", data);
    console.info(r.data);
  } catch (e) {
    console.warn(
      "Logout request failed",
      e.response?.status,
      e.message
    );
  } finally {
    clearTokens();
    await AsyncStorage.removeItem("profile");
    await AsyncStorage.removeItem("filters");
  }
};
