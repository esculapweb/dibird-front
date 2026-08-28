import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import type { CatalogNavigationProp, SpeciesEntryPoint } from "../types";

/**
 * Open the species page from anywhere in the app.
 *
 * Replaces the old `speciesDetails()` helper, which dispatched through
 * `services/navigationRef` — the machinery written for a push tap arriving
 * mid-launch, complete with its 2-second "wait for a navigator" retry loop.
 * None of that applies to a tap inside a mounted screen: the navigator is
 * there, and going through the ref cost the call site its typing (no way to
 * pass `initialTab` or `source`) and made the result depend on which route
 * happened to be focused. `navigationRef` still serves what it was written
 * for — pushes (`util/notificationRoute.ts`) and the post-login replay
 * (`services/authReturn.ts`).
 *
 * Typed with `CatalogNavigationProp` rather than `AppStackNavigationProp`:
 * `SpeciesDetail` is a catalogue screen and is registered in the guest stack
 * too, so the hook is usable from either one.
 */
export const useOpenSpecies = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<CatalogNavigationProp>();

  return useCallback(
    (segment: string | null | undefined, source: SpeciesEntryPoint) => {
      // The segment is localized and comes from the same response as the name
      // shown on the row, so it can legitimately be missing: an observation
      // created offline carries only the ids, and a copy cached under another
      // language resolves to a segment the backend no longer serves. The old
      // helper returned silently here, which read as a dead tap under a link
      // that was drawn anyway. Callers now hide the affordance when there is
      // no segment (see ObservationDetailScreen); this is the backstop for
      // the ones that cannot know in advance.
      if (!segment) {
        Toast.show({
          type: "info",
          text1: t("species_details_unavailable"),
          text2: t("species_details_unavailable_hint"),
        });
        return;
      }

      // Coming back to the species page we were sent here from — the editor
      // opened from a species page, whose "about this bird" button then leads
      // to the very same bird. Pushing would stack a second copy of a screen
      // the user can already reach with one "back".
      const state = navigation.getState();
      const previous = state?.routes[state.routes.length - 2];
      if (
        previous?.name === "SpeciesDetail" &&
        (previous.params as { segment?: string } | undefined)?.segment ===
          segment
      ) {
        navigation.goBack();
        return;
      }

      navigation.navigate("SpeciesDetail", { segment, source });
    },
    [navigation, t],
  );
};
