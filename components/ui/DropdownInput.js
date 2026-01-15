import { useState, useEffect } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/styles";
import { useTranslation } from "react-i18next";

import SelectListModal from "../../screens/SelectListModal";

const DropdownInput = ({
  title,
  placeholder,
  initial,
  value,
  setValue,
  error,
  options,
}) => {
  const [search, setSearch] = useState("");
  const [label, setLabel] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [icon, setIcon] = useState("");
  const { t } = useTranslation();
  const translatedPlaceholder = placeholder || t("select");

  useEffect(() => {
    const option =
      options.find((o) => o.value === value) ||
      options.find((o) => o.value === initial);
    setLabel(option?.label || "");
    setIcon(option?.icon);
  }, [value, initial, options]);

  const onSelectValue = (selectedValue) => {
    const option = options.find((o) => o.value === selectedValue);
    setValue(selectedValue);
    setLabel(option?.label || selectedValue);
    setIcon(option?.icon);
    setModalVisible(false);
  };

  const openModal = () => {
    setSearch("");
    setModalVisible(true);
  };


  return (
    <>
      <View style={styles.wrapper}>
        {title && <Text style={styles.title}>{title}</Text>}

        <Pressable
          onPress={openModal}
          style={[styles.select, error && { borderColor: "#ef4444" }]}
        >
          <View style={styles.left}>
            {icon && <Text style={styles.icon}>{icon}</Text>}

            <Text
              style={[styles.text, !label && { color: "#9ca3af" }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {label || translatedPlaceholder}
            </Text>
          </View>

          <Ionicons name="chevron-down" size={20} color="#9ca3af" />
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <SelectListModal
        placeholder={translatedPlaceholder}
        visible={modalVisible}
        options={options}
        selected={value}
        search={search}
        setSearch={setSearch}
        onClose={() => setModalVisible(false)}
        onSelect={onSelectValue}
      />
    </>
  );
};

export default DropdownInput;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  title: {
    marginVertical: 6,
    fontSize: 14,
    color: Colors.textMain,
  },

  select: {
    height: 40,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    backgroundColor: Colors.primary100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  icon: {
    fontSize: 18,
    marginRight: 6,
  },
  text: {
    fontSize: 16,
    flex: 1,
  },

  error: {
    marginTop: 4,
    fontSize: 12,
    color: "#ef4444",
  },
});
