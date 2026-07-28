import {
  createContext,
  useState,
  useRef,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

import { track, OnboardingStep } from "../services/analytics";
import {
  isOnboardingPending,
  markOnboardingPending,
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
  /**
   * Отладка: вернуть поток на аккаунте, который его уже прошёл. Настоящий флаг
   * ставится только на `sign_up`, поэтому иначе онбординг не посмотреть, не
   * заводя новый аккаунт. Вызывается из скрытой строки в `SettingsScreen` —
   * там же, где «Send test push», и под тем же гейтом по id профиля.
   *
   * Статус меняется без аналитики, но сам экран при монтировании шлёт
   * `onboarding_step` — прогоны отладчиков попадают в воронку, поэтому гейт
   * по id важен.
   */
  restart: () => Promise<void>;
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
  const prevAuthRef = useRef(isAuthenticated);

  // Сброс в `loading` делается прямо в рендере, а не в эффекте ниже: на входе
  // в аккаунт `Navigation` монтирует `AppStack` в том же рендере, в котором
  // `isAuthenticated` стал true, а эффекты выполняются уже после. Увидев
  // оставшийся от гостя `done`, стек успевал встать корнем `Main`, и
  // выставленный следом `needed` только добавлял экран в навигатор, никуда не
  // переходя: новичок оставался на дашборде с непогашенным флагом (онбординг
  // всплывал лишь при следующем холодном старте). Ставим `loading` до того,
  // как стек отрендерится, — он подождёт `null`, как и на холодном старте.
  if (isAuthenticated !== prevAuthRef.current) {
    prevAuthRef.current = isAuthenticated;
    if (isAuthenticated && status !== "loading") setStatus("loading");
  }

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

  const restart = useCallback(async () => {
    // Флаг ставится, а не только статус: без него онбординг исчез бы при
    // ближайшем перезапуске — эффект выше перечитывает диск на каждом входе.
    await markOnboardingPending();
    setStatus("needed");
  }, []);

  return (
    <OnboardingContext.Provider value={{ status, complete, skip, restart }}>
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
