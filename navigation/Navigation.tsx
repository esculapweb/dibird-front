import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useRef } from "react";
import { InitialState, CommonActions } from "@react-navigation/native";
import { NavigationContainer } from "@react-navigation/native";

import { track } from "../services/analytics";
import { useAuth } from "../store/auth-context";
import AuthNavigator from "./AuthStack";
import AppNavigator from "./AppStack";
import { useTheme } from "../store/theme-context";
import {
  LightNavigationTheme,
  DarkNavigationTheme,
} from "../constants/NavigationTheme";
import linking from "../linking";
import { navigationIntegration } from "../services/sentry";
import {
  dispatchWhenReady,
  flushPendingNavigation,
  navigationRef,
} from "../services/navigationRef";
import { takeAuthReturn } from "../services/authReturn";
import { clearOnboardingPending } from "../util/storageHelper";
import type { MinimalRoute, NavState } from "../types";

const NAV_STATE_KEY = "NAV_STATE";

// Экраны логина/регистрации. Нужны, чтобы отличить «гость вошёл, не выходя из
// воронки» от «гость передумал, ушёл гулять и залогинился через час совсем в
// другом месте»: во втором случае возвращать его на давнюю страницу птицы —
// телепорт, а не удобство.
const AUTH_FUNNEL_SCREENS = new Set([
  "Login",
  "Signup",
  "CheckEmail",
  "ConfirmEmail",
]);

const extractRoutes = (state: NavState, depth = 0): MinimalRoute[] => {
  if (depth > 10) return [];
  const routes = state?.routes ?? [];
  const index = state?.index ?? routes.length - 1;
  const activeRoute = routes[index];

  if (!activeRoute) return [];

  if (activeRoute.state) {
    const nested = activeRoute.state;
    const nestedRoutes = nested?.routes ?? [];
    const isDrawer = nestedRoutes.every(
      (r) => !r.state && r.name === "MainScreen",
    );

    if (isDrawer) {
      return [{ name: activeRoute.name }];
    }

    return [
      { name: activeRoute.name },
      ...extractRoutes(activeRoute.state, depth + 1),
    ];
  }

  return [{ name: activeRoute.name, params: activeRoute.params }];
};

const buildInitialState = (
  routes: MinimalRoute[],
  isAuthenticated: boolean,
): InitialState | null => {
  const screenRoutes =
    routes[0]?.name === "Root" || routes[0]?.name === "Main"
      ? routes.slice(1)
      : routes;

  const innerRoutes = screenRoutes.map((r) => ({
    name: r.name,
    params: r.params,
  }));

  // Корень берётся из фактической аутентификации, а не угадывается по составу
  // сохранённого стека. Раньше "Welcome" ставился, только если в стеке был
  // Login/Signup/CheckEmail/ConfirmEmail, иначе — "Main"; но каталожные экраны
  // (catalogScreens) общие для обоих навигаторов, и гость, закрывший
  // приложение на Taxonomy, получал корнем "Main", которого в AuthStack нет.
  // React Navigation такой роут выбрасывает — гость оставался на каталоге
  // один: ни кнопки «назад», ни бургера, до Welcome и регистрации не добраться.
  const root = isAuthenticated ? "Main" : "Welcome";

  const allRoutes = [{ name: root }, ...innerRoutes];

  return {
    index: allRoutes.length - 1,
    routes: allRoutes,
  };
};

const Navigation = () => {
  const { theme } = useTheme();
  const { isAuthenticated, isInitializing } = useAuth();
  const routeNameRef = useRef<string | undefined>(undefined);
  const prevAuthRef = useRef<boolean | null>(null);
  // Последний экран, на котором гостя застали до логина. Обновляется только
  // пока `!isAuthenticated`, поэтому переключение навигатора его не затирает.
  const lastGuestRouteRef = useRef<MinimalRoute | null>(null);

  const [initialState, setInitialState] = useState<
    InitialState | null | undefined
  >(undefined);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Ждём восстановления токена (SecureStore + возможная биометрия): пока оно
    // идёт, isAuthenticated ещё false, и построенный по нему корень был бы
    // «гостевым» у залогиненного. NavigationContainer читает initialState один
    // раз при монтировании, вторая попытка уже ничего не исправит — поэтому
    // до готовности auth рендерим null (см. ранний return ниже), а не гадаем.
    if (isInitializing) return;

    const restore = async () => {
      try {
        const saved = await AsyncStorage.getItem(NAV_STATE_KEY);

        if (!saved) {
          setInitialState(null);
          return;
        }

        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const built = buildInitialState(parsed, isAuthenticated);
          setInitialState(built ?? null);
          return;
        }

        await AsyncStorage.removeItem(NAV_STATE_KEY);
        setInitialState(null);
      } catch {
        setInitialState(null);
      }
    };

    restore();
    // isAuthenticated намеренно не в зависимостях: восстановление — разовое,
    // при смене логина стек сбрасывается эффектом ниже, а не перечитывается.
  }, [isInitializing]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    // Тот же ранний выход, что и в восстановлении: до готовности auth
    // isAuthenticated ещё false, и первый же его переход в true (просто
    // прочитали токен из SecureStore) выглядел бы как логин — стек сносился
    // бы на каждом запуске залогиненного, вдобавок наперегонки с чтением
    // выше. Стартовое значение фиксируем уже разрешённым.
    if (isInitializing) return;

    if (prevAuthRef.current === null) {
      prevAuthRef.current = isAuthenticated;
      return;
    }
    if (prevAuthRef.current === isAuthenticated) return;

    prevAuthRef.current = isAuthenticated;
    AsyncStorage.removeItem(NAV_STATE_KEY);

    // Забираем всегда, даже на логауте: намерение не должно пережить
    // ситуацию, ради которой ставилось. Асинхронно, потому что намерение
    // переживает и перезапуск процесса (см. services/authReturn.ts).
    takeAuthReturn().then((target) => {
      if (!isAuthenticated || !target) return;

      // Гость вошёл со страницы справочника (шторка useRequireAuth). Навигатор
      // к этому моменту уже переключился на AppStack и стоит на MainScreen —
      // возвращаем экран, с которого всё начиналось, поверх Main, чтобы «назад»
      // вело туда же, куда вело бы у обычного пользователя.
      //
      // Гард нужен, чтобы не телепортировать того, кто передумал, ушёл гулять и
      // залогинился через час совсем в другом месте. Но работает он только на
      // тёплом пути: если приложение перезапустилось (регистрация по почте
      // уводит в почтовый клиент, ссылка возвращает холодным стартом), гость по
      // этому стеку не ходил и `lastGuestRouteRef` пуст. Там роль «не выходя из
      // воронки» играет суточный TTL самого намерения.
      const from = lastGuestRouteRef.current?.name;
      const coldStart = from === undefined;
      const inFunnel =
        coldStart || from === target.name || AUTH_FUNNEL_SCREENS.has(from);
      if (!inFunnel) return;

      // Онбординг для этого человека закончен, не начавшись. Он завёл аккаунт
      // ради конкретной птицы, и сброс ниже всё равно снимет экран онбординга
      // со стека; с непогашенным флагом тот всплыл бы на следующем холодном
      // старте — поверх воронки, из которой он уже вышел. Прогонять его через
      // «выберите страну» значит отобрать намерение, ради которого делались
      // 1.1 и 1.2.
      clearOnboardingPending().catch(
        (e) => __DEV__ && console.warn("[NAV] failed to clear onboarding", e),
      );

      // Не прямой dispatch: на входе в аккаунт навигатора может секунду не
      // быть — `AppStack` рендерит null, пока перечитывается флаг онбординга,
      // и reset терялся вместе с намерением (см. dispatchWhenReady).
      dispatchWhenReady(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "Main" },
            { name: target.name, params: target.params },
          ],
        }),
      );
    });
  }, [isAuthenticated, isInitializing]);

  if (initialState === undefined) return null;

  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={initialState ?? undefined}
      linking={linking(isAuthenticated)}
      theme={theme === "dark" ? DarkNavigationTheme : LightNavigationTheme}
      onReady={() => {
        flushPendingNavigation();

        navigationIntegration.registerNavigationContainer(navigationRef);
        const current = navigationRef.current?.getCurrentRoute()?.name;

        routeNameRef.current = current;

        if (current) {
          track("screen_view", {
            screen_name: current,
            screen_class: current,
          });
        }
      }}
      onStateChange={async (state) => {
        if (state) {
          const routes = extractRoutes(state as NavState);
          if (!isAuthenticated) {
            lastGuestRouteRef.current = routes.at(-1) ?? null;
          }
          // Онбординг не персистим: buildInitialState всегда ставит корнем
          // "Main", и сохранённый [Onboarding] вернулся бы как [Main,
          // Onboarding] — поток поверх дашборда, с которого «назад» уводит на
          // недонастроенный аккаунт. Пока флаг не проставлен, экран и так
          // окажется корнем стека (см. AppStack), восстанавливать нечего.
          // Только персист: screen_view ниже онбординг слать обязан, иначе в
          // воронке пропадёт весь шаг между sign_up и первым экраном.
          if (routes.at(-1)?.name !== "Onboarding") {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
              AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(routes)).catch(
                (e) => __DEV__ && console.warn("[NAV] failed to save state", e),
              );
            }, 300);
          }
        }

        const current = navigationRef.current?.getCurrentRoute()?.name;
        const previous = routeNameRef.current;

        if (current && previous !== current) {
          track("screen_view", {
            screen_name: current,
            screen_class: current,
          });
          routeNameRef.current = current;
        }
      }}
    >
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default Navigation;
