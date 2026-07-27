import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import DropdownInput from "../ui/DropdownInput";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { useLanguage } from "../../store/language-context";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { fetchMyCountries, fetchMyDashboardStat } from "../../util/fetches";
import { StaleTime } from "../../constants/staleTime";
import { DashboardStat } from "../../types";

/**
 * Выбор домашней страны. Ключевая часть — не сам дропдаун, а цифра под ним:
 * «0 из 812» превращает пустой аккаунт в понятную цель, а без страны в профиле
 * половина дашборда (`ChecklistHero`, `NewSpecies`, `BirdOfTheDay`) и
 * species-dropdown в редакторе остаются пустыми.
 */
const OnboardingCountryStep = ({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (territory: number | null) => void;
}) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { language } = useLanguage();

  // Тот же вызов, что в MainScreen и ObservationForm — форма ключа обязана
  // совпадать, чтобы список стран брался из общего кэша, а не грузился заново.
  const { query: countriesQuery, sort, onSortChange } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (order) => fetchMyCountries(false, order),
    params: [language],
  });

  const { data: stat } = useQuery<DashboardStat>({
    // Без даты: «сколько видов в стране всего» — это не срез по периоду.
    queryKey: ["DashboardStat", value, null, null, null, null],
    queryFn: () => fetchMyDashboardStat({ territory: value }),
    enabled: !!value,
    staleTime: StaleTime.TEN_MINUTES,
  });

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="globe-outline" size={40} color={Colors.main100} />
      </View>

      <Text style={styles.title}>{t("onboarding_country_title")}</Text>
      <Text style={styles.text}>{t("onboarding_country_text")}</Text>

      <View style={styles.field}>
        <DropdownInput<number | null>
          placeholder={t("select_country")}
          value={value}
          setValue={onChange}
          query={countriesQuery}
          type="CountriesDropdown"
          sort={sort}
          onSortChange={onSortChange}
        />
      </View>

      {/* Появляется только когда цифры действительно есть: «0 из 0» на месте
          обещанной персонализации хуже, чем её отсутствие. */}
      {!!value && !!stat?.total && (
        <View style={styles.result} testID="onboarding-country-result">
          <Text style={styles.resultNum}>
            {stat.seen}
            <Text style={styles.resultOf}>
              {" "}
              {t("of")} {stat.total}
            </Text>
          </Text>
          <Text style={styles.resultText}>
            {t("onboarding_country_result")}
          </Text>
        </View>
      )}
    </View>
  );
};

export default OnboardingCountryStep;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.main300,
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
      marginBottom: 12,
    },
    text: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      color: Colors.textSecondary,
      marginBottom: 28,
    },
    field: { alignSelf: "stretch" },
    result: {
      alignItems: "center",
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: Colors.main300,
    },
    resultNum: {
      fontSize: 28,
      fontWeight: "700",
      color: Colors.main100,
    },
    resultOf: {
      fontSize: 16,
      fontWeight: "500",
      color: Colors.textSecondary,
    },
    resultText: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 4,
    },
  });
