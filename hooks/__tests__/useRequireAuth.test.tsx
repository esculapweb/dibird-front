jest.mock("../../store/auth-context", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { showContent: jest.fn() },
}));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));
// A stub rather than the real sheet: its contents are checked in
// components/Auth/__tests__/AuthGateSheet.test.tsx, and here only the callbacks
// the hook passes into it matter (and theme-context is kept out of here).
jest.mock("../../components/Auth/AuthGateSheet", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../services/authReturn", () => ({ setAuthReturn: jest.fn() }));

import { renderHook } from "@testing-library/react-native";
import type { ReactElement } from "react";

import { useAuth } from "../../store/auth-context";
import { BottomSheet } from "../../services/bottomSheet";
import { setAuthReturn } from "../../services/authReturn";
import { track } from "../../services/analytics";
import { useRequireAuth } from "../useRequireAuth";

const mockNavigation = { navigate: jest.fn() };
const mockRoute = {
  name: "SpeciesDetail",
  params: { segment: "osprey" },
};
const mockShowContent = BottomSheet.showContent as jest.Mock;

const gate = async (isAuthenticated: boolean) => {
  (useAuth as jest.Mock).mockReturnValue({ isAuthenticated });
  const { result } = await renderHook(() => useRequireAuth());
  return result.current;
};

const dismiss = jest.fn();

// The props the hook rendered the sheet with.
const sheetProps = () => {
  const element = mockShowContent.mock.calls[0][0].renderContent(
    dismiss,
  ) as ReactElement;
  return element.props as {
    dismiss: () => void;
    onEmailPress: () => void;
    onOpenDocument: (screen: "Terms" | "Privacy") => void;
  };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("signed in", () => {
  it("runs the action straight through", async () => {
    const run = jest.fn();

    (await gate(true))("add_observation", run);

    expect(run).toHaveBeenCalled();
    expect(mockShowContent).not.toHaveBeenCalled();
  });

  it("does not report an auth wall that was never shown", async () => {
    (await gate(true))("add_observation", jest.fn());

    expect(track).not.toHaveBeenCalled();
    expect(setAuthReturn).not.toHaveBeenCalled();
  });
});

describe("guest", () => {
  it("holds the action back and opens the auth sheet", async () => {
    const run = jest.fn();

    (await gate(false))("add_observation", run);

    expect(run).not.toHaveBeenCalled();
    expect(mockShowContent).toHaveBeenCalledTimes(1);
  });

  // Login recreates the navigator: without remembering the screen here there
  // would be nowhere to return to afterwards — by the time of the sign-in the
  // guest may already be standing on Login. The action travels along with the
  // screen — that is what the guest signed up for.
  it("remembers the screen the wall was hit on, and what was left undone", async () => {
    (await gate(false))("add_observation", jest.fn());

    expect(setAuthReturn).toHaveBeenCalledWith({
      name: "SpeciesDetail",
      params: { segment: "osprey", pendingAction: "add_observation" },
    });
  });

  // What exactly hit the wall is the report on "what guests come for", so the
  // action travels as a parameter instead of being lost.
  it("reports which action hit the wall", async () => {
    (await gate(false))("add_observation", jest.fn());

    expect(track).toHaveBeenCalledWith("auth_wall_shown", {
      action: "add_observation",
    });
  });

  // A regression: the only button used to be "Sign Up" leading to the signup
  // screen, and someone who already had an account had to look for sign-in in
  // the switcher at the bottom of the form.
  it("sends the reader to login, not signup, on the email option", async () => {
    (await gate(false))("add_observation", jest.fn());

    sheetProps().onEmailPress();

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Login");
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith("Signup");
  });

  // The sheet lives in a portal outside the navigator: navigating to another
  // screen while leaving it hanging on top is a visible bug, not a trifle.
  it("closes the sheet before navigating away", async () => {
    (await gate(false))("add_observation", jest.fn());

    sheetProps().onEmailPress();
    expect(dismiss).toHaveBeenCalledTimes(1);

    sheetProps().onOpenDocument("Terms");
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Terms");
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  // A refusal is a refusal: the action must not run "just in case".
  it("still does not run the action if the sheet is dismissed", async () => {
    const run = jest.fn();

    (await gate(false))("add_observation", run);

    sheetProps().dismiss();

    expect(run).not.toHaveBeenCalled();
  });
});
