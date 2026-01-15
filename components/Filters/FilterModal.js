import { Pressable, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { Colors } from "../../constants/styles";
import ModalWrapper from "../ui/ModalWrapper";

const FilterModal = ({ visible, onClose, filters }) => {
  const { t } = useTranslation();

  return (
    <ModalWrapper visible={visible} onClose={onClose} title={t("filters")}>
      <Pressable
        style={{
          padding: 12,
          backgroundColor: filters.onlySeen ? "#eef2ff" : "#fff",
          marginBottom: 8,
          borderRadius: 8,
        }}
        onPress={() => setFilters((f) => ({ ...f, onlySeen: !f.onlySeen }))}
      >
        <Text>Only seen</Text>
      </Pressable>

      <Pressable
        style={{
          padding: 12,
          backgroundColor: filters.onlyNotSeen ? "#eef2ff" : "#fff",
          marginBottom: 8,
          borderRadius: 8,
        }}
        onPress={() =>
          setFilters((f) => ({ ...f, onlyNotSeen: !f.onlyNotSeen }))
        }
      >
        <Text>Only not seen</Text>
      </Pressable>

      <Pressable
        style={{
          padding: 12,
          backgroundColor: "#fff",
          marginBottom: 8,
          borderRadius: 8,
        }}
        onPress={() => console.log("open date picker")}
      >
        <Text>Date range</Text>
      </Pressable>

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
        <Text style={{ color: "#000", fontWeight: "600" }}>Apply</Text>
      </Pressable>
    </ModalWrapper>
  );
};

export default FilterModal;
