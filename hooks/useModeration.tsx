import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import { useMutationWithTranslation } from "./useMutationWithTranslation";
import { blockUser, reportContent, unblockUser } from "../util/fetches";
import { clearListCache } from "./repositories/listCacheRepository";
import {
  communityItemCacheTable,
  communityObservationsCacheTable,
} from "../services/db/schema";
import { BottomSheet } from "../services/bottomSheet";
import ReportCommentSheet from "../components/Moderation/ReportCommentSheet";
import { ReportTargetKind, track } from "../services/analytics";
import { ReportReason, ReportTarget } from "../types";

// Built at runtime from the reason the user picked, so the keys are listed for
// i18next-parser at the bottom of this file.
const REASON_LABEL_KEY: Record<ReportReason, string> = {
  sexual: "report_reason_sexual",
  violence: "report_reason_violence",
  hate: "report_reason_hate",
  spam: "report_reason_spam",
  irrelevant: "report_reason_irrelevant",
  other: "report_reason_something_else",
};

// What is offered for each kind of target — a subset of the server's reasons
// (ContentReport.Reason accepts all of them for any target). Nothing outside
// requires a taxonomy at all: Apple and Google ask for a way to report, not
// for categories. The reason is here because it decides the order the reports
// are dealt with — pornography is minutes, "not a bird" is next week — and
// because Art. 16 of the DSA expects a notice to carry one. Hence a short
// list per target rather than one list of everything: hate speech is not a
// complaint about a photograph of a bird, and "not a bird observation" is not
// a complaint about a person.
const REASONS_BY_TARGET: Record<ReportTargetKind, ReportReason[]> = {
  // Ordered by how often it is the actual complaint, not by how bad it is: a
  // photo that simply is not a bird is the everyday case, pornography is the
  // rare one. The heaviest reason sitting on top of the list is what invites a
  // misdirected tap.
  observation: ["irrelevant", "violence", "sexual", "other"],
  photo: ["irrelevant", "violence", "sexual", "other"],
  profile: ["hate", "spam", "other"],
};

const targetKind = (target: ReportTarget): ReportTargetKind =>
  "photo" in target ? "photo" : "observation" in target ? "observation" : "profile";

interface ReportOptions {
  // Called once the complaint is stored — the screen showing the reported
  // record usually has to leave, because the server no longer serves it.
  onDone?: () => void;
}

/**
 * Reporting content and blocking a user.
 *
 * Both change what the server puts in the community feed, and both therefore
 * end the same way: the feed's react-query entries are invalidated *and* its
 * offline cache tables are dropped. Invalidation alone would not be enough —
 * offline, a cached page comes back from SQLite (see cachedRead in
 * services/cacheFallback.ts), and the reported photo would still be there.
 */
export const useModeration = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const forgetCommunity = useCallback(() => {
    clearListCache(communityObservationsCacheTable);
    clearListCache(communityItemCacheTable);
    // "Community" is the prefix of both keys — the feed list (useList keys by
    // the screen name) and the card (useItem keys by the item type).
    queryClient.invalidateQueries({ queryKey: ["Community"] });
  }, [queryClient]);

  const reportMutation = useMutationWithTranslation({
    mutationFn: ({
      target,
      reason,
      comment,
    }: {
      target: ReportTarget;
      reason: ReportReason;
      comment?: string;
      onDone?: () => void;
    }) => reportContent(target, reason, comment),
    onSuccess: (_data, { onDone }) => {
      forgetCommunity();
      Toast.show({
        type: "success",
        text1: t("report_sent_title"),
        text2: t("report_sent_message"),
      });
      onDone?.();
    },
  });

  const blockMutation = useMutationWithTranslation({
    mutationFn: ({ profileId }: { profileId: number; onDone?: () => void }) =>
      blockUser(profileId),
    onSuccess: (_data, { onDone }) => {
      forgetCommunity();
      queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
      Toast.show({ type: "success", text1: t("user_blocked_title") });
      onDone?.();
    },
  });

  const unblockMutation = useMutationWithTranslation({
    mutationFn: (profileId: number) => unblockUser(profileId),
    onSuccess: () => {
      forgetCommunity();
      queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
    },
  });

  const report = useCallback(
    (target: ReportTarget, options?: ReportOptions) => {
      const kind = targetKind(target);
      track("report_opened", { target: kind });

      const send = (reason: ReportReason, comment?: string) =>
        reportMutation.mutate({
          target,
          reason,
          comment,
          onDone: options?.onDone,
        });

      BottomSheet.showMenu({
        title: t("report_title"),
        items: REASONS_BY_TARGET[kind].map((reason) => ({
          label: t(REASON_LABEL_KEY[reason]),
          onPress: () => {
            // "Something else" asks what exactly, and the sheet it opens
            // replaces this one (present swaps the payload); everything else
            // is already said by the label, so the sheet just closes — a menu
            // row does not dismiss itself.
            if (reason === "other") {
              BottomSheet.showContent({
                renderContent: (dismiss: () => void) => (
                  <ReportCommentSheet
                    dismiss={dismiss}
                    onSubmit={(comment) => {
                      dismiss();
                      send(reason, comment);
                    }}
                  />
                ),
              });
              return;
            }

            BottomSheet.hide();
            send(reason);
          },
        })),
      });
    },
    [t, reportMutation],
  );

  const block = useCallback(
    (profileId: number, options?: ReportOptions) => {
      BottomSheet.show({
        title: t("block_user_title"),
        description: t("block_user_message"),
        confirmText: t("block_user_confirm"),
        cancelText: t("cancel"),
        danger: true,
        onConfirm: () =>
          blockMutation.mutate({ profileId, onDone: options?.onDone }),
      });
    },
    [t, blockMutation],
  );

  const unblock = useCallback(
    (profileId: number) => unblockMutation.mutate(profileId),
    [unblockMutation],
  );

  return {
    report,
    block,
    unblock,
    isPending:
      reportMutation.isPending ||
      blockMutation.isPending ||
      unblockMutation.isPending,
  };
};

// t("report_reason_sexual")
// t("report_reason_violence")
// t("report_reason_hate")
// t("report_reason_spam")
// t("report_reason_irrelevant")
// t("report_reason_something_else")
