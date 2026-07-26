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
// Заглушка, а не настоящая шторка: содержимое проверяется в
// components/Auth/__tests__/AuthGateSheet.test.tsx, а здесь важны только
// колбэки, которые хук в неё передаёт (и не тянуть сюда theme-context).
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

// Пропсы, с которыми хук отрисовал шторку.
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

  // Логин пересоздаёт навигатор: не запомнив экран здесь, вернуть на него
  // потом будет неоткуда — к моменту входа гость может стоять уже на Login.
  // Вместе с экраном едет и само действие — за ним гость и регистрировался.
  it("remembers the screen the wall was hit on, and what was left undone", async () => {
    (await gate(false))("add_observation", jest.fn());

    expect(setAuthReturn).toHaveBeenCalledWith({
      name: "SpeciesDetail",
      params: { segment: "osprey", pendingAction: "add_observation" },
    });
  });

  // Что именно упёрлось в стену — это и есть отчёт «за чем гость приходит»,
  // поэтому действие уезжает параметром, а не теряется.
  it("reports which action hit the wall", async () => {
    (await gate(false))("add_observation", jest.fn());

    expect(track).toHaveBeenCalledWith("auth_wall_shown", {
      action: "add_observation",
    });
  });

  // Регрессия: единственной кнопкой была «Sign Up» на экран регистрации, и
  // тот, у кого аккаунт уже есть, искал вход в переключателе внизу формы.
  it("sends the reader to login, not signup, on the email option", async () => {
    (await gate(false))("add_observation", jest.fn());

    sheetProps().onEmailPress();

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Login");
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith("Signup");
  });

  // Шторка живёт в портале вне навигатора: уехать на другой экран, оставив
  // её висеть поверх, — заметный баг, а не мелочь.
  it("closes the sheet before navigating away", async () => {
    (await gate(false))("add_observation", jest.fn());

    sheetProps().onEmailPress();
    expect(dismiss).toHaveBeenCalledTimes(1);

    sheetProps().onOpenDocument("Terms");
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Terms");
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  // Отказ — это отказ: действие не должно выполниться «на всякий случай».
  it("still does not run the action if the sheet is dismissed", async () => {
    const run = jest.fn();

    (await gate(false))("add_observation", run);

    sheetProps().dismiss();

    expect(run).not.toHaveBeenCalled();
  });
});
