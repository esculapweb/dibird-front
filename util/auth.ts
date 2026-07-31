import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as Sentry from "@sentry/react-native";

import api, { saveTokens, clearTokens, getRefreshToken } from "../services/api";
import { track } from "../services/analytics";
import { markOnboardingPending } from "./storageHelper";
import { Config } from "../constants/config";
import { AppError } from "../types";
import { logError } from "../services/errors";

const post = async (url: string, data: unknown) => {
  try {
    const response = await api.post(url, data, { withCredentials: false });
    return response?.data;
  } catch (e) {
    logError(e, "AUTH API ERROR");
    throw e;
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

  track("login", { method: "email" });

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
  // There is no token here yet: the email has to be confirmed, and the person
  // comes back to the app through the `Login` screen. The flag lies in
  // AsyncStorage and survives this path — otherwise the onboarding would only
  // reach Apple/Google users.
  await markOnboardingPending();
  track("sign_up", { method: "email" });
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
        await api.post("/api-auth/logout/", { refresh });
      } catch (e) {
        const err = e as AppError;
        if (err.response?.status !== 401) logError(err, "Logout request");
      }
    }
  } finally {
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      logError(e, "GoogleSignin.signOut");
    }
    try {
      await clearTokens();
    } catch (e) {
      logError(e, "clearTokens");
    }
    try {
      await AsyncStorage.multiRemove([
        "profile",
        "filters",
        "sorting",
        "global",
      ]);
    } catch (e) {
      logError(e, "AsyncStorage.multiRemove");
    }

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

    // Strictly before `saveTokens`: that one switches the auth context from the
    // inside (`notifyTokenUpdate` → `authenticate` in store/auth-context.tsx), and
    // `OnboardingProvider` reads the flag on `isAuthenticated` turning true and
    // makes no second attempt. Written afterwards, it would not reach the disk by
    // the time of the read, and the newcomer would land straight on the dashboard.
    if (is_new_user) await markOnboardingPending();

    await saveTokens({ access, refresh });

    const eventName = is_new_user ? "sign_up" : "login";

    track(eventName, { method: "google" });

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

  // See the comment in LoginWithGoogle: the flag has to reach the disk before
  // saveTokens switches the auth context.
  if (is_new_user) await markOnboardingPending();
  await saveTokens({ access, refresh });
  const eventName = is_new_user ? "sign_up" : "login";
  track(eventName, { method: "apple" });
  return access;
};
