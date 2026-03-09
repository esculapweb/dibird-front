import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";
import { isoToFlagEmoji } from "../../util/helpers";

const PlacePreviewRow = ({
  placeData,
  territoryData,
  onPress,
  isLoading,
  previewUri,
  style,
}) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const disabled = !placeData?.id;

  const ImagePart = () => {
    if (isLoading)
      return (
        <View style={[styles.image, styles.imageEmpty]}>
          <ActivityIndicator size="small" color={Colors.dropdownIcon} />
        </View>
      );

    if (previewUri)
      return (
        <View>
          <Image
            source={{ uri: previewUri }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="disk"
          />
          <View style={styles.mapOverlay}>
            <Ionicons name="expand-outline" size={16} color="#fff" />
          </View>
        </View>
      );

    return (
      <View style={[styles.image, styles.imageEmpty]}>
        <Ionicons
          name="location-outline"
          size={32}
          color={Colors.textSecondary}
        />
      </View>
    );
  };

  const TextPart = () => {
    if (isLoading)
      return (
        <Text style={styles.name} numberOfLines={1}>
          {t("loading_")}
        </Text>
      );

    return (
      <>
        <Text style={styles.name} numberOfLines={3}>
          {placeData?.name || t("location_not_specified")}
        </Text>
        <Text style={styles.placeTerritory} numberOfLines={2}>
          {isoToFlagEmoji(territoryData.code)} {territoryData.name}
        </Text>
      </>
    );
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        style,
      ]}
    >
      <ImagePart />

      <View style={styles.info}>
        <TextPart />
      </View>

      {placeData?.id && !isLoading && (
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

export default PlacePreviewRow;

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
    cardPressed: {
      backgroundColor: Colors.primary200,
    },
    image: {
      width: 100,
      height: 100,
      backgroundColor: Colors.imageBg,
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
    placeTerritory: {
      fontSize: 12,
      fontStyle: "italic",
      color: Colors.textSecondary,
      marginTop: 3,
    },
    mapOverlay: {
      position: "absolute",
      bottom: 5,
      right: 5,
      backgroundColor: "rgba(0,0,0,0.25)",
      borderRadius: 5,
      padding: 3,
    },
  });
