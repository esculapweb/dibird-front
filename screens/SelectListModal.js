import {
  Modal,
  FlatList,
  Pressable,
  Text,
  View,
  StyleSheet,
  TextInput,
} from "react-native";
import { useEffect, useRef, useState, useMemo } from "react";

const ITEM_HEIGHT = 56;

const SelectListModal = ({
  visible,
  options,
  selected,
  onSelect,
  onClose,
  title = "Select",
  placeholder,
  search,
  setSearch,
}) => {
  const flatListRef = useRef(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  useEffect(() => {
    if (visible && !hasScrolled && flatListRef.current) {
      const selectedIndex = filteredOptions.findIndex(
        (o) => o.value === selected
      );

      if (selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
        setTimeout(() => {
          try {
            flatListRef.current.scrollToIndex({
              index: selectedIndex,
              animated: false,
              viewPosition: 0.5,
            });
            setHasScrolled(true);
          } catch (e) {
            console.warn("scrollToIndex failed:", e);
          }
        }, 50);
      }
    }

    if (!visible) setHasScrolled(false);
  }, [visible, filteredOptions, selected]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{placeholder}</Text>
          <View style={{ width: 60 }} />
        </View>

        <TextInput
          style={styles.search}
          placeholder={`Search ${title.toLowerCase()}...`}
          value={search}
          onChangeText={setSearch}
        />

        <FlatList
          ref={flatListRef}
          data={filteredOptions}
          keyExtractor={(item) => item.value}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          renderItem={({ item }) => {
            const isActive = item.value === selected;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                style={{
                  height: ITEM_HEIGHT,
                  justifyContent: "center",
                  paddingHorizontal: 16,
                  backgroundColor: isActive ? "#eef2ff" : "#fff",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: isActive ? "600" : "400",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
};

export default SelectListModal;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f2" },
  header: {
    height: 56,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  title: { fontSize: 16, fontWeight: "600" },
  cancel: { fontSize: 16, color: "#4e8cff" },
  search: {
    height: 40,
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
  },
});
