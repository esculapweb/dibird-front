import { StyleSheet, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { UseQueryResult } from "@tanstack/react-query";

import { useTheme, ThemeColors } from "../../store/theme-context";
import DropdownInput from "../ui/DropdownInput";
import { EditorFormData } from "../../hooks/useEditorForm";
import { PlaceDropdownItem, AppError } from "../../types";

interface PlaceBlockProps {
  territoryValue: number | "";
  placeValue: string | number | null;
  setPlaceValue: (value: string | number | null) => void;
  setFormData: (updater: (prev: EditorFormData) => EditorFormData) => void;
  onAddNewPlace: (callback: (newPlace: string | number) => void) => void;
  queryPlaces: UseQueryResult<PlaceDropdownItem[], AppError>;
  isLocating: boolean;
  sort: string;
  onSortChange: (value: string | number | boolean | null) => void;
  placeData?: PlaceDropdownItem;
  setPlaceData: (value: PlaceDropdownItem | undefined) => void;
  locationAvailable?: boolean;
  onLocationUnavailable?: () => void;
}

const PlaceBlock = ({
  territoryValue,
  placeValue,
  setPlaceValue,
  setFormData,
  onAddNewPlace,
  queryPlaces,
  isLocating,
  sort,
  onSortChange,
  placeData,
  setPlaceData,
  locationAvailable,
  onLocationUnavailable,
}: PlaceBlockProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View>
      <DropdownInput
        placeholder={t("select_location")}
        value={placeValue}
        setValue={(val) => {
          setPlaceValue(val);
          setFormData((prev) => ({ ...prev, place: typeof val === "string" ? null : val }));
          const found = queryPlaces.data?.find((item) => item.value === val);
          setPlaceData(found);
        }}
        query={queryPlaces}
        allowReset
        disabled={!territoryValue}
        disabledMessage={t("select_country_first")}
        isLocating={isLocating}
        type="PlacesDropdown"
        sort={sort}
        onSortChange={onSortChange}
        placeData={placeData}
        locationAvailable={locationAvailable}
        onLocationUnavailable={onLocationUnavailable}
      />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("or")}</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.addBtn,
          pressed && styles.addBtnPressed,
        ]}
        onPress={() => onAddNewPlace((newPlace) => setPlaceValue(newPlace))}
      >
        <View style={styles.addBtnIcon}>
          <Ionicons name="add" size={18} color={Colors.textMain} />
        </View>
        <Text style={styles.addBtnText}>{t("add_new_location")}</Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={Colors.textSecondary}
        />
      </Pressable>

      <View style={styles.optionalHint}>
        <Ionicons
          name="information-circle-outline"
          size={14}
          color={Colors.textSecondary}
        />
        <Text style={styles.optionalHintText}>
          {t("location_optional_hint")}
        </Text>
      </View>
    </View>
  );
};

export default PlaceBlock;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    mapWrap: {
      marginTop: 10,
      borderRadius: 10,
      overflow: "hidden",
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 12,
      gap: 8,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
    },
    dividerText: {
      fontSize: 12,
      color: Colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.border,
      borderStyle: "dashed",
    },
    addBtnPressed: {
      backgroundColor: Colors.primary200,
    },
    addBtnIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: Colors.primary200,
      justifyContent: "center",
      alignItems: "center",
    },
    addBtnText: {
      flex: 1,
      fontSize: 14,
      color: Colors.textMain,
      fontWeight: "500",
    },
    optionalHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 10,
    },
    optionalHintText: {
      fontSize: 12,
      color: Colors.textSecondary,
      flex: 1,
      lineHeight: 16,
    },
  });
