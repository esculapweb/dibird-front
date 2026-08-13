import { useEffect, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Text,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import IconButton from "./IconButton";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

export interface PhotoViewerItem {
  uri: string;
  credit?: string | null;
}

interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  active: boolean;
  zoomed: boolean;
  onZoomChange: (zoomed: boolean) => void;
}

const ZoomableImage = ({
  uri,
  width,
  height,
  active,
  zoomed,
  onZoomChange,
}: ZoomableImageProps) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    runOnJS(onZoomChange)(false);
  };

  // Drop the zoom of a photo the user paged away from. This has to read the
  // shared value rather than the `zoomed` prop: both props are derived from
  // the same `index === currentIndex`, so `zoomed` is always false whenever
  // `active` is — the condition could never hold and the reset never ran,
  // leaving a photo still magnified when the user paged back to it.
  useEffect(() => {
    if (!active && savedScale.value > 1) reset();
  }, [active]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, MAX_SCALE));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value === 1) {
        reset();
      } else {
        runOnJS(onZoomChange)(true);
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(zoomed)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
        runOnJS(onZoomChange)(true);
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(doubleTapGesture, panGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        testID="photo-viewer-image"
        style={[{ width, height }, styles.imageWrap, animatedStyle]}
      >
        <Image
          source={{ uri }}
          style={{ width, height }}
          contentFit="contain"
          cachePolicy="disk"
        />
      </Animated.View>
    </GestureDetector>
  );
};

interface PhotoViewerModalProps {
  visible: boolean;
  photos: PhotoViewerItem[];
  initialIndex: number;
  onClose: () => void;
}

const PhotoViewerModal = ({
  visible,
  photos,
  initialIndex,
  onClose,
}: PhotoViewerModalProps) => {
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setZoomed(false);
    }
  }, [visible, initialIndex]);

  const handleClose = () => {
    setZoomed(false);
    onClose();
  };

  const handleMomentumScrollEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  if (photos.length === 0) return null;

  const credit = photos[currentIndex]?.credit;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <IconButton
          onPress={handleClose}
          icon="close"
          size={30}
          tintColor="#fff"
          style={styles.closeButton}
          testID="photo-viewer-close"
        />

        <FlatList
          testID="photo-viewer-list"
          data={photos}
          keyExtractor={(item, i) => `${item.uri}-${i}`}
          renderItem={({ item, index }) => (
            <ZoomableImage
              uri={item.uri}
              width={width}
              height={height}
              active={index === currentIndex}
              zoomed={index === currentIndex && zoomed}
              onZoomChange={setZoomed}
            />
          )}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        />

        {photos.length > 1 && (
          <View style={styles.pageIndicator} pointerEvents="none">
            <Text style={styles.pageIndicatorText}>
              {currentIndex + 1} / {photos.length}
            </Text>
          </View>
        )}

        {!!credit && (
          <View style={styles.creditWrap} pointerEvents="none">
            <Text style={styles.creditText} numberOfLines={1}>
              {credit}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default PhotoViewerModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
  },
  closeButton: {
    position: "absolute",
    top: 56,
    right: 16,
    zIndex: 10,
  },
  imageWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  pageIndicator: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pageIndicatorText: {
    color: "#fff",
    fontSize: 12,
  },
  creditWrap: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
  },
  creditText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
  },
});
