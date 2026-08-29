import { useCallback, useEffect, useRef } from "react";
import * as Updates from "expo-updates";
import * as Application from "expo-application";
import { useQueryClient } from "@tanstack/react-query";

import { reportAppUpdate } from "../util/fetches";
import {
  loadReportedRelease,
  saveReportedRelease,
  ReportedReleaseSlot,
} from "../util/storageHelper";
import {
  isConnected,
  subscribeToReconnect,
} from "../services/sync/networkStatus";
import { AppUpdateKind, AppUpdateStage } from "../types";
import { UNREAD_COUNT_KEY } from "./useUnreadCount";

const ASK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Tells the backend which release this device is on, which is what lights up
 * the bell badge with "update ready" and "what's new".
 *
 * Why the device reports instead of the server broadcasting by version: with
 * `runtimeVersion.policy: "appVersion"` every phone on a version is offered the
 * same OTA, but each one downloads it at its own next launch — minutes or weeks
 * after publication. A broadcast would tell people to restart into an update
 * they have not got yet. `expo-updates` knows the real state here, so the
 * decision is made here and the server only supplies the text (see
 * myapi/services/app_release.py in the backend repo).
 *
 * A release nobody wrote notes for answers 204 and produces nothing — silence
 * is the default, so bugfix releases still ship unannounced.
 */
export const useAppUpdateNotifications = (isAuthenticated: boolean) => {
  const queryClient = useQueryClient();
  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();
  const inFlight = useRef(false);

  const announce = useCallback(
    async (
      slot: ReportedReleaseSlot,
      kind: AppUpdateKind,
      stage: AppUpdateStage,
      revision: string,
    ): Promise<boolean> => {
      const seen = await loadReportedRelease(slot);
      const sameRelease = seen?.revision === revision;

      if (sameRelease && seen.done) return false;
      // The backend keeps answering "nothing to say" — a bugfix release nobody
      // wrote notes for, which is most of them. Asking once per launch forever
      // would be a request that can never come to anything, so the window is
      // closed after a week; notes written later than that are not news.
      if (sameRelease && Date.now() - seen.firstAskedAt > ASK_WINDOW_MS) {
        return false;
      }

      let created: boolean;
      try {
        created = await reportAppUpdate({ kind, stage, revision });
      } catch {
        // Nothing is written down, so the next launch (or the next reconnect)
        // tries again — offline is the common case here, and the backend is
        // idempotent about repeats. Nothing is surfaced either: there is no
        // action for the person to take, and a toast about a failed
        // announcement would be noise on top of an update that works anyway.
        return false;
      }

      await saveReportedRelease(slot, {
        revision,
        done: created,
        firstAskedAt: sameRelease ? seen.firstAskedAt : Date.now(),
      });

      return created;
    },
    [],
  );

  const run = useCallback(async () => {
    if (!isConnected() || inFlight.current) return;
    inFlight.current = true;

    try {
      let announced = false;

      // An update that is already running: the JS in front of us did not come
      // from the build. `updateId` is null on an embedded launch, so this reads
      // as "are we running downloaded code".
      if (!Updates.isEmbeddedLaunch && Updates.updateId) {
        announced =
          (await announce("ota_applied", "ota", "applied", Updates.updateId)) ||
          announced;
      }

      const build = Application.nativeBuildVersion;
      if (build) {
        const seen = await loadReportedRelease("build");
        if (seen === null) {
          // Nothing to compare against: a fresh install, or the very launch
          // that brought this code in. Neither is an upgrade worth announcing,
          // so record the build and stay quiet — the same way a missing
          // onboarding_pending key means "do not show" (util/storageHelper.ts).
          await saveReportedRelease("build", {
            revision: build,
            done: true,
            firstAskedAt: Date.now(),
          });
        } else if (seen.revision !== build) {
          announced =
            (await announce("build", "build", "applied", build)) || announced;
        }
      }

      // Downloaded and waiting for a restart. Gated on `isUpdatePending`
      // rather than on "an update exists": until the fetch finishes, restarting
      // changes nothing, and the notification would be a lie.
      if (isUpdatePending && downloadedUpdate?.updateId) {
        announced =
          (await announce(
            "ota_pending",
            "ota",
            "pending",
            downloadedUpdate.updateId,
          )) || announced;
      }

      // The badge polls on a minute-long interval (hooks/useUnreadCount.ts);
      // without this the bell stays blank for up to that long after we have
      // just created the notification ourselves.
      if (announced) {
        queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      }
    } finally {
      inFlight.current = false;
    }
  }, [announce, isUpdatePending, downloadedUpdate, queryClient]);

  useEffect(() => {
    // Notifications live on a profile, so there is nobody to notify until
    // someone is signed in. Someone who updates while signed out gets told
    // after the next sign-in — the flags outlive it (see storageHelper).
    if (!isAuthenticated) return;

    run();

    return subscribeToReconnect(run);
  }, [isAuthenticated, run]);
};
