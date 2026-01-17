import { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Colors } from "../../constants/styles";
import ModalWrapper from "../ui/ModalWrapper";
import DropdownInput from "../ui/DropdownInput";
import { fetchMyCountries } from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import AnimatedLoadingButton from "../ui/AnimatedLoadingButton";

const FilterModal = ({ visible, onClose, filters, setFilters }) => {
  const { language } = useLanguage();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(null);
  const [territoryOptions, setTerritoryOptions] = useState([]);
  const [territoryValue, setTerritoryValue] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const countries = await fetchMyCountries(true);
        setTerritoryOptions(countries);
      } catch (e) {
        console.warn(
          `[${new Date().toLocaleString()}] Failed to load data`,
          e.code,
          e.message
        );
      }
    };

    loadData();
  }, [language]);

  const applyHandler = () => {
    setLoading(true);
    const newFilters = {
      territory: territoryValue,
    };
    setFilters(newFilters);

    onClose();
    setLoading(false);
  };

  return (
    <ModalWrapper visible={visible} onClose={onClose} title={t("filters")}>
      <View style={styles.container}>
        <DropdownInput
          title={t("country")}
          placeholder={t("all_countries")}
          initial={filters?.territory}
          value={territoryValue}
          setValue={setTerritoryValue}
          options={territoryOptions}
          error={false}
          allowReset={true}
        />
        <View style={styles.buttonContainer}>
          <AnimatedLoadingButton onPress={applyHandler} loading={loading}>
            {t("apply")}
          </AnimatedLoadingButton>
        </View>
      </View>
    </ModalWrapper>
  );
};

export default FilterModal;

const styles = StyleSheet.create({
  container: {
    padding: 18,
  },
  buttonContainer: {
    marginTop: 18,
  }
});
