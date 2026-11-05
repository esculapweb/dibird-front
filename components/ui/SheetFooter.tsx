import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { View } from "react-native";

// A footer pinned to the bottom of a content sheet, for sheets whose action
// button must stay reachable while the content above it scrolls (#478).
//
// Why not a plain <View> after the scroll view: with `enableDynamicSizing`
// gorhom sizes the sheet from the measured BottomSheetView/ScrollView only, a
// plain view is never measured, and the sheet opened short by exactly the
// footer's height. FilterSheetContent used to make up for it with a hard-coded
// paddingBottom: 96. Through gorhom's own `footerComponent` the footer floats
// over the sheet, and the content reserves room for it with the footer's
// *measured* height, handed back by useSheetFooter.
//
// The sheet (UniversalBottomSheet) cannot render the footer's markup itself:
// the button needs the content's own state (FilterSheetContent's draft
// filters). So the content registers the node, the sheet places it.

interface SheetFooterApi {
  setFooter: (node: ReactNode | null) => void;
  footerHeight: number;
}

const SheetFooterContext = createContext<SheetFooterApi | null>(null);

export const SheetFooterProvider = SheetFooterContext.Provider;

/**
 * Registers `node` as the pinned footer of the sheet this content is in.
 *
 * `node` is taken once, on mount: keep it stable and let it read the latest
 * state through refs. Re-registering on every render would set state in the
 * sheet on every render of the content — a render loop.
 *
 * Returns `inline: true` when there is no sheet around (tests, a screen that
 * renders the content directly): the caller then renders `node` in place.
 */
export const useSheetFooter = (node: ReactNode) => {
  const api = useContext(SheetFooterContext);

  useEffect(() => {
    if (!api) return;
    api.setFooter(node);
    return () => api.setFooter(null);
  }, []);

  return { inline: !api, footerHeight: api?.footerHeight ?? 0 };
};

/**
 * State the sheet keeps for its footer: the registered node, its measured
 * height, and the wrapper that reports that height.
 */
export const useSheetFooterHost = () => {
  const [footer, setFooter] = useState<ReactNode | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);

  const renderMeasured = () => (
    <View
      testID="sheet-footer"
      onLayout={(e) => {
        const h = Math.ceil(e.nativeEvent.layout.height);
        setFooterHeight((prev) => (prev === h ? prev : h));
      }}
    >
      {footer}
    </View>
  );

  // Clearing the node clears its height too: otherwise the next content to
  // register would reserve the previous footer's room until its own layout.
  const setFooterNode = (node: ReactNode | null) => {
    setFooter(node);
    if (node == null) setFooterHeight(0);
  };

  return { footer, footerHeight, setFooter: setFooterNode, renderMeasured };
};
