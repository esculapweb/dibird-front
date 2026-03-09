import { useState, useEffect } from "react";
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

import { useTheme } from "../../store/theme-context";
import { fetchMapPreview } from "../../util/fetches";
import { Config } from "../../constants/config";

const ImagePart = ({
  query,
  previewLoading,
  previewUri,
  value,
  placeData,
  Colors,
  styles,
}) => {
  if (query.isLoading || previewLoading)
    return (
      <View style={[styles.image, styles.imageEmpty]}>
        <ActivityIndicator size="small" color={Colors.dropdownIcon} />
      </View>
    );

  if (query.isError)
    return (
      <View style={[styles.image, styles.imageEmpty]}>
        <Ionicons name="refresh" size={32} color={Colors.link} />
      </View>
    );

  if (previewUri && value)
    return (
      <View>
        <Image
          source={{ uri: previewUri }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="disk"
        />
      </View>
    );

  if (placeData && value) {
    return (
      <View style={[styles.image, styles.imageEmpty]}>
        <Ionicons
          name="location-outline"
          size={32}
          color={Colors.textSecondary}
        />
      </View>
    );
  }

  return (
    <View style={[styles.image, styles.imageEmpty]}>
      <Ionicons name="search-outline" size={32} color={Colors.textSecondary} />
    </View>
  );
};

const TextPart = ({
  query,
  placeData,
  value,
  name,
  disabled,
  Colors,
  styles,
  t,
}) => {
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

  if (placeData && value)
    return (
      <>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.changeHint}>{t("tap_to_change")}</Text>
      </>
    );

  return (
    <>
      <Text style={[styles.name, styles.promptTitle]}>{t("select_place")}</Text>
      {!disabled && (
        <Text style={styles.promptSub}>{t("species_tap_hint")}</Text>
      )}
    </>
  );
};

const PlaceDropdown = ({
  placeData,
  value,
  onPress,
  disabled,
  error,
  query,
}) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const name = placeData?.label;

  const [previewUri, setPreviewUri] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setPreviewUri(null);

    if (!placeData || !value) return;

    if (placeData?.preview) {
      setPreviewLoading(false);
      setPreviewUri(`${Config.mediaUrl}/${placeData.preview}`);
    } else if (placeData?.value) {
      setPreviewLoading(true);
      fetchMapPreview(placeData?.value)
        .then((data) => {
          setPreviewUri(`${Config.mediaUrl}/${data.preview}`);
        })
        .catch((e) => console.warn("map preview error:", e))
        .finally(() => setPreviewLoading(false));
    } else {
    setPreviewLoading(false);
  }
  }, [placeData?.value, placeData?.preview, value]);

  

  const handlePress = () => {
    if (query.isError && query.refetch) {
      query.refetch();
      return;
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        error && styles.cardError,
        disabled && styles.cardDisabled,
        pressed && styles.cardPressed,
      ]}
    >
      <ImagePart
        query={query}
        previewLoading={previewLoading}
        previewUri={previewUri}
        value={value}
        placeData={placeData}
        Colors={Colors}
        styles={styles}
      />

      <View style={styles.info}>
        <TextPart
          query={query}
          placeData={placeData}
          value={value}
          name={name}
          disabled={disabled}
          Colors={Colors}
          styles={styles}
          t={t}
        />
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

export default PlaceDropdown;

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
      width: 100,
      height: 100,
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
