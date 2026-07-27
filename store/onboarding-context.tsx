import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

import { track, OnboardingStep } from "../services/analytics";
import {
  isOnboardingPending,
  clearOnboardingPending,
} from "../util/storageHelper";

/**
 * `loading` — флаг ещё читается с диска. Различать его и `done` обязательно:
 * `AppStack` объявляет экран онбординга первым, то есть initial route стека
 * зависит от этого значения, а `NavigationContainer` читает начальный маршрут
 * один раз. Отрендерить навигатор с `Main` и добавить онбординг вторым рендером
 * уже нечем — человек так и останется на дашборде.
 */
export type OnboardingStatus = "loading" | "needed" | "done";

interface OnboardingContextType {
  status: OnboardingStatus;
  /** Прошёл до конца. */
  complete: () => Promise<void>;
  /** Нажал «Пропустить»; шаг нужен, чтобы видеть, где именно теряем. */
  skip: (step: OnboardingStep) => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const OnboardingProvider = ({
  children,
  isAuthenticated,
  isInitializing,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
  isInitializing: boolean;
}) => {
  const [status, setStatus] = useState<OnboardingStatus>("loading");

  useEffect(() => {
    // Тот же ранний выход, что в profile/alert-settings-контекстах: пока
    // восстанавливается токен, `isAuthenticated` ещё false, и решение о
    // «гостю онбординг не нужен» было бы принято по неготовым данным.
    if (isInitializing) return;

    if (!isAuthenticated) {
      // У гостя онбординга нет: страну писать некуда, наблюдение создавать
      // нечем. Не `loading` — иначе `AppStack` (он монтируется в тот же
      // рендер, что и переход в аккаунт) завис бы на пустом экране.
      setStatus("done");
      return;
    }

    let cancelled = false;
    // Флаг ставят три точки `sign_up` в `util/auth.ts`, и только они. Гейт от
    // «не видел онбординг» был бы гейтом от отсутствия ключа, то есть накрыл
    // бы и ветерана, вошедшего в старый аккаунт после переустановки.
    isOnboardingPending().then((pending) => {
      if (cancelled) return;
      setStatus(pending ? "needed" : "done");
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isInitializing]);

  const finish = useCallback(async () => {
    // Флаг снимается первым: экран убирается из навигатора сменой статуса, и
    // если процесс убьют между двумя операциями, лучше не показать онбординг
    // ещё раз, чем показать его поверх уже созданного наблюдения.
    await clearOnboardingPending();
    setStatus("done");
  }, []);

  const complete = useCallback(async () => {
    track("onboarding_completed");
    await finish();
  }, [finish]);

  const skip = useCallback(
    async (step: OnboardingStep) => {
      track("onboarding_skipped", { step });
      await finish();
    },
    [finish],
  );

  return (
    <OnboardingContext.Provider value={{ status, complete, skip }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (!context)
    throw new Error("useOnboarding must be used within OnboardingProvider");
  return context;
};
