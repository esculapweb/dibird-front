import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Config } from "../../constants/config";
import { useTheme, ThemeColors } from "../../store/theme-context";
import PhotoViewerModal from "../ui/PhotoViewerModal";
import { ObservationPhoto } from "../../types";

const TILE_SIZE = 88;

// A local file:// URI is used as is; a server path is relative, and the media
// host prefix is the client's job — the same split ProfileAvatar makes for the
// pending avatar.
const tileUri = (photo: ObservationPhoto) =>
  photo.local_uri ??
  (photo.thumbnail ? `${Config.mediaUrl}/${photo.thumbnail}` : null);

const fullUri = (photo: ObservationPhoto) =>
  photo.local_uri ?? (photo.image ? `${Config.mediaUrl}/${photo.image}` : null);

interface ObservationPhotosProps {
  photos: ObservationPhoto[];
  // Editing affordances: the read-only strip on the detail screen passes
  // neither, the picker in the form passes both.
  onAdd?: () => void;
  onRemove?: (photo: ObservationPhoto) => void;
  addDisabled?: boolean;
}

const ObservationPhotos = ({
  photos,
  onAdd,
  onRemove,
  addDisabled = false,
}: ObservationPhotosProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const viewable = photos.filter((photo) => fullUri(photo));

  if (photos.length === 0 && !onAdd) return null;

  // A lone thumbnail in a row of one reads as an appendix to whatever sits
  // above it rather than as a photo of this observation, so a single photo
  // gets the full width instead. In the editor the row always holds the add
  // tile as well, so it stays a strip there.
  const single = !onAdd && photos.length === 1;

  return (
    <>
      <ScrollView
        horizontal={!single}
        scrollEnabled={!single}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={single ? styles.single : styles.strip}
      >
        {photos.map((photo, index) => {
          const uri = tileUri(photo);

          return (
            <Pressable
              key={photo.id}
              testID={`observation-photo-tile-${index}`}
              style={single ? styles.wideTile : styles.tile}
              onPress={() => {
                const position = viewable.indexOf(photo);
                if (position >= 0) setViewerIndex(position);
              }}
            >
              {uri ? (
                <Image source={{ uri }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={[styles.image, styles.placeholder]}>
                  <Ionicons
                    name="image-outline"
                    size={22}
                    color={Colors.textSecondary}
                  />
                </View>
              )}

              {photo._pendingSync === "pending" && (
                <View style={styles.badge}>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={12}
                    color={Colors.textMain}
                  />
                </View>
              )}

              {photo._pendingSync === "error" && (
                <View style={[styles.badge, { backgroundColor: Colors.error100 }]}>
                  <Ionicons name="warning-outline" size={12} color={Colors.error600} />
                </View>
              )}

              {onRemove && (
                <Pressable
                  testID={`observation-photo-remove-${index}`}
                  style={styles.remove}
                  onPress={() => onRemove(photo)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={14} color={Colors.textMain} />
                </Pressable>
              )}
            </Pressable>
          );
        })}

        {onAdd && (
          <Pressable
            testID="observation-photo-add"
            style={[styles.tile, styles.addTile, addDisabled && styles.addDisabled]}
            onPress={onAdd}
            disabled={addDisabled}
          >
            <Ionicons name="add" size={26} color={Colors.main100} />
            <Text style={styles.addLabel}>{t("add_photo")}</Text>
          </Pressable>
        )}
      </ScrollView>

      <PhotoViewerModal
        visible={viewerIndex !== null}
        photos={viewable.map((photo) => ({ uri: fullUri(photo) ?? "" }))}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
};

export default ObservationPhotos;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    strip: {
      gap: 8,
      paddingVertical: 4,
    },
    single: {
      width: "100%",
      paddingVertical: 4,
    },
    tile: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      borderRadius: 10,
      overflow: "hidden",
    },
    wideTile: {
      width: "100%",
      aspectRatio: 4 / 3,
      borderRadius: 12,
      overflow: "hidden",
    },
    image: {
      width: "100%",
      height: "100%",
    },
    placeholder: {
      backgroundColor: Colors.primary300,
      justifyContent: "center",
      alignItems: "center",
    },
    badge: {
      position: "absolute",
      left: 4,
      bottom: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Colors.primary100,
      justifyContent: "center",
      alignItems: "center",
    },
    remove: {
      position: "absolute",
      right: 4,
      top: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Colors.overlay,
      justifyContent: "center",
      alignItems: "center",
    },
    addTile: {
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: Colors.border,
      backgroundColor: Colors.primary300,
      justifyContent: "center",
      alignItems: "center",
      gap: 2,
    },
    addDisabled: {
      opacity: 0.4,
    },
    addLabel: {
      fontSize: 10,
      color: Colors.textSecondary,
      textAlign: "center",
      paddingHorizontal: 4,
    },
  });
