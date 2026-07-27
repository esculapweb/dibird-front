import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Layout from "../components/ui/Layout";
import AnimatedLoadingButton from "../components/ui/AnimatedLoadingButton";
import OnboardingValueStep from "../components/Onboarding/OnboardingValueStep";
import OnboardingCountryStep from "../components/Onboarding/OnboardingCountryStep";
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

const STEPS: OnboardingStep[] = [1, 2, 3, 4];

/**
 * Онбординг нового аккаунта: две страницы ценности, домашняя страна и первое
 * наблюдение. Показывается один раз за установку — решение принимает
 * `store/onboarding-context.tsx`, экран объявлен в `AppStack` условно и
 * исчезает из навигатора, как только поток закончен.
 *
 * Без него новый аккаунт попадает сразу на `MainScreen`, где каждый виджет при
 * нуле записей прячет сам себя, а без страны в профиле пусты ещё и
 * `ChecklistHero`/`NewSpecies`/species-dropdown редактора.
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
  // Списки видов на шаге 4 не загрузились. Единственное назначение — вернуть
  // кнопку «Готово», иначе выйти из шага можно только «Пропустить».
  const [speciesLoadFailed, setSpeciesLoadFailed] = useState(false);

  // Бэк мог проставить страну сам (по IP при регистрации) — тогда шаг
  // подтверждается одним тапом. Только начальное значение: собственный выбор
  // пользователя переписывать нельзя, поэтому без `profile` в зависимостях.
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
      // Локальный патч + очередь синка: шаг проходится и без сети, страна
      // доедет позже. Ошибку глушить нельзя, но и запирать поток из-за неё
      // тоже — дальше по шагам территория берётся из локального состояния.
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
          // Как в редакторе: следующая запись откроется предзаполненной.
          setSession("lastDate", payload.date_time);
          setSession("lastTerritory", territory);
          setCreated(species);
        },
        // Тост показывает useMutationWithTranslation; поток остаётся на шаге,
        // чтобы можно было выбрать другую птицу.
      },
    );
  };

  const isLast = step === 4;
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
        {/* «Пропустить» есть на каждом шаге: онбординг — не платный доступ, а
            подсказка, и запирать в нём нельзя. Кроме экрана успеха: наблюдение
            там уже создано, и `onboarding_skipped` с него означал бы в отчёте
            отвал ровно на тех, кто дошёл до конца. Выход оттуда — «Готово». */}
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

        {/* На четвёртом шаге кнопка появляется только после созданной записи:
            до неё единственное осмысленное действие — выбрать птицу, и вторая
            кнопка рядом читалась бы как «можно и без этого». Исключение —
            упавшие списки видов: выбирать там не из чего, и без кнопки шаг
            становится тупиком. */}
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
