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

import { useTheme, ThemeColors } from "../../store/theme-context";
import { fetchMapPreview } from "../../util/fetches";
import { Config } from "../../constants/config";
import { logError } from "../../services/errors";
import {
  AppStackNavigationProp,
  PlaceDropdownItem,
  QueryType,
} from "../../types";

interface ImageTextPartProps {
  query?: QueryType;
  value?: number | null;
  placeData?: PlaceDropdownItem | null;
  previewUri?: string | null;
  previewLoading?: boolean;
  name?: string;
  disabled?: boolean;
}

const ImagePart = ({
  query,
  value,
  placeData,
  previewUri,
  previewLoading,
}: ImageTextPartProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();

  if (query?.isLoading || previewLoading)
    return (
      <View style={[styles.image, styles.imageEmpty]}>
        <ActivityIndicator size="small" color={Colors.dropdownIcon} />
      </View>
    );

  if (query?.isError)
    return (
      <View style={[styles.image, styles.imageEmpty]}>
        <Ionicons name="refresh" size={32} color={Colors.main100} />
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
        <Pressable
          style={styles.mapOverlay}
          hitSlop={8}
          onPress={() => {
            navigation.navigate("PlaceDetail", { placeId: value });
          }}
        >
          <Ionicons
            name="expand-outline"
            size={16}
            color={Colors.markerBorder}
          />
        </Pressable>
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
  previewLoading,
}: ImageTextPartProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  if (query?.isLoading || previewLoading)
    return (
      <Text style={styles.name} numberOfLines={1}>
        {t("loading_")}
      </Text>
    );

  if (query?.isError)
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
      <Text style={[styles.name, styles.promptTitle]}>
        {disabled ? t("place") : t("select_place")}
      </Text>

      <Text style={styles.promptSub}>
        {disabled ? t("select_country_first") : t("place_tap_hint")}
      </Text>
    </>
  );
};

interface PlaceDropdownProps {
  placeData: PlaceDropdownItem | null;
  value: string | number | null;
  onPress: () => void;
  onClear?: () => void;
  disabled: boolean;
  error?: string;
  query: QueryType;
}

const PlaceDropdown = ({
  placeData,
  value,
  onPress,
  onClear,
  disabled,
  error,
  query,
}: PlaceDropdownProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const name = placeData?.label ?? placeData?.name;

  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePress = () => {
    if (query.isError && query.refetch) {
      query.refetch();
      return;
    }
    onPress();
  };

  useEffect(() => {
    setPreviewUri(null);

    if (!placeData || !value) return;

    const loadPreview = async () => {
      if (placeData?.preview) {
        setPreviewUri(`${Config.mediaUrl}/${placeData.preview}`);
        return;
      }

      setPreviewLoading(true);
      try {
        const data = await fetchMapPreview(value);
        setPreviewUri(`${Config.mediaUrl}/${data.preview}`);
      } catch (e) {
        logError(e, `PlaceDropdown:mapPreview:${value}`);
      } finally {
        setPreviewLoading(false);
      }
    };

    loadPreview();
  }, [placeData?.preview, value]);

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
        value={value as number}
        placeData={placeData}
        previewUri={previewUri}
        previewLoading={previewLoading}
      />

      <View style={styles.info}>
        <TextPart
          query={query}
          placeData={placeData}
          value={value as number}
          name={name}
          disabled={disabled}
          previewLoading={previewLoading}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {value && onClear && !query.isLoading && !query.isError && (
        <Pressable onPress={onClear} hitSlop={8} style={{ marginRight: 4 }}>
          <Ionicons
            name="close-circle"
            size={20}
            color={Colors.textSecondary}
          />
        </Pressable>
      )}

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
    mapOverlay: {
      position: "absolute",
      bottom: 5,
      right: 5,
      backgroundColor: Colors.mapOverlay,
      borderRadius: 5,
      padding: 3,
    },
  });
