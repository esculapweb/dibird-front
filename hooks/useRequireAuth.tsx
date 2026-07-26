import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { useAuth } from "../store/auth-context";
import { BottomSheet } from "../services/bottomSheet";
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
 * Типизация навигации — `AuthStackNavigationProp`: ветка с переходом
 * выполняется только когда гость, а гость всегда в `AuthStack`. У
 * залогиненного до `navigate` дело не доходит.
 */
export const useRequireAuth = () => {
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<AuthStackNavigationProp>();
  const { t } = useTranslation();

  return useCallback(
    (action: GatedAction, run: () => void) => {
      if (isAuthenticated) {
        run();
        return;
      }

      track("auth_wall_shown", { action });

      BottomSheet.show({
        title: t("auth_required_title"),
        description: t("auth_required_message"),
        confirmText: t("signup"),
        cancelText: t("cancel"),
        onConfirm: () => navigation.navigate("Signup"),
      });
    },
    [isAuthenticated, navigation, t],
  );
};
