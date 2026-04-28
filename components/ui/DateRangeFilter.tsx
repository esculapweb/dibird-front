import { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

import RadioGroup from "./RadioGroup";
import DropdownInput from "./DropdownInput";
import DateInput from "./DateInput";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { DateFilter } from "../../types";

const DateRangeFilter = ({
  value,
  setDateFilter,
}: {
  value: DateFilter;
  setDateFilter: (value: any) => void;
}) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const mode = value?.type ?? "all";
  const year = value?.type === "year" ? value.year : null;

  const from = value?.type === "range" && value.from ? value.from : null;
  const to = value?.type === "range" && value.to ? value.to : null;

  const normalizeRange = (from: string | null, to: string | null) => {
    if (!from && !to) return null;
    if (from && to && from > to) return null;

    return {
      ...(from && { from }),
      ...(to && { to }),
    };
  };

  const rangeInvalid = mode === "range" && from && to && from > to;

  const handleModeChange = (newMode: string | number | boolean | null) => {
    if (newMode === "all") {
      setDateFilter(null);
      return;
    }

    if (newMode === "today") {
      setDateFilter({ type: "today" });
      return;
    }

    if (newMode === "this_year") {
      setDateFilter({ type: "this_year" });
      return;
    }

    if (newMode === "year") {
      setDateFilter({ type: "year", year: null });
      return;
    }

    if (newMode === "range") {
      setDateFilter({ type: "range" });
    }
  };

  const handleYearChange = (newYear: string | number | null) => {
    setDateFilter(newYear ? { type: "year", year: newYear } : null);
  };

  const handleFromChange = (newFrom: string | null) => {
    const normalized = normalizeRange(newFrom, to);
    setDateFilter(normalized ? { type: "range", from: newFrom, to } : null);
  };

  const handleToChange = (newTo: string | null) => {
    const normalized = normalizeRange(from, newTo);
    setDateFilter(normalized ? { type: "range", from, to: newTo } : null);
  };

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 1900;

    return Array.from({ length: currentYear - startYear + 1 }, (_, i) => {
      const y = currentYear - i;
      return { label: String(y), value: y };
    });
  }, []);

  return (
    <View style={styles.wrapper}>
      <RadioGroup
        label={t("period")}
        value={mode}
        onChange={handleModeChange}
        direction="column"
        options={[
          { label: t("all_period"), value: "all" },
          { label: t("this_year"), value: "this_year" },
          { label: t("whole_year"), value: "year" },
          { label: t("today"), value: "today" },
          { label: t("date_range"), value: "range" },
        ]}
      />

      {mode === "year" && (
        <DropdownInput
          title={t("year")}
          placeholder={t("select_year")}
          value={year as number | null}
          setValue={handleYearChange}
          query={{ data: yearOptions }}
          allowReset
        />
      )}

      {mode === "range" && (
        <>
          <DateInput
            label={t("from_date")}
            value={from}
            onChange={handleFromChange}
            placeholder={t("not_selected")}
            error={rangeInvalid}
            style={{ marginBottom: 8 }}
          />

          <DateInput
            label={t("to_date")}
            value={to}
            onChange={handleToChange}
            placeholder={t("not_selected")}
            error={rangeInvalid}
            minimumDate={from || undefined}
          />

          {rangeInvalid && (
            <Text style={styles.error}>{t("date_range_invalid")}</Text>
          )}
        </>
      )}
    </View>
  );
};

export default DateRangeFilter;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      marginTop: 12,
    },
    title: {
      fontSize: 14,
      color: Colors.textMain,
    },
    error: {
      marginTop: 4,
      fontSize: 12,
      color: Colors.error500,
    },
  });
