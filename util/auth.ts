import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { getAnalytics, logEvent } from "@react-native-firebase/analytics";
import * as Sentry from "@sentry/react-native";

import api, { saveTokens, clearTokens, getRefreshToken } from "../services/api";
import { Config } from "../constants/config";
import { AppError } from "../types";
import { logoutRequest } from "./fetches";

const post = async (url: string, data: unknown) => {
  try {
    const response = await api.post(url, data, { withCredentials: false });
    return response?.data;
  } catch (e) {
    const err = e as AppError;
    if (__DEV__) {
      console.warn("AUTH API ERROR:", url);
      console.warn(err.response?.data || err.message);
    }
    throw err;
  }
};

export const Login = async (email: string, password: string) => {
  const { access, refresh } = await post("/api-auth/login/", {
    email,
    password,
  });

  await saveTokens({
    access,
    refresh,
  });

  logEvent(getAnalytics(), "login", { method: "email" });

  return access;
};

export const CreateUser = async (
  email: string,
  password: string,
  username: string,
) => {
  const data = await post("/api-auth/registration/?agree_terms=1", {
    email,
    username,
    password1: password,
    password2: password,
    agree_terms: true,
  });
  logEvent(getAnalytics(), "sign_up", { method: "email" });
  return data;
};

export const Logout = async (onLogoutCallback: () => void) => {
  try {
    let refresh: string | null = null;
    try {
      refresh = await getRefreshToken();
    } catch {}

    if (refresh) {
      try {
        await logoutRequest(refresh);
      } catch (e) {
        const err = e as AppError;
        if (err.response?.status !== 401 && __DEV__)
          console.warn(
            "Logout request failed",
            err.response?.status,
            err.message,
          );
      }
    }
  } finally {
    try {
      await GoogleSignin.signOut();
    } catch {}
    await clearTokens();
    await AsyncStorage.multiRemove(["profile", "filters", "sorting", "global"]);
    if (typeof onLogoutCallback === "function") onLogoutCallback();
  }
};

export const initGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: Config.googleWebClientId,
    iosClientId: Config.googleIosClientId,
    offlineAccess: false,
    scopes: ["profile", "email"],
  });
};

export const LoginWithGoogle = async () => {
  try {
    Sentry.addBreadcrumb({
      category: "auth",
      message: "Google sign in started",
      level: "info",
    });

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    } catch (e) {
      Sentry.captureException(e, {
        tags: { auth_provider: "google" },
        extra: { step: "hasPlayServices" },
      });
      return null;
    }

    const userInfo = await GoogleSignin.signIn();

    if (!userInfo?.data) {
      return null;
    }

    const tokens = await GoogleSignin.getTokens();

    const idToken = userInfo.data.idToken;
    const accessToken = tokens.accessToken;

    if (!idToken || !accessToken) {
      throw new Error("Google: missing tokens");
    }

    await clearTokens();

    Sentry.addBreadcrumb({
      category: "auth",
      message: "Sending Google tokens to backend",
      level: "info",
    });

    const result = await post("/auth/google/?agree_terms=1", {
      access_token: accessToken,
      id_token: idToken,
    });

    const { access, refresh, is_new_user } = result;

    await saveTokens({ access, refresh });

    const eventName = is_new_user ? "sign_up" : "login";

    logEvent(getAnalytics(), eventName as string, {
      method: "google",
    });

    Sentry.addBreadcrumb({
      category: "auth",
      message: `Google auth success: ${eventName}`,
      level: "info",
    });

    return access;
  } catch (e) {
    const error = e as AppError;

    Sentry.captureException(error, {
      tags: {
        auth_provider: "google",
      },
      extra: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      },
    });

    throw error;
  }
};

export const LoginWithApple = async () => {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const { identityToken, fullName } = credential;
  if (!identityToken) throw new Error("Apple: no identity_token");

  const { access, refresh, is_new_user } = await post(
    "/auth/apple/?agree_terms=1",
    {
      access_token: identityToken,
      id_token: identityToken,
      first_name: fullName?.givenName ?? "",
      last_name: fullName?.familyName ?? "",
    },
  );

  await saveTokens({ access, refresh });
  const eventName = is_new_user ? "sign_up" : "login";
  logEvent(getAnalytics(), eventName as string, { method: "apple" });
  return access;
};
