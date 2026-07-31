import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Layout from "../components/ui/Layout";
import AnimatedLoadingButton from "../components/ui/AnimatedLoadingButton";
import OnboardingValueStep from "../components/Onboarding/OnboardingValueStep";
import OnboardingCountryStep from "../components/Onboarding/OnboardingCountryStep";
import OnboardingLocationStep from "../components/Onboarding/OnboardingLocationStep";
import OnboardingSpeciesStep from "../components/Onboarding/OnboardingSpeciesStep";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useProfile } from "../store/profile-context";
import { useOnboarding } from "../store/onboarding-context";
import { useCreateObservation } from "../hooks/Observation/useOfflineObservation";
import { track, OnboardingStep } from "../services/analytics";
import { logError } from "../services/errors";
import { toDateOnly } from "../util/helpers";
import { setSession } from "../util/sessionStore";
import { ObservationFormData, SpeciesDropdownItem } from "../types";

const STEPS: OnboardingStep[] = [1, 2, 3, 4, 5];

/**
 * Onboarding of a new account: two value pages, the home country, location and
 * the first observation. Shown once per installation — the decision is made by
 * `store/onboarding-context.tsx`, the screen is declared in `AppStack`
 * conditionally and disappears from the navigator as soon as the flow is over.
 *
 * Without it a new account lands straight on `MainScreen`, where every widget
 * hides itself when there are zero records, and without a country in the profile
 * `ChecklistHero`/`NewSpecies`/the editor's species dropdown are empty as well.
 */
const OnboardingScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors);

  const { profile, updateProfile } = useProfile();
  const { complete, skip } = useOnboarding();
  const createObservation = useCreateObservation();

  const [step, setStep] = useState<OnboardingStep>(1);
  const [territory, setTerritory] = useState<number | null>(null);
  const [created, setCreated] = useState<SpeciesDropdownItem | null>(null);
  const [savingCountry, setSavingCountry] = useState(false);
  // The species lists on step 4 failed to load. Its only purpose is to bring the
  // "Done" button back, otherwise the step can only be left via "Skip".
  const [speciesLoadFailed, setSpeciesLoadFailed] = useState(false);

  // The backend may have set the country itself (by IP at signup) — then the step
  // is confirmed with a single tap. The initial value only: the user's own choice
  // must not be overwritten, hence no `profile` in the dependencies.
  useEffect(() => {
    if (territory === null && profile?.territory) {
      setTerritory(profile.territory);
    }
  }, [profile?.territory]);

  useEffect(() => {
    track("onboarding_step", { step });
  }, [step]);

  const handleSkip = () => {
    skip(step);
  };

  const goNext = () => {
    const next = STEPS[STEPS.indexOf(step) + 1];
    if (next) setStep(next);
  };

  const handleCountryNext = async () => {
    if (!territory || savingCountry) return;
    setSavingCountry(true);
    try {
      // A local patch plus the sync queue: the step can be passed offline too,
      // the country will arrive later. The error must not be swallowed, but
      // locking the flow because of it is no good either — further along the
      // steps the territory is taken from the local state.
      await updateProfile({ territory });
      track("onboarding_country_set");
    } catch (e) {
      logError(e, "OnboardingScreen:updateProfile");
    } finally {
      setSavingCountry(false);
      goNext();
    }
  };

  const handlePickSpecies = (species: SpeciesDropdownItem) => {
    if (!territory || createObservation.isPending) return;

    const payload: ObservationFormData = {
      species: Number(species.value),
      territory,
      place: null,
      date_time: toDateOnly(new Date()),
      time: null,
      private: false,
      quantity: null,
      notes: "",
      location_private: true,
    };

    createObservation.mutate(
      { payload, speciesData: species },
      {
        onSuccess: () => {
          // As in the editor: the next record will open prefilled.
          setSession("lastDate", payload.date_time);
          setSession("lastTerritory", territory);
          setCreated(species);
        },
        // The toast is shown by useMutationWithTranslation; the flow stays on the
        // step so that another bird can be picked.
      },
    );
  };

  const isLast = step === 5;
  const nextDisabled = (step === 3 && !territory) || savingCountry;

  const renderStep = () => {
    if (step === 1)
      return (
        <OnboardingValueStep
          icon="list-outline"
          title={t("onboarding_lifelist_title")}
          text={t("onboarding_lifelist_text")}
          testID="onboarding-step-1"
        />
      );

    if (step === 2)
      return (
        <OnboardingValueStep
          icon="notifications-outline"
          title={t("onboarding_alerts_title")}
          text={t("onboarding_alerts_text")}
          testID="onboarding-step-2"
        />
      );

    if (step === 3)
      return (
        <OnboardingCountryStep value={territory} onChange={setTerritory} />
      );

    if (step === 4)
      return <OnboardingLocationStep testID="onboarding-step-4" />;

    if (created)
      return (
        <View style={styles.success} testID="onboarding-success">
          <View style={styles.successIcon}>
            <Ionicons
              name="checkmark-circle"
              size={64}
              color={Colors.main100}
            />
          </View>
          <Text style={styles.successTitle}>
            {t("onboarding_success_title")}
          </Text>
          <Text style={styles.successText}>
            {t("onboarding_success_text", { species: created.label })}
          </Text>
        </View>
      );

    return (
      <OnboardingSpeciesStep
        territory={territory}
        onPick={handlePickSpecies}
        isCreating={createObservation.isPending}
        onLoadError={setSpeciesLoadFailed}
      />
    );
  };

  return (
    <Layout>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {/* "Skip" is on every step: onboarding is not paid access but a hint,
            and locking people inside it is not allowed. Except for the success
            screen: the observation there is already created, and an
            `onboarding_skipped` from it would report a drop-off on exactly those
            who made it to the end. The way out of there is "Done". */}
        {!created && (
          <TouchableOpacity
            onPress={handleSkip}
            hitSlop={12}
            testID="onboarding-skip"
          >
            <Text style={styles.skip}>{t("skip")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderStep()}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.dots}>
          {STEPS.map((s) => (
            <View
              key={s}
              style={[styles.dot, s === step && styles.dotActive]}
            />
          ))}
        </View>

        {/* On the last step the button only appears once a record has been
            created: before that the single meaningful action is to pick a bird,
            and a second button next to it would read as "this can be skipped".
            The exception is failed species lists: there is nothing to pick there,
            and without the button the step becomes a dead end. */}
        {(!isLast || created || speciesLoadFailed) && (
          <AnimatedLoadingButton
            onPress={isLast ? complete : step === 3 ? handleCountryNext : goNext}
            loading={savingCountry}
            disabled={nextDisabled}
            testID="onboarding-next"
          >
            {isLast ? t("done") : t("next")}
          </AnimatedLoadingButton>
        )}
      </View>
    </Layout>
  );
};

export default OnboardingScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: 20,
    },
    skip: {
      fontSize: 15,
      color: Colors.textSecondary,
    },
    footer: {
      paddingHorizontal: 28,
      paddingTop: 12,
      gap: 16,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: Colors.border,
    },
    dotActive: {
      backgroundColor: Colors.main100,
      width: 20,
    },
    success: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    successIcon: { marginBottom: 20 },
    successTitle: {
      fontSize: 22,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
      marginBottom: 10,
    },
    successText: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      color: Colors.textSecondary,
    },
  });
