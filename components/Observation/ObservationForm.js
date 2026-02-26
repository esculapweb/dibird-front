import {
  View,
  StyleSheet,
  Switch,
  Text,
  Pressable,
  ScrollView,
} from "react-native";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../store/theme-context";
import DropdownInput from "../ui/DropdownInput";
import DateInput from "../ui/DateInput";
import TimeInput from "../ui/TimeInput";
import {
  fetchMyCountries,
  fetchMyPlaces,
  fetchSpecies,
} from "../../util/fetches";
import { useTranslatedQuery } from "../../hooks/useQueryWithTranslation";
import { useLanguage } from "../../store/language-context";
import SpeciesOptionRow from "../ui/SpeciesOptionRow";
import Input from "../ui/Input";
import Map from "../Map/Map";
import { Config } from "../../constants/config";
import { Image } from "expo-image";

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section = ({ title, required, children, Colors, hint }) => {
  const styles = sectionStyles(Colors);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {title}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
};

const sectionStyles = (Colors) =>
  StyleSheet.create({
    section: {
      marginBottom: 8,
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      padding: 16,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: Colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    required: {
      color: Colors.error500,
    },
    hint: {
      fontSize: 12,
      color: Colors.textSecondary,
      fontStyle: "italic",
    },
  });

// ─── Species selector card ───────────────────────────────────────────────────
const SpeciesCard = ({ speciesData, onPress, disabled, error, Colors, t }) => {
  const styles = speciesStyles(Colors);
  const name = speciesData?.labelLang || speciesData?.label;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        error && styles.cardError,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
      ]}
    >
      {/* Image */}
      {speciesData?.thumb ? (
        <Image
          source={{ uri: `${Config.baseUrl}/media/${speciesData.thumb}` }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : speciesData ? (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Ionicons
            name="image-outline"
            size={32}
            color={Colors.dropdownIcon}
          />
        </View>
      ) : (
        <View style={[styles.image, styles.imageEmpty]}>
          <Ionicons
            name="search-outline"
            size={32}
            color={Colors.textSecondary}
          />
        </View>
      )}

      {/* Text */}
      <View style={styles.info}>
        {speciesData ? (
          <>
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            {speciesData.labelLatin && speciesData.labelLatin !== name && (
              <Text style={styles.latin} numberOfLines={1}>
                {speciesData.labelLatin}
              </Text>
            )}
            <Text style={styles.changeHint}>{t("tap_to_change")}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.name, styles.promptTitle]}>
              {disabled ? t("select_country_first") : t("select_species")}
            </Text>
            {!disabled && (
              <Text style={styles.promptSub}>{t("species_tap_hint")}</Text>
            )}
          </>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Right icon */}
      {!speciesData && (
        <Ionicons
          name="chevron-forward"
          size={22}
          color={Colors.textSecondary}
          style={{ marginRight: 14 }}
        />
      )}
    </Pressable>
  );
};

const speciesStyles = (Colors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: Colors.primary100,
    },
    cardError: {
      borderColor: Colors.error500,
    },
    cardDisabled: {
      opacity: 0.5,
    },
    cardPressed: {
      backgroundColor: Colors.primary200,
    },
    image: {
      width: 88,
      height: 88,
      backgroundColor: Colors.imageBg,
    },
    imagePlaceholder: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary200,
    },
    imageEmpty: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary300,
    },
    info: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
      justifyContent: "center",
    },
    name: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
      lineHeight: 20,
    },
    latin: {
      fontSize: 12,
      fontStyle: "italic",
      color: Colors.textSecondary,
      marginTop: 3,
    },
    changeHint: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginTop: 4,
    },
    promptTitle: {
      color: Colors.textSecondary,
      fontWeight: "500",
    },
    promptSub: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 3,
      lineHeight: 16,
    },
    errorText: {
      fontSize: 12,
      color: Colors.error500,
      marginTop: 4,
    },
  });

// ─── Place selector block ─────────────────────────────────────────────────────
const PlaceBlock = ({
  territoryValue,
  placeValue,
  setPlaceValue,
  setFormData,
  onAddNewPlace,
  queryPlaces,
  Colors,
  t,
}) => {
  const styles = placeStyles(Colors);
  const selectedPlace = queryPlaces?.data?.find((p) => p.value === placeValue);
  const coords = selectedPlace?.location?.coordinates;

  return (
    <View>
      <DropdownInput
        placeholder={t("select_location")}
        value={placeValue}
        setValue={(val) => {
          setPlaceValue(val);
          setFormData((prev) => ({ ...prev, place: val }));
        }}
        query={queryPlaces}
        allowReset
        disabled={!territoryValue}
        disabledMessage={t("select_country_first")}
      />

      {/* Map preview for selected place */}
      {coords?.length === 2 && (
        <View style={styles.mapWrap}>
          <Map currentCoords={coords} mapHeight={160} showCoords={false} />
        </View>
      )}

      {/* Divider with "or" */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("or")}</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Add new place button */}
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

      {/* Hint — place is optional */}
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

const placeStyles = (Colors) =>
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

// ─── Privacy toggle ───────────────────────────────────────────────────────────
const PrivacyToggle = ({ value, onChange, Colors, t }) => {
  const styles = privacyStyles(Colors);
  return (
    <Pressable style={styles.row} onPress={() => onChange(!value)}>
      <View style={styles.left}>
        <View style={[styles.iconWrap, value && styles.iconWrapActive]}>
          <Ionicons
            name={value ? "lock-closed" : "globe-outline"}
            size={18}
            color={value ? Colors.buttonPrimaryText : Colors.textSecondary}
          />
        </View>
        <View>
          <Text style={styles.label}>{value ? t("private") : t("public")}</Text>
          <Text style={styles.desc}>
            {value ? t("visible_only_to_you") : t("visible_to_everyone")}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.accent }}
        thumbColor={Colors.primary100}
      />
    </Pressable>
  );
};

const privacyStyles = (Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: Colors.primary200,
      justifyContent: "center",
      alignItems: "center",
    },
    iconWrapActive: {
      backgroundColor: Colors.accent,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
    },
    desc: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 1,
    },
  });

// ─── Main form ────────────────────────────────────────────────────────────────
const ObservationForm = ({
  formData,
  setFormData,
  errors,
  setErrors,
  territoryValue,
  setTerritoryValue,
  speciesValue,
  setSpeciesValue,
  placeValue,
  setPlaceValue,
  onAddNewPlace,
  // Pass full species data object for preview (name, thumb, etc.)
  speciesData,
  setSpeciesData,
}) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { language } = useLanguage();

  const queryTerritories = useTranslatedQuery({
    queryFn: () => fetchMyCountries(false),
    params: [language],
    type: "Mycountries",
  });

  const queryPlaces = useTranslatedQuery({
    queryFn: () => fetchMyPlaces(territoryValue),
    params: [territoryValue],
    type: "Places",
    enabled: !!territoryValue,
  });

  const querySpecies = useTranslatedQuery({
    queryFn: () => fetchSpecies(territoryValue),
    params: [territoryValue],
    type: "Species",
    enabled: !!territoryValue,
  });

  const styles = formStyles(Colors);
  const speciesDropdownRef = useRef(null);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. Required: Who ─────────────────────────────────── */}
      <Section title={t("section_who")} required Colors={Colors}>
        <DropdownInput
          placeholder={t("select_country")}
          value={territoryValue}
          setValue={(val) => {
            setTerritoryValue(val);
            setFormData((prev) => ({ ...prev, territory: val }));
            setErrors((prev) => ({ ...prev, territory: undefined }));
            setPlaceValue(null);
            setSpeciesValue(null);
          }}
          query={queryTerritories}
          error={errors.territory}
          label={t("country")}
        />

        {/* Hidden DropdownInput — opened programmatically via ref */}
        <DropdownInput
          ref={speciesDropdownRef}
          label=""
          placeholder={t("select_species")}
          value={speciesValue}
          setValue={(val) => {
            setSpeciesValue(val);
            setFormData((prev) => ({ ...prev, species: val }));
            setErrors((prev) => ({ ...prev, species: undefined }));
            const found = querySpecies.data?.find((item) => item.value === val);
            setSpeciesData(found ?? null);
          }}
          query={querySpecies}
          disabled={!territoryValue}
          error={null}
          hidden
          renderOption={({ item, selected, onSelect, onClose }) => (
            <SpeciesOptionRow
              item={item}
              selected={selected}
              onSelect={onSelect}
              onClose={onClose}
            />
          )}
        />

        <SpeciesCard
          speciesData={speciesData}
          disabled={!territoryValue}
          error={errors.species}
          Colors={Colors}
          t={t}
          onPress={() => speciesDropdownRef.current?.open()}
        />
      </Section>

      {/* ── 2. Required: When ────────────────────────────────── */}
      <Section title={t("section_when")} required Colors={Colors}>
        <DateInput
          label={t("observation_date")}
          value={formData.date_time}
          onChange={(newDate) => {
            setFormData((prev) => ({ ...prev, date_time: newDate }));
            setErrors((prev) => ({ ...prev, date_time: undefined }));
          }}
          placeholder={t("not_selected")}
          error={errors.date_time}
          allowClear={false}
        />

        <TimeInput
          label={`${t("observation_time")} (${t("optional")})`}
          value={formData.time}
          onChange={(newTime) =>
            setFormData((prev) => ({ ...prev, time: newTime }))
          }
        />
      </Section>

      {/* ── 3. Optional: Where ───────────────────────────────── */}
      <Section title={t("section_where")} Colors={Colors} hint={t("optional")}>
        <PlaceBlock
          territoryValue={territoryValue}
          placeValue={placeValue}
          setPlaceValue={setPlaceValue}
          setFormData={setFormData}
          onAddNewPlace={onAddNewPlace}
          queryPlaces={queryPlaces}
          Colors={Colors}
          t={t}
        />
      </Section>

      {/* ── 4. Optional: Details ─────────────────────────────── */}
      <Section
        title={t("section_details")}
        Colors={Colors}
        hint={t("optional")}
      >
        <Input
          label={t("quantity")}
          value={
            formData?.quantity != null ? formData.quantity.toString() : null
          }
          keyboardType="numeric"
          onUpdateValue={(val) =>
            setFormData((prev) => ({
              ...prev,
              quantity: val?.trim() === "" ? null : val.trim(),
            }))
          }
          error={errors.quantity}
          isInvalid={errors.quantity}
        />

        <Input
          label={t("notes")}
          value={formData.notes}
          onUpdateValue={(val) =>
            setFormData((prev) => ({ ...prev, notes: val }))
          }
          error={errors.notes}
          isInvalid={errors.notes}
          multiline
        />
      </Section>

      {/* ── 5. Required: Privacy ─────────────────────────────── */}
      <Section title={t("section_privacy")} required Colors={Colors}>
        <PrivacyToggle
          value={formData.private}
          onChange={(val) => setFormData((prev) => ({ ...prev, private: val }))}
          Colors={Colors}
          t={t}
        />
      </Section>
    </ScrollView>
  );
};

export default ObservationForm;

const formStyles = (Colors) =>
  StyleSheet.create({
    container: {
      padding: 12,
      gap: 8,
    },
  });
