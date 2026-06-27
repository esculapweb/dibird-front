import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Slider from "@react-native-community/slider";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { ThemeColors, useTheme } from "../../store/theme-context";
import { IconType } from "../../types";

type Step = {
  label: string;
  value: number;
  icon: IconType;
};

const STEPS: Step[] = [
  { label: "5 km", value: 5, icon: "walk-outline" },
  { label: "50 km", value: 50, icon: "bicycle-outline" },
  { label: "250 km", value: 250, icon: "car-outline" },
  { label: "500 km", value: 500, icon: "airplane-outline" },
];

const RadiusRow = ({
  value,
  onChange,
  onSave,
  hint,
  maxValue=500,
}: {
  value: number;
  onChange: (v: number) => void;
  onSave: (v: number) => Promise<boolean>;
  hint?: string;
  maxValue?:number;
}) => {
  const { Colors } = useTheme();
  const s = stylesRadiusFn(Colors);
  const { t } = useTranslation();

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.label}>{t("alert_radius_label")}:</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>
            {value} {t("km")}{" "}
          </Text>
        </View>
      </View>
      {hint && <Text style={s.rowDesc}>{hint}</Text>}

      <Slider
        style={{ width: "100%", height: 24 }}
        minimumValue={1}
        maximumValue={maxValue}
        step={1}
        value={value}
        onValueChange={onChange}
        onSlidingComplete={onSave}
        minimumTrackTintColor={Colors.main100}
        maximumTrackTintColor={Colors.border}
        thumbTintColor={Colors.main100}
      />

      <View style={s.presets}>
        {STEPS.map((step) => (
          <TouchableOpacity
            key={step.value}
            style={[s.chip, value === step.value && s.chipActive]}
            onPress={() => {
              onChange(step.value);
              onSave(step.value);
            }}
          >
            <Ionicons
              name={step.icon}
              size={20}
              color={
                value === step.value
                  ? Colors.textOpposite
                  : Colors.textSecondary
              }
            />
            <Text
              style={[s.chipText, value === step.value && s.chipTextActive]}
            >
              {step.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default RadiusRow;

const stylesRadiusFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 16,
      gap: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    label: {
      fontSize: 15,
      color: Colors.textMain,
    },
    badge: {
      backgroundColor: Colors.main300, // ~10% opacity of accent
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.main100,
    },
    rowDesc: {
      fontSize: 12,
      marginTop: 2,
      lineHeight: 16,
      color: Colors.textSecondary,
    },
    presets: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      flexWrap: "wrap",
      marginTop: 4,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.primary100,
      alignItems: "center",
    },
    chipActive: {
      backgroundColor: Colors.main100,
      borderColor: Colors.main100,
    },
    chipText: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    chipTextActive: {
      color: Colors.textOpposite,
    },
  });
