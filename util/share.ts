import { Platform, Share } from "react-native";
import Toast from "react-native-toast-message";
import type { TFunction } from "i18next";

import { track } from "../services/analytics";
import { buildShareUrl } from "./helpers";
import { Filters } from "../types";

// Shared by the detail screens and the swipe actions of the list rows, so a
// link shared from either place is the same link. `t` comes from the caller's
// useTranslation, like every other string the screens show.

// iOS shares a url (the sheet previews it); Android has no url field and
// takes the link as the message instead.
const shareUrl = (url: string) =>
  Share.share(Platform.OS === "ios" ? { url } : { message: url });

// A private record has no public page — the link would open a 404 for
// whoever receives it, so the user is told why nothing is shared instead.
export const shareObservation = async (
  item: { id: number; private?: boolean },
  t: TFunction,
) => {
  if (item.private) {
    Toast.show({
      type: "info",
      text1: t("observation_private"),
      text2: t("observation_private_share_hint"),
    });
    return;
  }

  track("share_tapped", { type: "observation" });
  await shareUrl(buildShareUrl(`my/community/${item.id}/`));
};

export const shareDiary = async (
  item: { id: number; private?: boolean },
  t: TFunction,
  filters: Filters | null = null,
  sort: string | null = null,
) => {
  if (item.private) {
    Toast.show({
      type: "info",
      text1: t("diary_private"),
      text2: t("diary_private_share_hint"),
    });
    return;
  }

  track("share_tapped", { type: "diary" });
  await shareUrl(buildShareUrl(`my/diary/${item.id}/`, filters, sort));
};
