import axios from "axios";
import * as SecureStore from "expo-secure-store";

import { Config } from "../constants/config";


const authenticate = async (mode, email, password) => {
  const url = `${Config.baseUrl}/api-auth/`;

  try {
    const response = await axios.post(
      `${url}/${mode}/`,
      {
        email: email,
        password: password,
      },
      {
        withCredentials: false,
      }
    );
    const token = response?.data?.access;
    await SecureStore.setItemAsync("refreshToken", response?.data?.refresh);
    return token;
  } catch (e) {
    console.log("error");
    console.log(e);
    console.log(e.response.data);
  }
};

export const CreateUser = (email, password) => {
  return authenticate("registration", email, password);
};

export const Login = (email, password) => {
  return authenticate("login", email, password);
};
