import { ScrollView, StyleSheet } from "react-native";

import { saveSort } from "../../util/storageHelper";
import RadioGroup from "../ui/RadioGroup";

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
    <ScrollView
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
    </ScrollView>
  );
};

export default SortSheetContent;

const styles = StyleSheet.create({
  scroll: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 680,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
});
