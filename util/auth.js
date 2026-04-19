import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

import api, { saveTokens, clearTokens, getRefreshToken } from "../services/api";

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

export const Logout = async (onLogoutCallback) => {
  try {
    const refresh = await getRefreshToken();
    if (refresh) {
      try {
        await api.post("/api-auth/logout/", { refresh });
      } catch (e) {
        if (e.response?.status !== 401)
          console.warn("Logout request failed", e.response?.status, e.message);
      }
    }
  } finally {
    try {
      await GoogleSignin.signOut();
    } catch {}
    clearTokens();
    await AsyncStorage.multiRemove(["profile", "filters", "sorting", "global"]);
    if (typeof onLogoutCallback === "function") onLogoutCallback();
  }
};

export const initGoogleSignIn = () => {
  GoogleSignin.configure({
    // webClientId из Google Cloud Console → OAuth 2.0 → Web client
    webClientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
    offlineAccess: false,
    scopes: ["profile", "email"],
  });
};

// ─── Google ──────────────────────────────────────────────────────
export const LoginWithGoogle = async () => {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken;
  if (!idToken) throw new Error("Google: no id_token");

  const { access, refresh } = await post("/auth/google/", {
    id_token: idToken,
  });

  await saveTokens({ access, refresh });
  return access;
};

// ─── Apple (только iOS) ──────────────────────────────────────────
export const LoginWithApple = async () => {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const { identityToken, fullName } = credential;
  if (!identityToken) throw new Error("Apple: no identity_token");

  const { access, refresh } = await post("/auth/apple/", {
    id_token: identityToken,
    // Apple отдаёт имя только при первом входе, потом null
    first_name: fullName?.givenName ?? "",
    last_name: fullName?.familyName ?? "",
  });

  await saveTokens({ access, refresh });
  return access;
};
