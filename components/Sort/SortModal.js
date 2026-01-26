import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { saveSort } from "../../util/sortStorage";
import ModalWrapper from "../ui/ModalWrapper";
import RadioGroup from "../ui/RadioGroup";

const SortModal = ({ visible, onClose, sort, setSort }) => {
  const { t } = useTranslation();

  const [sortInternal, setSortInternal] = useState(null);

  const options = [
    { label: t("taxonomic"), value: "ioc_id" },
    { label: t("taxonomic_desc"), value: "-ioc_id" },
    { label: t("date_sort"), value: "date_time" },
    { label: t("date_sort_desc"), value: "-date_time" },
    { label: t("alphabetic"), value: "name" },
    { label: t("alphabetic_desc"), value: "-name" },
  ];

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
            label={`${t("sort_by")}:`}
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
