import { useRef } from "react";
import { LayoutChangeEvent } from "react-native";
import type { BottomSheetScrollViewMethods } from "@gorhom/bottom-sheet";

// Brings one control of a filter sheet into view — the one whose chip was
// tapped. The scroll is fired from that section's own onLayout rather than
// from an effect: the sheet is still animating open when its content mounts,
// so the offset is not known any earlier. `scrolledRef` keeps it to the first
// layout pass, leaving the user's own scrolling alone afterwards.
export const useFocusScroll = (focusKey?: string | null) => {
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const scrolledRef = useRef(false);

  const onSectionLayout = (key: string) => (event: LayoutChangeEvent) => {
    if (scrolledRef.current || !focusKey || key !== focusKey) return;
    scrolledRef.current = true;
    scrollRef.current?.scrollTo({
      y: Math.max(0, event.nativeEvent.layout.y - 12),
      animated: true,
    });
  };

  return { scrollRef, onSectionLayout };
};
