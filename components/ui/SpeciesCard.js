import { StyleSheet, View, Text, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";
import { Config } from "../../constants/config";

const SpeciesCard = ({ speciesData, value, onPress, disabled, error }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
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
      {speciesData?.thumb && value ? (
        <Image
          source={{ uri: `${Config.baseUrl}/media/${speciesData.thumb}` }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : speciesData && value ? (
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
        {speciesData && value ? (
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

      <Ionicons
        name="chevron-forward"
        size={22}
        color={Colors.textSecondary}
        style={{ marginRight: 14 }}
      />
    </Pressable>
  );
};

export default SpeciesCard;

const stylesFn = (Colors) =>
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
