import { useCallback } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useAuth } from "../store/auth-context";
import { BottomSheet } from "../services/bottomSheet";
import { setAuthReturn } from "../services/authReturn";
import AuthGateSheet from "../components/Auth/AuthGateSheet";
import { track, type GatedAction } from "../services/analytics";
import type { AuthStackNavigationProp } from "../types";

/**
 * Оборачивает действие, которому нужен аккаунт. У залогиненного вызывает его
 * как есть, у гостя показывает шторку «создайте аккаунт, чтобы сохранить».
 *
 * Мягкий upsell, а не стена: гость попадает сюда, уже посмотрев каталог, и
 * шторка объясняет, что именно он получит, — в отличие от экрана логина на
 * старте, где предлагать ещё нечего.
 *
 * Войти можно прямо из шторки — Apple/Google/почта (AuthOptions, тот же блок,
 * что на Welcome). Раньше единственным действием была кнопка «Sign Up» на
 * экран регистрации: у кого аккаунт уже есть, тот искал вход в переключателе
 * внизу чужой формы, а до Apple/Google из воронки было не добраться вовсе —
 * Welcome лежит под всем каталожным стеком, и «назад» из Signup возвращает на
 * страницу птицы, а не к кнопкам входа.
 *
 * Типизация навигации — `AuthStackNavigationProp`: переходы выполняются
 * только когда гость, а гость всегда в `AuthStack`.
 */
export const useRequireAuth = () => {
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<AuthStackNavigationProp>();
  const route = useRoute();

  return useCallback(
    (action: GatedAction, run: () => void) => {
      if (isAuthenticated) {
        run();
        return;
      }

      track("auth_wall_shown", { action });

      // Логин пересоздаёт навигатор, и без этого гость после регистрации
      // оказывался на MainScreen вместо птицы, ради которой регистрировался.
      // Ставится здесь, а не в момент входа: путь может пройти через экран
      // Login, к тому времени исходного экрана в стеке уже не будет.
      //
      // `pendingAction` — само прерванное действие. Возвращается оно
      // параметром экрана, а не отдельным маршрутом поверх: `run` — замыкание
      // гостевого экрана, пережить пересоздание навигатора оно не может, а
      // «снимок» его аргументов был бы снят до логина. Экран доиграет
      // действие сам, уже с профилем на руках.
      //
      // Промис не ждём: намерение сразу лежит в модульной переменной, а запись
      // на диск нужна только для пути, который уводит из приложения (почта), —
      // он не может закончиться раньше, чем эта запись.
      setAuthReturn({
        name: route.name,
        params: { ...route.params, pendingAction: action },
      });

      // Без `title`: общая шапка шторки — отдельный BottomSheetView, а при
      // динамической высоте второй измеряемый узел ломает размер (см.
      // TaxonomyScreen и шапку AuthGateSheet). Заголовок рисует сам контент.
      BottomSheet.showContent({
        renderContent: (dismiss: () => void) => (
          <AuthGateSheet
            dismiss={dismiss}
            onEmailPress={() => {
              dismiss();
              navigation.navigate("Login");
            }}
            onOpenDocument={(screen) => {
              dismiss();
              navigation.navigate(screen);
            }}
          />
        ),
      });
    },
    [isAuthenticated, navigation, route.name, route.params],
  );
};
