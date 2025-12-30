import axios from "axios";
import * as SecureStore from "expo-secure-store";

import { Config } from "../constants/config";

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
    console.log("AUTH API ERROR:", url);
    console.log(error.response?.data || error.message);
    throw error;
  }
};

const saveRefreshToken = async (refresh) => {
  if (refresh) {
    await SecureStore.setItemAsync("refreshToken", refresh);
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
