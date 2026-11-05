import { useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { BottomSheet } from "../services/bottomSheet";
import { useOnboarding } from "../store/onboarding-context";
import {
  clearProfileReviewPending,
  isProfileReviewPending,
} from "../util/storageHelper";
import { AppStackNavigationProp } from "../types";

/**
 * "Check your profile" once, after the first sign-in (#149).
 *
 * A new account arrives with fields the person never typed: the name from
 * Google/Apple, the country by IP, and privacy defaults (public observations
 * and diaries) they never chose. The onboarding does not touch any of that, so
 * right after it the main screen offers a single trip to the profile, where
 * both the data and the privacy switches live (ProfileForm).
 *
 * Waits for the onboarding to be over: a sheet on top of its steps would fight
 * them for the screen. The flag is cleared before the sheet is shown — a
 * dismissed hint must not come back on the next launch.
 */
export const useProfileReviewPrompt = () => {
  const { status } = useOnboarding();
  const navigation = useNavigation<AppStackNavigationProp>();
  const { t } = useTranslation();
  const handledRef = useRef(false);

  useEffect(() => {
    if (status !== "done" || handledRef.current) return;
    handledRef.current = true;

    let active = true;
    (async () => {
      if (!(await isProfileReviewPending()) || !active) return;
      await clearProfileReviewPending();
      BottomSheet.show({
        title: t("profile_review_title"),
        description: t("profile_review_text"),
        confirmText: t("profile_review_open"),
        cancelText: t("profile_review_later"),
        onConfirm: () => navigation.navigate("Profile"),
      });
    })();

    return () => {
      active = false;
    };
  }, [status]);
};
