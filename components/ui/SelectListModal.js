import { FlatList, View, StyleSheet, Text } from "react-native";
import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";
import ModalWrapper from "./ModalWrapper";
import DefaultOptionRow from "./DefaultOptionRow";
import SearchInput from "./SearchInput";
import { sortOptionsList } from "../../util/sortOptionsList";
import RadioGroup from "./RadioGroup";

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
  type,
  sort,
  onSortChange,
}) => {
  const flatListRef = useRef(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const sortOptions = type ? sortOptionsList(type) : [];
  const [sortOrder, setSortOrder] = useState(sort ?? null);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(search.toLowerCase()),
    );
  }, [options, search]);

  useEffect(() => {
    setSortOrder(sort);
  }, [sort]);
  
  const handleSortChange = (val) => {
    setSortOrder(val);
    setSortMenuVisible(false);
    onSortChange?.(val);  
  };

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
    <ModalWrapper
      visible={visible}
      onClose={onClose}
      title={title}
      showSortIcon={!!type}
      onSort={() => setSortMenuVisible((prev) => !prev)}
    >
      {options.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("no_options_available")}</Text>
        </View>
      ) : (
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder={`${t("search")}...`}
            style={{ marginBottom: 8 }}
          />

          {sortMenuVisible && (
            <View style={styles.sortMenu}>
              <RadioGroup
                label={`${t("sort_by")}:`}
                value={sortOrder}
                onChange={handleSortChange}
                direction="column"
                options={sortOptions}
              />
            </View>
          )}

          {filteredOptions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t("nothing_found")}</Text>
            </View>
          ) : (
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
          )}
        </>
      )}
    </ModalWrapper>
  );
};

export default SelectListModal;

const stylesFn = (Colors) =>
  StyleSheet.create({
    empty: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    emptyText: {
      color: Colors.textSecondary,
      fontSize: 16,
      textAlign: "center",
    },
    sortMenu: {
      backgroundColor: Colors.primary100,
      borderRadius: 10,
      marginHorizontal: 12,
      marginBottom: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  });
