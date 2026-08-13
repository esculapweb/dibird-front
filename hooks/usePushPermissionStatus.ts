import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

import { reportWarning } from "../services/errors";
import { requestPushPermission } from "./usePushNotifications";

export type PushPermissionStatus = "granted" | "denied" | "undetermined";

/**
 * The OS-level push permission, re-read every time the app returns to the
 * foreground.
 *
 * The re-read is the whole point. The permission changes outside the app just as
 * often as inside it: in the system settings, or by a reinstall — which resets it
 * while the session itself survives in the Keychain, so nothing in the app even
 * looks like it has changed. Read once at mount, the app went on claiming the
 * alerts were on over an OS that had been blocking them since the previous
 * launch.
 *
 * `null` means "no answer to act on": the status has not been read yet, or this
 * is a simulator, where push cannot work at all and a prompt about it would lead
 * nowhere.
 */
export const usePushPermissionStatus = (): {
  status: PushPermissionStatus | null;
  refresh: () => Promise<void>;
  request: () => Promise<void>;
} => {
  const [status, setStatus] = useState<PushPermissionStatus | null>(null);

  const refresh = useCallback(async () => {
    if (!Device.isDevice) return;

    try {
      const { status: current } =
        (await Notifications.getPermissionsAsync()) as {
          status: PushPermissionStatus;
        };
      setStatus(current);
    } catch (e) {
      // Silent to the user — there is nothing to tell them — but a permission
      // that cannot even be read is push quietly not working.
      reportWarning(e, "getPermissionsAsync");
    }
  }, []);

  /**
   * Ask for the permission — or, when the OS has already recorded a refusal and
   * will not show its dialog a second time, hand the user over to the system
   * settings, the only way back from there.
   *
   * Lives here rather than in the two screens that offer it (the alerts card,
   * the alert settings) so that "which of the two is it now" is decided once.
   */
  const request = useCallback(async () => {
    if (status === "denied") {
      if (Platform.OS === "ios") await Linking.openURL("app-settings:");
      else await Linking.openSettings();
      return;
    }

    await requestPushPermission();
    // The status is re-read on every foreground anyway, but the dialog is
    // answered without ever leaving the app.
    await refresh();
  }, [status, refresh]);

  useEffect(() => {
    refresh();

    let prevState = AppState.currentState;
    const sub = AppState.addEventListener("change", (state) => {
      const wasBackground =
        prevState === "background" || prevState === "inactive";
      prevState = state;

      if (state === "active" && wasBackground) refresh();
    });

    return () => sub.remove();
  }, [refresh]);

  return { status, refresh, request };
};
