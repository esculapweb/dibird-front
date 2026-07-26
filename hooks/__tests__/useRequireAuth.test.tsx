jest.mock("../../store/auth-context", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn() },
}));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));

import { renderHook } from "@testing-library/react-native";

import { useAuth } from "../../store/auth-context";
import { BottomSheet } from "../../services/bottomSheet";
import { track } from "../../services/analytics";
import { useRequireAuth } from "../useRequireAuth";

const mockNavigation = { navigate: jest.fn() };
const mockShow = BottomSheet.show as jest.Mock;

const gate = async (isAuthenticated: boolean) => {
  (useAuth as jest.Mock).mockReturnValue({ isAuthenticated });
  const { result } = await renderHook(() => useRequireAuth());
  return result.current;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("signed in", () => {
  it("runs the action straight through", async () => {
    const run = jest.fn();

    (await gate(true))("add_observation", run);

    expect(run).toHaveBeenCalled();
    expect(mockShow).not.toHaveBeenCalled();
  });

  it("does not report an auth wall that was never shown", async () => {
    (await gate(true))("add_observation", jest.fn());

    expect(track).not.toHaveBeenCalled();
  });
});

describe("guest", () => {
  it("holds the action back and offers to create an account", async () => {
    const run = jest.fn();

    (await gate(false))("add_observation", run);

    expect(run).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "auth_required_title",
        confirmText: "signup",
      }),
    );
  });

  // Что именно упёрлось в стену — это и есть отчёт «за чем гость приходит»,
  // поэтому действие уезжает параметром, а не теряется.
  it("reports which action hit the wall", async () => {
    (await gate(false))("add_observation", jest.fn());

    expect(track).toHaveBeenCalledWith("auth_wall_shown", {
      action: "add_observation",
    });
  });

  it("sends the reader to signup on confirm", async () => {
    (await gate(false))("add_observation", jest.fn());

    mockShow.mock.calls[0][0].onConfirm();

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Signup");
  });

  // Отказ — это отказ: действие не должно выполниться «на всякий случай».
  it("still does not run the action if the sheet is dismissed", async () => {
    const run = jest.fn();

    (await gate(false))("add_observation", run);

    expect(mockShow.mock.calls[0][0].onConfirm).toBeDefined();
    expect(run).not.toHaveBeenCalled();
  });
});
