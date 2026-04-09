import { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";

import { useTheme } from "../../store/theme-context";
import { isoToFlagEmoji } from "../../util/helpers";
import { fetchMapPreview } from "../../util/fetches";
import { Config } from "../../constants/config";

const ImagePart = ({ previewUri, previewLoading }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  if (previewLoading)
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
          <Ionicons name="expand-outline" size={16} color={Colors.markerBorder} />
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

const TextPart = ({ placeData, territoryData, previewLoading }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  if (previewLoading)
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

const PlacePreviewRow = ({ placeData, territoryData, style }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation();
  const [previewUri, setPreviewUri] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePlaceNavigate = () => {
    if (!placeData) return;
    navigation.navigate("PlaceDetail", {
      placeId: placeData.id,
    });
  };

  useEffect(() => {
    setPreviewUri(null);
    if (!placeData) return;

    const loadPreview = async () => {
      if (placeData?.preview) {
        setPreviewUri(`${Config.mediaUrl}/${placeData.preview}`);
        return;
      }

      setPreviewLoading(true);
      try {
        const data = await fetchMapPreview(placeData.id);
        setPreviewUri(`${Config.mediaUrl}/${data.preview}`);
      } catch (e) {
        console.warn("map preview error:", e);
      } finally {
        setPreviewLoading(false);
      }
    };

    loadPreview();
  }, [placeData]);

  return (
    <Pressable
      onPress={handlePlaceNavigate}
      disabled={!placeData?.id}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        style,
      ]}
    >
      <ImagePart previewUri={previewUri} previewLoading={previewLoading} />

      <View style={styles.info}>
        <TextPart
          placeData={placeData}
          territoryData={territoryData}
          previewLoading={previewLoading}
        />
      </View>

      {placeData?.id && !previewLoading && (
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
      backgroundColor: Colors.mapOverlay,
      borderRadius: 5,
      padding: 3,
    },
  });
