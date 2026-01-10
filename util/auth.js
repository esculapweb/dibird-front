import axios from "axios";
import * as SecureStore from "expo-secure-store";

import { Config } from "../constants/config";
import { canUseBiometrics } from "../services/bio";

const authApi = axios.create({
  baseURL: Config.baseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

const post = async (url, data) => {
  try {
    const response = await authApi.post(url, data, { withCredentials: false });
    return response.data;
  } catch (error) {
    console.warn("AUTH API ERROR:", url);
    console.warn(error.response?.data || error.message);
    throw error;
  }
};

const saveRefreshToken = async (refresh) => {
  if (!refresh) return;
  try{
  await SecureStore.setItemAsync("refresh", refresh, {
    requireAuthentication: await canUseBiometrics(),
  });
} catch (e) {
  console.info(e.message)
}
};

export const Login = async (email, password) => {
  const data = await post("/api-auth/login/", {
    email,
    password,
  });

  await saveRefreshToken(data.refresh);
  return data.access;
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
