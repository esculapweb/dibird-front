import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Config } from "../../constants/config";
import { BirdSVG } from "./Svgs";
import { speciesDetails } from "../../util/helpers";

import { QueryType, SpeciesDropdownItem } from "../../types";

interface SpeciesDropdownProps {
  query: QueryType;
  onPress: () => void;
  value: string | number | null;
  speciesData?: SpeciesDropdownItem;
  name?: string;
  disabled?: boolean;
  error?: string;
}

const SpeciesDropdown = ({
  speciesData,
  value,
  onPress,
  disabled,
  error,
  query,
}: SpeciesDropdownProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const name = speciesData?.name_lang || speciesData?.name;

  const handlePress = () => {
    if (query.isError && query.refetch) {
      query.refetch();
      return;
    }
    onPress();
  };

  const ImagePart = () => {
    if (query.isLoading)
      return (
        <View style={[styles.image, styles.imageEmpty]}>
          <ActivityIndicator size="small" color={Colors.dropdownIcon} />
        </View>
      );

    if (query.isError)
      return (
        <View style={[styles.image, styles.imageEmpty]}>
          <Ionicons name="refresh" size={32} color={Colors.main100} />
        </View>
      );

    if (speciesData?.thumb && value)
      return (
        <View style={styles.image}>
          <Image
            source={{ uri: `${Config.mediaUrl}/${speciesData.thumb}` }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="disk"
          />
          <Pressable
            onPress={() => speciesDetails(speciesData.segment as string)}
            style={styles.imageCornerBtn}
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={Colors.markerBorder}
            />
          </Pressable>
        </View>
      );

    if (speciesData && value)
      return (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <BirdSVG size={44} color={Colors.textSecondary} />
          <Pressable
            onPress={() => speciesDetails(speciesData.segment as string)}
            style={styles.imageCornerBtn}
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={Colors.markerBorder}
            />
          </Pressable>
        </View>
      );

    return (
      <View style={[styles.image, styles.imageEmpty]}>
        <Ionicons
          name="search-outline"
          size={32}
          color={Colors.textSecondary}
        />
      </View>
    );
  };

  const TextPart = () => {
    if (query.isLoading)
      return (
        <Text style={styles.name} numberOfLines={1}>
          {t("loading_")}
        </Text>
      );
    if (query.isError)
      return (
        <Text
          style={[styles.name, { color: Colors.error500 }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {t("failed_to_load_data")}
        </Text>
      );

    if (speciesData && value)
      return (
        <>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          {speciesData.name && speciesData.name !== name && (
            <Text style={styles.latin} numberOfLines={1}>
              {speciesData.name}
            </Text>
          )}
          <Text style={styles.changeHint}>{t("tap_to_change")}</Text>
        </>
      );

    return (
      <>
        <Text style={[styles.name, styles.promptTitle]}>
          {disabled ? t("species_single") : t("select_species")}
        </Text>

        <Text style={styles.promptSub}>
          {disabled ? t("select_country_first") : t("species_tap_hint")}
        </Text>
      </>
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        error && styles.cardError,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
      ]}
    >
      <ImagePart />

      <View style={styles.info}>
        <TextPart />
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {!disabled && !query.isLoading && !query.isError && (
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

export default SpeciesDropdown;

const stylesFn = (Colors: ThemeColors) =>
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

    imageCornerBtn: {
      position: "absolute",
      bottom: 2,
      right: 2,
      backgroundColor: Colors.mapOverlay,
      borderRadius: 99,
      padding: 1,
    },
  });
