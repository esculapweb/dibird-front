jest.mock("../../services/analytics", () => ({ track: jest.fn() }));
jest.mock("../../util/storageHelper", () => ({
  isOnboardingPending: jest.fn(),
  clearOnboardingPending: jest.fn(),
}));

import { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { track } from "../../services/analytics";
import {
  isOnboardingPending,
  clearOnboardingPending,
} from "../../util/storageHelper";
import { OnboardingProvider, useOnboarding } from "../onboarding-context";

const mockIsPending = isOnboardingPending as jest.Mock;
const mockClearPending = clearOnboardingPending as jest.Mock;

const wrapper =
  (props: { isAuthenticated: boolean; isInitializing?: boolean }) =>
  ({ children }: { children: ReactNode }) => (
    <OnboardingProvider
      isAuthenticated={props.isAuthenticated}
      isInitializing={props.isInitializing ?? false}
    >
      {children}
    </OnboardingProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockIsPending.mockResolvedValue(true);
  mockClearPending.mockResolvedValue(undefined);
});

describe("initial status", () => {
  it("asks for onboarding when a sign-up left the flag behind", async () => {
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });

    await waitFor(() => expect(result.current.status).toBe("needed"));
  });

  // Гейт устроен от «регистрация только что была», а не от «онбординг уже
  // видели»: по отсутствию второго флага от новичка неотличим ветеран, который
  // переустановил приложение и вошёл в старый аккаунт.
  it("leaves an account without the flag alone", async () => {
    mockIsPending.mockResolvedValue(false);

    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
  });

  // У гостя онбординга нет: страну писать некуда, наблюдение создавать нечем.
  // Важно, что это именно "done", а не "loading" — на "loading" AppStack
  // рендерит null, и переход в аккаунт завис бы на пустом экране.
  it("resolves to done for a guest without touching the flag", async () => {
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: false }),
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(mockIsPending).not.toHaveBeenCalled();
  });

  // Пока восстанавливается токен, isAuthenticated ещё false — решение по нему
  // было бы принято по неготовым данным.
  it("waits for auth to settle before deciding", async () => {
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: false, isInitializing: true }),
    });

    expect(result.current.status).toBe("loading");
    expect(mockIsPending).not.toHaveBeenCalled();
  });
});

describe("finishing", () => {
  it("clears the flag and reports completion", async () => {
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });
    await waitFor(() => expect(result.current.status).toBe("needed"));

    await act(async () => {
      await result.current.complete();
    });

    expect(mockClearPending).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("onboarding_completed");
    expect(result.current.status).toBe("done");
  });

  it("reports the step the user walked away from", async () => {
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });
    await waitFor(() => expect(result.current.status).toBe("needed"));

    await act(async () => {
      await result.current.skip(3);
    });

    expect(track).toHaveBeenCalledWith("onboarding_skipped", { step: 3 });
    expect(track).not.toHaveBeenCalledWith("onboarding_completed");
    expect(result.current.status).toBe("done");
  });

  // Порядок важен: экран снимается с навигатора сменой статуса, и если
  // процесс убьют между снятием флага и переключением, лучше не показать
  // онбординг ещё раз, чем показать его поверх уже созданного наблюдения.
  it("clears the flag before it lets the screen go", async () => {
    let releaseWrite = () => {};
    mockClearPending.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseWrite = resolve;
      }),
    );

    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });
    await waitFor(() => expect(result.current.status).toBe("needed"));

    let finished = false;
    await act(async () => {
      result.current.complete().then(() => {
        finished = true;
      });
    });

    expect(result.current.status).toBe("needed");
    expect(finished).toBe(false);

    await act(async () => {
      releaseWrite();
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
  });
});
