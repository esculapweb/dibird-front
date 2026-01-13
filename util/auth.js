import AsyncStorage from "@react-native-async-storage/async-storage";

import api, {
  normalizeApiError,
  saveTokens,
  clearTokens,
  getRefreshToken,
} from "../services/api";

const post = async (url, data) => {
  try {
    const response = await api.post(url, data, { withCredentials: false });
    return response?.data;
  } catch (error) {
    console.warn("AUTH API ERROR:", url);
    console.warn(error.response?.data || error.message);
    throw normalizeApiError(error);
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
  } catch (error) {
    console.warn(
      "Logout request failed",
      error.response?.status,
      error.message
    );
  } finally {
    clearTokens();
    await AsyncStorage.removeItem("profile");
  }
};
