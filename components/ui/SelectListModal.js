import {
  FlatList,
  Pressable,
  Text,
  View,
  StyleSheet,
  TextInput,
} from "react-native";
import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import ModalWrapper from "./ModalWrapper";
import { useTheme } from "../../store/theme-context";

const ITEM_HEIGHT = 46;

const SelectListModal = ({
  visible,
  options,
  selected,
  onSelect,
  onClose,
  search,
  setSearch,
  title,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const flatListRef = useRef(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const { t } = useTranslation();

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(search.toLowerCase()),
    );
  }, [options, search]);

  useEffect(() => {
    if (visible && !hasScrolled && flatListRef.current) {
      const selectedIndex = filteredOptions.findIndex(
        (o) => o.value === selected,
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

  const renderItem = ({ item }) => {
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
          backgroundColor: isActive ? Colors.primary300 : Colors.primary100,
        }}
      >
        <View style={styles.row}>
          {item.iconLabel && (
            <View style={styles.icon}>
              <Ionicons name={item.iconLabel} size={14} color={Colors.accent} />
            </View>
          )}
          {item.icon && <Text style={styles.icon}>{item.icon}</Text>}
          <Text
            style={{
              fontSize: 16,
              fontWeight: isActive ? "600" : "400",
              color: Colors.textMain
            }}
          >
            {item.label}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ModalWrapper visible={visible} onClose={onClose} title={title}>
      <TextInput
        style={styles.search}
        placeholder={`${t("search")}...`}
        placeholderTextColor={Colors.textSecondary}
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
        renderItem={renderItem}
      />
    </ModalWrapper>
  );
};

export default SelectListModal;

const stylesFn = (Colors) => StyleSheet.create({
  search: {
    height: 40,
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary100,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textMain
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 18,
    marginRight: 6,
  },
});
