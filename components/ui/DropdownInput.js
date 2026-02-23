import { useState, useEffect } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import SelectListModal from "./SelectListModal";
import { useTheme } from "../../store/theme-context";

const DropdownInput = ({
  title,
  placeholder,
  value,
  setValue,
  error,
  allowReset,
  query,
  disabled = false,
  disabledMessage,
  renderOption,
}) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const translatedPlaceholder = placeholder || t("select");

  const [search, setSearch] = useState("");
  const [label, setLabel] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [icon, setIcon] = useState(null);
  const [iconLabel, setIconLabel] = useState(null);

  const onSelectValue = (selectedValue) => {
    const option = query.data.find((o) => o.value === selectedValue);
    setValue(selectedValue);
    setLabel(option?.label || "");
    setIcon(option?.icon || null);
    setIconLabel(option?.iconLabel || null);
    setModalVisible(false);
  };

  const displayText = disabled
    ? disabledMessage || translatedPlaceholder
    : label || translatedPlaceholder;

  const openModal = () => {
    if (disabled || query.isLoading || query.isError) {
      return;
    }
    setSearch("");
    setModalVisible(true);
  };

  const clearValue = () => {
    setValue(null);
    setLabel("");
    setIcon(null);
    setIconLabel(null);
  };

  useEffect(() => {
    if (!Array.isArray(query.data)) return;

    if (value === null || value === undefined || value === "") {
      setLabel("");
      setIcon(null);
      setIconLabel(null);
      return;
    }

    const option = query.data.find((o) => o.value === value);

    if (option) {
      setLabel(option.label);
      setIcon(option.icon || null);
      setIconLabel(option.iconLabel || null);
    } else {
      setLabel("");
      setIcon(null);
      setIconLabel(null);
    }
  }, [value, query.data]);

  return (
    <>
      <View style={styles.wrapper}>
        {title && <Text style={[styles.title, error && styles.titleError]}>{title}</Text>}

        <Pressable
          onPress={openModal}
          style={[
            styles.select,
            error && { borderColor: Colors.error500 },
            disabled && styles.disabled,
          ]}
        >
          <View style={styles.left}>
            {query.isLoading && (
              <Text style={[styles.text, !label && { color: Colors.dropdownIcon }]} numberOfLines={1} ellipsizeMode="tail">
                {t("loading_")}
              </Text>
            )}
            {query.isError && (
              <Text style={[styles.text, { color: Colors.error500 }]} numberOfLines={1} ellipsizeMode="tail">
                {t("failed_to_load_data")}
              </Text>
            )}
            {!query.isLoading && !query.isError && (
              <>
                {iconLabel && <View style={styles.icon}><Ionicons name={iconLabel} size={14} color={Colors.accent} /></View>}
                {icon && <Text style={styles.icon}>{icon}</Text>}
                <Text
                  style={[
                    styles.text,
                    (!label || disabled) && { color: Colors.dropdownIcon, fontStyle: disabled ? "italic" : "normal" },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {displayText}
                </Text>
              </>
            )}
          </View>

          <View style={styles.right}>
            {query.isLoading && <ActivityIndicator size="small" color={Colors.dropdownIcon} style={{ marginRight: 6 }} />}
            {query.isError && query.refetch && (
              <Pressable onPress={query.refetch} style={styles.retryIcon} hitSlop={12}>
                <Ionicons name="refresh" size={18} color={Colors.link} />
              </Pressable>
            )}

            {!disabled && value && allowReset && !query.isLoading && !query.isError && (
              <Pressable onPress={clearValue} hitSlop={8} style={styles.clear}>
                <Ionicons name="close-circle" size={18} color={Colors.dropdownIcon} />
              </Pressable>
            )}

            {disabled && (
              <Ionicons name="lock-closed" size={20} color={Colors.dropdownIcon} style={{ marginLeft: 4 }} />
            )}

            {!disabled && !query.isLoading && !query.isError && <Ionicons name="chevron-down" size={20} color={Colors.dropdownIcon} />}
          </View>
        </Pressable>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <SelectListModal
        visible={modalVisible}
        options={query.data || []}
        selected={value}
        search={search}
        setSearch={setSearch}
        onClose={() => setModalVisible(false)}
        onSelect={onSelectValue}
        title={title}
        renderOption={renderOption}
      />
    </>
  );
};

export default DropdownInput;

const stylesFn = (Colors) =>
  StyleSheet.create({
    wrapper: { marginBottom: 16 },
    title: { marginBottom: 4, fontSize: 14, color: Colors.textMain },
    titleError: { color: Colors.error500 },
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
    icon: { fontSize: 18, marginRight: 6 },
    text: { fontSize: 16, flex: 1, color: Colors.textMain },
    right: { flexDirection: "row", alignItems: "center" },
    clear: { marginRight: 4 },
    errorText: {
      fontSize: 13,
      color: Colors.error500,
      marginTop: 6,
      marginLeft: 4,
    },
    retryIcon: { marginRight: 6 },
    disabled: {
      opacity: 0.7,
    },
  });
