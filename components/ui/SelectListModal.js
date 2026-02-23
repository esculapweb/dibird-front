import {
  FlatList,
  StyleSheet,
  TextInput,
} from "react-native";
import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

import ModalWrapper from "./ModalWrapper";
import { useTheme } from "../../store/theme-context";
import DefaultOptionRow from "./DefaultOptionRow";

const SelectListModal = ({
  visible,
  options,
  selected,
  onSelect,
  onClose,
  search,
  setSearch,
  title,
  renderOption,
  itemHeight = 52,
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
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        renderItem={({ item }) =>
          renderOption ? (
            renderOption({ item, selected, onSelect, onClose })
          ) : (
            <DefaultOptionRow
              item={item}
              selected={selected}
              onSelect={onSelect}
              onClose={onClose}
              itemHeight={itemHeight}
            />
          )
        }
      />
    </ModalWrapper>
  );
};

export default SelectListModal;

const stylesFn = (Colors) =>
  StyleSheet.create({
    search: {
      height: 40,
      margin: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: Colors.primary100,
      borderWidth: 1,
      borderColor: Colors.border,
      color: Colors.textMain,
    },

    imageSmall: {
      width: 40,
      height: 40,
      borderRadius: 12,
    },
  });
