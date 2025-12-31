import { useState, useEffect } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/styles";

import SelectListModal from "../../screens/SelectListModal";

const DropdownInput = ({
  title,
  placeholder = "Select",
  initial,
  value,
  setValue,
  error,
  options,
}) => {
  const [search, setSearch] = useState("");
  const [label, setLabel] = useState("");
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    onSelectValue(initial);
  }, [options]);

  const onSelectValue = (selectedValue) => {
    const option = options.find((o) => o.value === selectedValue);
    setValue(selectedValue);
    setLabel(option?.label || selectedValue);
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
          style={[styles.input, error && { borderColor: "#ef4444" }]}
        >
          <Text
            style={[styles.text, !label && { color: "#9ca3af" }]}
            numberOfLines={1}
          >
            {label || placeholder}
          </Text>

          <Ionicons name="chevron-down" size={20} color="#9ca3af" />
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <SelectListModal
        title={title}
        placeholder={placeholder}
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
  input: {
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
  text: {
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  error: {
    marginTop: 4,
    fontSize: 12,
    color: "#ef4444",
  },
});
