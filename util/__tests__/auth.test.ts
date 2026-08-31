// jest.config.js's setupFiles path only evaluates the mock module without
// wiring it up as a replacement — the documented way to actually intercept
// AsyncStorage is this explicit jest.mock (see async-storage's own jest
// integration docs); no other existing test imports AsyncStorage directly,
// so this gap in the shared setup went unnoticed until now.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
  getRefreshToken: jest.fn(),
}));
jest.mock("../../services/errors", () => ({
  logError: jest.fn(),
}));
jest.mock("../storageHelper", () => ({
  markOnboardingPending: jest.fn(async () => {}),
}));
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signOut: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    getTokens: jest.fn(),
  },
}));
jest.mock("expo-apple-authentication", () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
// jest.setup.js's global @sentry/react-native mock doesn't include
// addBreadcrumb (only wrap/captureException/init) — LoginWithGoogle needs
// it, so override with the fuller shape for this file.
jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Sentry from "@sentry/react-native";
import { logEvent } from "@react-native-firebase/analytics";
import api, { saveTokens, clearTokens, getRefreshToken } from "../../services/api";
import { logError } from "../../services/errors";
import { markOnboardingPending } from "../storageHelper";
import {
  Login,
  CreateUser,
  Logout,
  LoginWithGoogle,
  LoginWithApple,
  requestPasswordReset,
  confirmPasswordReset,
  changePassword,
  resendVerificationEmail,
  connectGoogle,
  connectApple,
} from "../auth";

const apiPost = api.post as jest.Mock;
const markPending = markOnboardingPending as jest.Mock;

// The "flag → tokens" order is checked by jest's global invocation counter. The
// point is that saveTokens itself switches the auth context (notifyTokenUpdate →
// authenticate), and OnboardingProvider reads the flag exactly once on that
// transition: a flag written later does not make it to disk in time, and the
// newcomer lands straight on the dashboard.
const flagCallOrder = () => markPending.mock.invocationCallOrder[0];
const tokensCallOrder = () =>
  (saveTokens as jest.Mock).mock.invocationCallOrder[0];

beforeEach(() => {
  jest.clearAllMocks();
  (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
});

describe("Login", () => {
  it("posts credentials, saves the returned tokens, and logs an email login event", async () => {
    apiPost.mockResolvedValueOnce({ data: { access: "a", refresh: "r" } });

    const access = await Login("jane@example.com", "hunter2");

    expect(apiPost).toHaveBeenCalledWith(
      "/api-auth/login/",
      { email: "jane@example.com", password: "hunter2" },
      { withCredentials: false },
    );
    expect(saveTokens).toHaveBeenCalledWith({ access: "a", refresh: "r" });
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), "login", { method: "email" });
    expect(access).toBe("a");
  });
});

describe("CreateUser", () => {
  it("posts registration payload and logs a sign_up event", async () => {
    apiPost.mockResolvedValueOnce({ data: { id: 1 } });

    await CreateUser("jane@example.com", "hunter2", "jane");

    expect(apiPost).toHaveBeenCalledWith(
      "/api-auth/registration/?agree_terms=1",
      {
        email: "jane@example.com",
        username: "jane",
        password1: "hunter2",
        password2: "hunter2",
        agree_terms: true,
      },
      { withCredentials: false },
    );
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), "sign_up", { method: "email" });
    // There is no token here yet (the email has to be confirmed), but the flag is
    // set right away and survives leaving the app — the sign-in comes back through
    // the Login screen.
    expect(markPending).toHaveBeenCalledTimes(1);
  });
});

describe("Logout", () => {
  const okLogout = () => {
    (getRefreshToken as jest.Mock).mockResolvedValue("refresh-token");
    apiPost.mockResolvedValue({ data: {} });
    (GoogleSignin.signOut as jest.Mock).mockResolvedValue(undefined);
    (clearTokens as jest.Mock).mockResolvedValue(undefined);
    jest.spyOn(AsyncStorage, "multiRemove").mockResolvedValue(undefined);
  };

  it("posts the refresh token, signs out of Google, clears tokens, and wipes AsyncStorage keys", async () => {
    okLogout();
    const onLogoutCallback = jest.fn();

    await Logout(onLogoutCallback);

    expect(apiPost).toHaveBeenCalledWith("/api-auth/logout/", { refresh: "refresh-token" });
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(clearTokens).toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      "profile",
      "filters",
      "sorting",
      "global",
    ]);
    expect(onLogoutCallback).toHaveBeenCalledTimes(1);
  });

  it("still clears tokens and fires the callback when getRefreshToken itself throws", async () => {
    okLogout();
    (getRefreshToken as jest.Mock).mockRejectedValue(new Error("SecureStore unavailable"));
    const onLogoutCallback = jest.fn();

    await Logout(onLogoutCallback);

    expect(apiPost).not.toHaveBeenCalled();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(clearTokens).toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    expect(onLogoutCallback).toHaveBeenCalledTimes(1);
  });

  it("logs but does not block cleanup when the /logout/ POST fails with a non-401", async () => {
    okLogout();
    apiPost.mockRejectedValue({ response: { status: 500 } });
    const onLogoutCallback = jest.fn();

    await Logout(onLogoutCallback);

    expect(logError).toHaveBeenCalledWith(expect.anything(), "Logout request");
    expect(clearTokens).toHaveBeenCalled();
    expect(onLogoutCallback).toHaveBeenCalledTimes(1);
  });

  it("does not log a 401 from the /logout/ POST (an already-expired session is expected)", async () => {
    okLogout();
    apiPost.mockRejectedValue({ response: { status: 401 } });
    const onLogoutCallback = jest.fn();

    await Logout(onLogoutCallback);

    expect(logError).not.toHaveBeenCalledWith(expect.anything(), "Logout request");
    expect(onLogoutCallback).toHaveBeenCalledTimes(1);
  });

  it("still clears tokens and AsyncStorage when GoogleSignin.signOut throws", async () => {
    okLogout();
    (GoogleSignin.signOut as jest.Mock).mockRejectedValue(new Error("no session"));
    const onLogoutCallback = jest.fn();

    await Logout(onLogoutCallback);

    expect(logError).toHaveBeenCalledWith(expect.anything(), "GoogleSignin.signOut");
    expect(clearTokens).toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    expect(onLogoutCallback).toHaveBeenCalledTimes(1);
  });

  it("still wipes AsyncStorage and fires the callback when clearTokens throws", async () => {
    okLogout();
    (clearTokens as jest.Mock).mockRejectedValue(new Error("keychain error"));
    const onLogoutCallback = jest.fn();

    await Logout(onLogoutCallback);

    expect(logError).toHaveBeenCalledWith(expect.anything(), "clearTokens");
    expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    expect(onLogoutCallback).toHaveBeenCalledTimes(1);
  });

  it("still fires the callback when AsyncStorage.multiRemove throws", async () => {
    okLogout();
    jest.spyOn(AsyncStorage, "multiRemove").mockRejectedValue(new Error("storage error"));
    const onLogoutCallback = jest.fn();

    await Logout(onLogoutCallback);

    expect(logError).toHaveBeenCalledWith(expect.anything(), "AsyncStorage.multiRemove");
    expect(onLogoutCallback).toHaveBeenCalledTimes(1);
  });
});

describe("LoginWithGoogle", () => {
  it("returns null without signing in when hasPlayServices fails", async () => {
    (GoogleSignin.hasPlayServices as jest.Mock).mockRejectedValueOnce(new Error("no play services"));

    const result = await LoginWithGoogle();

    expect(result).toBeNull();
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { auth_provider: "google" } }),
    );
  });

  it("returns null when GoogleSignin.signIn resolves with no user data", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({});

    const result = await LoginWithGoogle();

    expect(result).toBeNull();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("throws and reports to Sentry when the id/access token is missing", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ data: { idToken: null } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValueOnce({ accessToken: "at" });

    await expect(LoginWithGoogle()).rejects.toMatchObject({ message: "Google: missing tokens" });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { auth_provider: "google" } }),
    );
  });

  it("clears local tokens before posting, saves the new tokens, and logs sign_up for a new user", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ data: { idToken: "idt" } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValueOnce({ accessToken: "at" });
    apiPost.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", is_new_user: true },
    });

    const access = await LoginWithGoogle();

    expect(clearTokens).toHaveBeenCalled();
    expect(apiPost).toHaveBeenCalledWith(
      "/auth/google/?agree_terms=1",
      { access_token: "at", id_token: "idt" },
      { withCredentials: false },
    );
    expect(saveTokens).toHaveBeenCalledWith({ access: "a", refresh: "r" });
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), "sign_up", { method: "google" });
    expect(access).toBe("a");
  });

  it("marks the onboarding flag before the tokens flip the auth context", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ data: { idToken: "idt" } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValueOnce({ accessToken: "at" });
    apiPost.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", is_new_user: true },
    });

    await LoginWithGoogle();

    expect(markPending).toHaveBeenCalledTimes(1);
    expect(flagCallOrder()).toBeLessThan(tokensCallOrder());
  });

  it("logs a login event (not sign_up) for a returning user", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ data: { idToken: "idt" } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValueOnce({ accessToken: "at" });
    apiPost.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", is_new_user: false },
    });

    await LoginWithGoogle();

    expect(logEvent).toHaveBeenCalledWith(expect.anything(), "login", { method: "google" });
    expect(markPending).not.toHaveBeenCalled();
  });

  // The key is missing from the response — exactly what the backend returned while
  // the get_response_data override hung as a dead hook: the veteran path, no
  // onboarding.
  it("treats a response without is_new_user as a returning user", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ data: { idToken: "idt" } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValueOnce({ accessToken: "at" });
    apiPost.mockResolvedValueOnce({ data: { access: "a", refresh: "r" } });

    await LoginWithGoogle();

    expect(markPending).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), "login", { method: "google" });
  });
});

describe("LoginWithApple", () => {
  it("throws when Apple returns no identity token", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: null,
    });

    await expect(LoginWithApple()).rejects.toMatchObject({
      message: "Apple: no identity_token",
    });
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("saves the returned tokens and logs sign_up for a new user", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: "idt",
      fullName: { givenName: "Jane", familyName: "Doe" },
    });
    apiPost.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", is_new_user: true },
    });

    const access = await LoginWithApple();

    expect(apiPost).toHaveBeenCalledWith(
      "/auth/apple/?agree_terms=1",
      {
        access_token: "idt",
        id_token: "idt",
        first_name: "Jane",
        last_name: "Doe",
      },
      { withCredentials: false },
    );
    expect(saveTokens).toHaveBeenCalledWith({ access: "a", refresh: "r" });
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), "sign_up", { method: "apple" });
    expect(access).toBe("a");
  });

  it("marks the onboarding flag before the tokens flip the auth context", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: "idt",
      fullName: null,
    });
    apiPost.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", is_new_user: true },
    });

    await LoginWithApple();

    expect(markPending).toHaveBeenCalledTimes(1);
    expect(flagCallOrder()).toBeLessThan(tokensCallOrder());
  });

  it("logs a login event (not sign_up) for a returning user", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: "idt",
      fullName: null,
    });
    apiPost.mockResolvedValueOnce({
      data: { access: "a", refresh: "r", is_new_user: false },
    });

    await LoginWithApple();

    expect(logEvent).toHaveBeenCalledWith(expect.anything(), "login", { method: "apple" });
    expect(markPending).not.toHaveBeenCalled();
  });
});

describe("password endpoints", () => {
  it("asks for a reset letter", async () => {
    apiPost.mockResolvedValueOnce({ data: { detail: "sent" } });

    await requestPasswordReset("jane@example.com");

    expect(apiPost).toHaveBeenCalledWith(
      "/api-auth/password/reset/",
      { email: "jane@example.com" },
      { withCredentials: false },
    );
  });

  it("sends the uid/token pair and the new password twice on confirm", async () => {
    apiPost.mockResolvedValueOnce({ data: { detail: "ok" } });

    await confirmPasswordReset({ uid: "687", token: "de75v1-abc", password: "hunter22" });

    expect(apiPost).toHaveBeenCalledWith(
      "/api-auth/password/reset/confirm/",
      {
        uid: "687",
        token: "de75v1-abc",
        new_password1: "hunter22",
        new_password2: "hunter22",
      },
      { withCredentials: false },
    );
  });

  // The backend drops old_password entirely for an account that has none
  // (CustomPasswordChangeSerializer), and sending the field there is a 400 —
  // so "set a password" must omit the key rather than send it empty.
  it("omits old_password when there is none to confirm with", async () => {
    apiPost.mockResolvedValueOnce({ data: { detail: "ok" } });

    await changePassword({ password: "hunter22" });

    expect(apiPost).toHaveBeenCalledWith(
      "/api-auth/password/change/",
      { new_password1: "hunter22", new_password2: "hunter22" },
      { withCredentials: false },
    );
  });

  it("sends old_password when there is one", async () => {
    apiPost.mockResolvedValueOnce({ data: { detail: "ok" } });

    await changePassword({ oldPassword: "old-one", password: "hunter22" });

    expect(apiPost).toHaveBeenCalledWith(
      "/api-auth/password/change/",
      {
        old_password: "old-one",
        new_password1: "hunter22",
        new_password2: "hunter22",
      },
      { withCredentials: false },
    );
  });

  it("resends the signup confirmation letter", async () => {
    apiPost.mockResolvedValueOnce({ data: {} });

    await resendVerificationEmail("jane@example.com");

    expect(apiPost).toHaveBeenCalledWith(
      "/api-auth/registration/resend-email/",
      { email: "jane@example.com" },
      { withCredentials: false },
    );
  });
});

describe("connecting a provider to an account already signed in", () => {
  it("posts the Google tokens to the connect endpoint and keeps the session", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ data: { idToken: "it" } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValueOnce({ accessToken: "at" });
    apiPost.mockResolvedValueOnce({ data: {} });

    const result = await connectGoogle();

    expect(result).toBe(true);
    expect(apiPost).toHaveBeenCalledWith(
      "/auth/google/connect/",
      { access_token: "at", id_token: "it" },
      { withCredentials: false },
    );
    // The whole difference from a login: connecting must not drop the tokens
    // of the session doing the connecting, nor mint new ones.
    expect(clearTokens).not.toHaveBeenCalled();
    expect(saveTokens).not.toHaveBeenCalled();
  });

  // Without this the SDK hands back the session already on the device and
  // "link a different account" silently re-attaches the connected one.
  it("signs out of Google first so the account picker appears", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ data: { idToken: "it" } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValueOnce({ accessToken: "at" });
    apiPost.mockResolvedValueOnce({ data: {} });

    await connectGoogle();

    expect((GoogleSignin.signOut as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (GoogleSignin.signIn as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it("reports backing out of the dialog as false, without calling the server", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({});

    const result = await connectGoogle();

    expect(result).toBe(false);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("posts the Apple identity token to the connect endpoint", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: "id-token",
      fullName: { givenName: "Jane", familyName: "Doe" },
    });
    apiPost.mockResolvedValueOnce({ data: {} });

    const result = await connectApple();

    expect(result).toBe(true);
    expect(apiPost).toHaveBeenCalledWith(
      "/auth/apple/connect/",
      {
        access_token: "id-token",
        id_token: "id-token",
        first_name: "Jane",
        last_name: "Doe",
      },
      { withCredentials: false },
    );
    expect(saveTokens).not.toHaveBeenCalled();
  });
});
