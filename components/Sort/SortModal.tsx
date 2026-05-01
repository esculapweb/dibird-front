import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { saveSort } from "../../util/storageHelper";
import ModalWrapper from "../ui/ModalWrapper";
import RadioGroup from "../ui/RadioGroup";

interface SortModalProps {
  screen: string;
  options: {
    label: string;
    value: string;
  }[];
  visible: boolean;
  onClose: () => void;
  sort: string | null;
  setSort: (sort: string | null) => void;
  locationAvailable?: boolean;
  onLocationUnavailable?: () => void;
}

const SortModal = ({
  screen,
  options,
  visible,
  onClose,
  sort,
  setSort,
  locationAvailable = true,
  onLocationUnavailable,
}: SortModalProps) => {
  const { t } = useTranslation();

  const [sortInternal, setSortInternal] = useState<string | null>(null);

  const disabledSortValues = !locationAvailable
    ? options
        .filter((o) => o.value === "distance" || o.value === "-distance")
        .map((o) => o.value)
    : [];

  const applyHandler = async () => {
    setSort(sortInternal);
    await saveSort(screen, sortInternal);
    onClose();
  };

  useEffect(() => {
    if (!visible) return;
    setSortInternal(sort);
  }, [visible, sort]);

  return (
    <ModalWrapper
      visible={visible}
      onClose={onClose}
      onApply={applyHandler}
      title={t("sort")}
    >
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <RadioGroup
            label={`${t("sort_by")}:`}
            value={sortInternal}
            onChange={setSortInternal}
            direction="column"
            options={options}
            disabledValues={disabledSortValues}
            onDisabledPress={() => onLocationUnavailable?.()}
          />
        </ScrollView>
      </View>
    </ModalWrapper>
  );
};

export default SortModal;

const styles = StyleSheet.create({
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
  },
});
