import { ReactNode, Ref, useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme, ThemeColors } from "../../store/theme-context";
import MapL, { MapProps } from "./MapL";

// Snap point indexes, for callers that move the sheet themselves.
export const SHEET_PEEK_INDEX = 0;
export const SHEET_REST_INDEX = 1;

// Folded all the way down, the sheet keeps the handle and the first line of
// its content (the place's name) — the rest of the screen is map, the way a
// navigator folds its route card. Above the home indicator.
const SHEET_PEEK_HEIGHT = 60;

// gorhom's default handle: the part of the sheet above the scroll content.
const SHEET_HANDLE_HEIGHT = 24;

// The resting height: the map keeps the top 60%, the sheet shows the main
// part of its content without a drag. The top point is for the rest of it.
const SHEET_REST_SHARE = 0.4;
const SHEET_TOP_SHARE = 0.92;

interface MapSheetLayoutProps {
  // The covered height is this layout's business: it moves with the sheet.
  mapProps: Omit<MapProps, "mapHeight" | "bottomInset" | "centerBottomPadding">;
  children: ReactNode;
  sheetRef?: Ref<BottomSheet>;
  testID?: string;
  /**
   * Raise the sheet no higher than its content needs (still within the top
   * point). For read-only content of a known, modest size; a form keeps the
   * full height for the keyboard and its fields that open up.
   */
  fitContent?: boolean;
}

// The place screens' layout: the map runs under the whole screen, the content
// is a sheet over its lower part. The camera and the map's bottom controls are
// lifted by the height the sheet covers, so the pin and the buttons stay in
// the part left visible.
const MapSheetLayout = ({
  mapProps,
  children,
  sheetRef,
  testID,
  fitContent = false,
}: MapSheetLayoutProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const insets = useSafeAreaInsets();

  // Height of the screen under the header, for the sheet's share of it.
  const [containerHeight, setContainerHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [isPeeking, setIsPeeking] = useState(false);

  const peekHeight = SHEET_PEEK_HEIGHT + insets.bottom;
  const fullRestHeight = containerHeight * SHEET_REST_SHARE;
  const fullTopHeight = containerHeight * SHEET_TOP_SHARE;
  // Until both are measured the content's height means nothing yet.
  const fittedHeight =
    fitContent && containerHeight > 0 && contentHeight > 0
      ? contentHeight + SHEET_HANDLE_HEIGHT
      : null;
  // Content shorter than the resting share rests at its own height, and then
  // there is nothing left to raise the sheet for.
  const restHeight =
    fittedHeight != null ? Math.min(fullRestHeight, fittedHeight) : fullRestHeight;
  const topHeight =
    fittedHeight != null ? Math.min(fullTopHeight, fittedHeight) : fullTopHeight;
  const hasTop = topHeight > restHeight + 1;

  const snapPoints = useMemo(() => {
    // Before the screen is measured: the same points, as shares.
    if (containerHeight === 0) {
      return [peekHeight, `${SHEET_REST_SHARE * 100}%`, `${SHEET_TOP_SHARE * 100}%`];
    }
    return hasTop
      ? [peekHeight, restHeight, topHeight]
      : [peekHeight, restHeight];
  }, [containerHeight, peekHeight, restHeight, topHeight, hasTop]);

  // Capped at the resting height: a fully raised sheet is for reading or
  // typing, and centring the pin in the sliver left above it would only throw
  // the camera around.
  const coveredHeight = isPeeking ? peekHeight : restHeight;

  // onAnimate rather than onChange: the camera and the buttons start moving
  // with the sheet instead of jumping once it has settled.
  const handleAnimate = useCallback((_fromIndex: number, toIndex: number) => {
    setIsPeeking(toIndex === SHEET_PEEK_INDEX);
  }, []);

  return (
    <View
      style={styles.screen}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <MapL
        {...mapProps}
        bottomInset={coveredHeight}
        centerBottomPadding={coveredHeight}
      />
      <BottomSheet
        ref={sheetRef}
        index={SHEET_REST_INDEX}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        onAnimate={handleAnimate}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          onContentSizeChange={
            fitContent ? (_w, h) => setContentHeight(h) : undefined
          }
          testID={testID}
        >
          {children}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
};

export default MapSheetLayout;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Colors.primary100 },
    sheetBackground: {
      backgroundColor: Colors.primary100,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    sheetHandle: {
      backgroundColor: Colors.textSecondary,
      width: 40,
      height: 4,
    },
  });
