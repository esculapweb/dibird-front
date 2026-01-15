import { useState, useEffect } from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Colors } from "../../constants/styles";
import ModalWrapper from "../ui/ModalWrapper";
import DropdownInput from "../ui/DropdownInput";
import { fetchMyCountries } from "../../util/fetches";
import { useLanguage } from "../../store/language-context";

const FilterModal = ({ visible, onClose, filters }) => {
    const { language } = useLanguage();
    const { t } = useTranslation();

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
        />
        <Pressable
          onPress={onClose}
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: Colors.accent,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#000", fontWeight: "600" }}>{t("apply")}</Text>
        </Pressable>
      </View>
    </ModalWrapper>
  );
};

export default FilterModal;

const styles = StyleSheet.create({
    container: {
        padding: 18
    }
})