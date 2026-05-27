import { StyleSheet } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";


import { saveSort } from "../../util/storageHelper";
import RadioGroup from "../ui/RadioGroup";
import { ThemeColors, useTheme } from "../../store/theme-context";

interface SortSheetContentProps {
  screen: string;
  options: {
    label: string;
    value: string;
  }[];
  sort: string | null;
  setSort: (sort: string | null) => void;
  locationAvailable?: boolean;
  onLocationUnavailable?: () => void;
  dismiss: () => void;
}

const SortSheetContent = ({
  screen,
  options,
  sort,
  setSort,
  locationAvailable = true,
  onLocationUnavailable,
  dismiss,
}: SortSheetContentProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const disabledSortValues = !locationAvailable
    ? options
        .filter((o) => o.value === "distance" || o.value === "-distance")
        .map((o) => o.value)
    : [];

  const changeHandler = async (value: string | null) => {
    setSort(value);
    await saveSort(screen, value);
    dismiss();
  };

  return (
    <BottomSheetScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <RadioGroup
        value={sort}
        onChange={changeHandler}
        direction="column"
        options={options}
        disabledValues={disabledSortValues}
        onDisabledPress={() => onLocationUnavailable?.()}
      />
    </BottomSheetScrollView>
  );
};

export default SortSheetContent;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 680,
      backgroundColor: Colors.primary100,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingVertical: 50,
    },
  });
