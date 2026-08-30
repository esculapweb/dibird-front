import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Config } from "../../constants/config";
import { useTheme, ThemeColors } from "../../store/theme-context";
import PhotoViewerModal from "../ui/PhotoViewerModal";
import { ObservationPhoto } from "../../types";

// Editing tiles stay small: that row also carries the add tile and a remove
// button on every photo, and the form has little vertical room to spare. The
// read-only strip uses the 150 pt square of the species gallery in
// SpeciesDetailScreen — which is also the largest size the 400x400 server
// thumbnail fills without upscaling.
const TILE_SIZE = 88;
const VIEW_TILE_SIZE = 150;
const TILE_GAP = 8;

// What the caption asks for when it sits beside the photos. Anything narrower
// is not worth a column, and the row wraps the caption under the strip
// instead — see `row` in the stylesheet.
const CAPTION_BASIS = 140;
const CAPTION_GAP = 12;

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

  // The detail screens show the strip without any editing affordance, and only
  // there does the caption belong: the form already sits under a "Photos"
  // section header of its own.
  const readOnly = !onAdd;

  // Exact width of the strip, used as the flex basis of the scroller so the
  // row can decide by itself where the caption goes. Both terms are known:
  // an observation holds at most MAX_OBSERVATION_PHOTOS photos.
  const stripWidth =
    photos.length * VIEW_TILE_SIZE + Math.max(photos.length - 1, 0) * TILE_GAP;

  const strip = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      style={readOnly ? { flexBasis: stripWidth, flexShrink: 1 } : undefined}
    >
      {photos.map((photo, index) => {
        const uri = tileUri(photo);

        return (
          <Pressable
            key={photo.id}
            testID={`observation-photo-tile-${index}`}
            style={[styles.tile, readOnly && styles.viewTile]}
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
  );

  return (
    <>
      {readOnly ? (
        <View style={styles.row}>
          {strip}
          <View testID="observation-photos-caption" style={styles.caption}>
            <Text style={styles.captionTitle}>
              {t("observation_photos_title")}
            </Text>
            <Text style={styles.captionNote}>{t("observation_photos_note")}</Text>
          </View>
        </View>
      ) : (
        strip
      )}

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
    // Wrapping is what places the caption: it stays on the photos' line while
    // the line still fits `CAPTION_BASIS`, and drops under them when it does
    // not — one photo leaves room for it even on a phone, two already do not,
    // and a tablet has room to spare for all five. Doing this in flexbox
    // rather than by measuring the row keeps it correct on the first frame,
    // with no reflow after a layout pass.
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      columnGap: CAPTION_GAP,
      rowGap: 8,
    },
    caption: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: CAPTION_BASIS,
    },
    captionTitle: {
      fontSize: 11,
      color: Colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    captionNote: {
      fontSize: 12,
      color: Colors.textSecondary,
      lineHeight: 16,
    },
    strip: {
      gap: TILE_GAP,
      paddingVertical: 4,
    },
    tile: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      borderRadius: 10,
      overflow: "hidden",
    },
    viewTile: {
      width: VIEW_TILE_SIZE,
      height: VIEW_TILE_SIZE,
      borderRadius: 14,
      backgroundColor: Colors.imageBg,
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
