jest.mock("react-native-toast-message", () => ({ hide: jest.fn(), show: jest.fn() }));
jest.mock("../../services/errors", () => ({ logError: jest.fn(), showError: jest.fn() }));
jest.mock("../../store/profile-context", () => ({ useProfile: jest.fn() }));

import Toast from "react-native-toast-message";
import { renderHook } from "@testing-library/react-native";
import { logError, showError } from "../../services/errors";
import { useProfile } from "../../store/profile-context";
import { useApiError } from "../useApiError";

const mockProfile = (overrides: Record<string, unknown> = {}) => {
  (useProfile as jest.Mock).mockReturnValue({ error: null, profileLoading: false, ...overrides });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile();
});

describe("showErrorToast", () => {
  it("logs and shows the error when there's no profile error/loading in the way", async () => {
    const { result } = await renderHook(() => useApiError());
    const error = new Error("boom");

    result.current.showErrorToast(error, "MyTag", undefined);

    expect(logError).toHaveBeenCalledWith(error, "MyTag");
    expect(showError).toHaveBeenCalledWith(error, undefined);
  });

  it("forwards a custom extractor through to showError", async () => {
    const { result } = await renderHook(() => useApiError());
    const extractor = jest.fn();

    result.current.showErrorToast(new Error("boom"), "Tag", extractor);
    expect(showError).toHaveBeenCalledWith(expect.any(Error), extractor);
  });

  it("does nothing for a falsy error", async () => {
    const { result } = await renderHook(() => useApiError());
    result.current.showErrorToast(null);
    expect(logError).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it("is suppressed while there's an existing profile error", async () => {
    mockProfile({ error: new Error("profile failed") });
    const { result } = await renderHook(() => useApiError());

    result.current.showErrorToast(new Error("boom"));
    expect(logError).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it("is suppressed while the profile is still loading", async () => {
    mockProfile({ profileLoading: true });
    const { result } = await renderHook(() => useApiError());

    result.current.showErrorToast(new Error("boom"));
    expect(logError).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });
});

describe("profile-error toast dismissal", () => {
  it("hides any visible toast once a profile error appears", async () => {
    mockProfile({ error: new Error("profile failed") });
    await renderHook(() => useApiError());
    expect(Toast.hide).toHaveBeenCalledTimes(1);
  });

  it("does not touch the toast on mount when there's no profile error", async () => {
    await renderHook(() => useApiError());
    expect(Toast.hide).not.toHaveBeenCalled();
  });
});
