import { useCallback } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useAuth } from "../store/auth-context";
import { BottomSheet } from "../services/bottomSheet";
import { setAuthReturn } from "../services/authReturn";
import AuthGateSheet from "../components/Auth/AuthGateSheet";
import { track, type GatedAction } from "../services/analytics";
import type { AuthStackNavigationProp } from "../types";

/**
 * Wraps an action that needs an account. For a signed-in user it calls it as is,
 * for a guest it shows the "create an account to save this" sheet.
 *
 * A soft upsell rather than a wall: the guest gets here having already browsed
 * the catalogue, and the sheet explains what exactly they get — unlike a login
 * screen at the very start, where there is nothing to offer yet.
 *
 * Signing in is possible right from the sheet — Apple/Google/email (AuthOptions,
 * the same block as on Welcome). The only action used to be a "Sign Up" button
 * leading to the signup screen: whoever already had an account looked for the
 * sign-in in the switcher at the bottom of someone else's form, and Apple/Google
 * could not be reached from the funnel at all — Welcome sits underneath the whole
 * catalogue stack, and "back" from Signup returns to the bird page rather than to
 * the sign-in buttons.
 *
 * The navigation typing is `AuthStackNavigationProp`: navigation only happens for
 * a guest, and a guest is always in `AuthStack`.
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

      // Login recreates the navigator, and without this a guest ended up on
      // MainScreen after signing up instead of the bird they signed up for. Set
      // here rather than at the moment of the sign-in: the path may go through
      // the Login screen, and by then the original screen is no longer in the
      // stack.
      //
      // `pendingAction` is the interrupted action itself. It comes back as a
      // screen parameter rather than as a separate route on top: `run` is a
      // closure of the guest screen and cannot survive the navigator being
      // recreated, while a "snapshot" of its arguments would have been taken
      // before the login. The screen replays the action itself, now with a
      // profile in hand.
      //
      // The promise is not awaited: the intent is in a module variable right
      // away, and the write to disk is only needed for the path that leaves the
      // app (email) — that one cannot finish sooner than this write.
      setAuthReturn({
        name: route.name,
        params: { ...route.params, pendingAction: action },
      });

      // No `title`: the shared sheet header is a separate BottomSheetView, and
      // with dynamic height a second measured node breaks the size (see
      // TaxonomyScreen and the header of AuthGateSheet). The content draws the
      // heading itself.
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
