import { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

import RadioGroup from "./RadioGroup";
import DropdownInput from "./DropdownInput";
import DateInput from "./DateInput";
import { Colors } from "../../constants/styles";

const DateRangeFilter = ({ value, setDateFilter }) => {
  const { t } = useTranslation();

  const [mode, setMode] = useState("all"); // all | year | range
  const [year, setYear] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);

  const normalizeRange = ({ from, to }) => {
    if (!from && !to) return null;
    if (from && to && new Date(from) > new Date(to)) return null;

    return {
      ...(from && { from }),
      ...(to && { to }),
    };
  };

  useEffect(() => {
    if (!value) {
      setMode("all");
      setYear(null);
      setFrom(null);
      setTo(null);
      return;
    }

    if (value.type === "year") {
      setMode("year");
      setYear(value.year);
    }

    if (value.type === "range") {
      setMode("range");
      setFrom(value.from);
      setTo(value.to);
    }
  }, [value]);

  /* =========================
     EMIT FILTER UP
     ========================= */
  useEffect(() => {
    if (mode === "all") {
      setDateFilter(null);
      return;
    }

    if (mode === "year") {
      setDateFilter(year ? { type: "year", year } : null);
      return;
    }

    if (mode === "range") {
      const normalized = normalizeRange({ from, to });

      setDateFilter(normalized ? { type: "range", ...normalized } : null);
    }
  }, [mode, year, from, to]);

  /* =========================
     YEARS OPTIONS
     ========================= */
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 1900;

    return Array.from({ length: currentYear - startYear + 1 }, (_, i) => {
      const y = currentYear - i;
      return { label: String(y), value: y };
    });
  }, []);

  const rangeInvalid =
    mode === "range" && from && to && new Date(from) > new Date(to);

  return (
    <View style={styles.wrapper}>
      <RadioGroup
        label={t("date")}
        value={mode}
        onChange={setMode}
        direction="column"
        options={[
          { label: t("all_period"), value: "all" },
          { label: t("whole_year"), value: "year" },
          { label: t("date_range"), value: "range" },
        ]}
      />

      {mode === "year" && (
        <DropdownInput
          title={t("year")}
          placeholder={t("select_year")}
          value={year}
          setValue={setYear}
          options={yearOptions}
          allowReset
        />
      )}

      {mode === "range" && (
        <>
          <DateInput
            label={t("from_date")}
            value={from}
            onChange={setFrom}
            placeholder={t("not_selected")}
            error={rangeInvalid}
          />

          <DateInput
            label={t("to_date")}
            value={to}
            onChange={setTo}
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

const styles = StyleSheet.create({
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
