import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useTranslation } from "react-i18next";

import ObservationPhotos from "./ObservationPhotos";
import { useMediaLibraryUnavailable } from "../../hooks/useMediaLibraryUnavailable";
import { useApiError } from "../../hooks/useApiError";
import { BottomSheet } from "../../services/bottomSheet";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { MAX_OBSERVATION_PHOTOS } from "../../constants/config";
import { ObservationPhoto } from "../../types";

// Long side of a stored photo. An observation photo is looked at, not printed,
// and every one of them has to survive in documentDirectory until the network
// comes back — a full-resolution phone shot is several megabytes of that.
const MAX_DIMENSION = 1600;

interface ObservationPhotoPickerProps {
  photos: ObservationPhoto[];
  onPicked: (uris: string[]) => void;
  onRemove: (photo: ObservationPhoto) => void;
}

const ObservationPhotoPicker = ({
  photos,
  onPicked,
  onRemove,
}: ObservationPhotoPickerProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [busy, setBusy] = useState(false);
  const { showErrorToast } = useApiError();
  const handleMediaLibraryUnavailable = useMediaLibraryUnavailable();

  const remaining = MAX_OBSERVATION_PHOTOS - photos.length;

  const pickPhotos = async () => {
    if (busy || remaining <= 0) return;
    setBusy(true);

    try {
      const { status: existingStatus } =
        await ImagePicker.getMediaLibraryPermissionsAsync();

      if (existingStatus === "denied") {
        handleMediaLibraryUnavailable();
        return;
      }

      if (existingStatus !== "granted") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return;
      }

      // Gallery only, never launchCameraAsync: the expo-image-picker config
      // plugin in app.config.js blocks the camera permission outright, so a
      // camera capture would need a new native build (see app.config.js).
      // `allowsEditing` is deliberately absent — it is mutually exclusive with
      // multiple selection.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });

      // iOS "limited photo access" can grant permission and still hand back
      // nothing, so an empty result is a normal outcome, not a failure.
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const uris: string[] = [];
      for (const asset of result.assets.slice(0, remaining)) {
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: MAX_DIMENSION } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        uris.push(manipulated.uri);
      }

      onPicked(uris);
    } catch (e) {
      showErrorToast(e, "ObservationPhotoPicker");
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = (photo: ObservationPhoto) => {
    BottomSheet.show({
      title: t("remove_photo_title"),
      description: t("remove_photo_message"),
      confirmText: t("remove"),
      cancelText: t("cancel"),
      danger: true,
      onConfirm: () => onRemove(photo),
    });
  };

  return (
    <View>
      <ObservationPhotos
        photos={photos}
        onAdd={pickPhotos}
        onRemove={confirmRemove}
        addDisabled={busy || remaining <= 0}
      />
      <Text style={styles.hint}>
        {remaining <= 0
          ? t("photo_limit_reached", { count: MAX_OBSERVATION_PHOTOS })
          : t("observation_photos_hint")}
      </Text>
    </View>
  );
};

export default ObservationPhotoPicker;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    hint: {
      marginTop: 6,
      fontSize: 11,
      color: Colors.textSecondary,
    },
  });
