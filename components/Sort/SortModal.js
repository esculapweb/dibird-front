import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { saveSort } from "../../util/sortStorage";
import ModalWrapper from "../ui/ModalWrapper";
import RadioGroup from "../ui/RadioGroup";

const SORT_OPTIONS = [
  ["ioc_id", "taxonomic"],
  ["-ioc_id", "taxonomic_desc"],
  ["date_time", "date"],
  ["-date_time", "date_desc"],
  ["name", "alphabetic"],
  ["-name", "alphabetic_desc"],
];

const SortModal = ({ visible, onClose, sort, setSort }) => {
  const { t } = useTranslation();
  const [sortInternal, setSortInternal] = useState(null);

  const options = SORT_OPTIONS.map(([value, key]) => ({
    value,
    label: t(key),
  }));

  const applyHandler = async () => {
    setSort(sortInternal);
    await saveSort(sortInternal);
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
            label={t("what_is_first")}
            value={sortInternal}
            onChange={setSortInternal}
            direction="column"
            options={options}
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
