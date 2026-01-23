import { useState, useEffect, useCallback } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Colors } from "../../constants/styles";
import SelectListModal from "./SelectListModal";

const DropdownInput = ({
  title,
  placeholder,
  initial,
  value,
  setValue,
  error,
  allowReset,
  staticOptions,
  loadOptions,
  loadDependencies = [],
}) => {
  const { t } = useTranslation();
  const translatedPlaceholder = placeholder || t("select");

  const [options, setOptions] = useState([]);
  const [search, setSearch] = useState("");
  const [label, setLabel] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [icon, setIcon] = useState(null);
  const [iconLabel, setIconLabel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const fetchOptions = async () => {
    if (Array.isArray(staticOptions)) {
      setOptions(staticOptions);
      return;
    }

    if (!loadOptions) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await loadOptions();
      setOptions(Array.isArray(data) ? data : []);
      setLoadError(null);

      if (initial != null && data.some((o) => o.value === initial)) {
        setValue(initial);
      }
    } catch (e) {
      setLoadError(t("failed_to_load_data"));
      console.warn(
        `[${new Date().toLocaleString()}] Dropdown options load failed`,
        e.code,
        e.message,
      );
    } finally {
      setLoading(false);
    }
  };

  const onSelectValue = (selectedValue) => {
    if (!Array.isArray(options)) return;

    const option = options.find((o) => o.value === selectedValue);
    setValue(selectedValue);
    setLabel(option?.label || "");
    setIcon(option?.icon || null);
    setIconLabel(option?.iconLabel || null);
    setModalVisible(false);
  };

  const openModal = () => {
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
    if (!Array.isArray(options)) return;

    if (value === null || value === undefined || value === "") {
      setLabel("");
      setIcon(null);
      setIconLabel(null);
      return;
    }

    const option = options.find((o) => o.value === value);

    if (option) {
      setLabel(option.label);
      setIcon(option.icon || null);
      setIconLabel(option.iconLabel || null);
    } else {
      // setValue(null); 
      setLabel("");
      setIcon(null);
      setIconLabel(null);
    }
  }, [value, options]);

  useEffect(() => {
    fetchOptions();
  }, loadDependencies);

  return (
    <>
      <View style={styles.wrapper}>
        {title && <Text style={styles.title}>{title}</Text>}

        <Pressable
          onPress={openModal}
          style={[styles.select, error && { borderColor: Colors.error500 }]}
        >
          <View style={styles.left}>
            {loading && (
              <Text
                style={[styles.text, !label && { color: Colors.dropdownIcon }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t("loading_")}
              </Text>
            )}
            {loadError && (
              <Text
                style={[styles.text, { color: Colors.error500 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {loadError}
              </Text>
            )}
            {!loading && !loadError && (
              <>
                {iconLabel && (
                  <View style={styles.icon}>
                    <Ionicons
                      name={iconLabel}
                      size={14}
                      color={Colors.accent}
                    />
                  </View>
                )}

                {icon && <Text style={styles.icon}>{icon}</Text>}

                <Text
                  style={[
                    styles.text,
                    !label && { color: Colors.dropdownIcon },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {label || translatedPlaceholder}
                </Text>
              </>
            )}
          </View>

          <View style={styles.right}>
            {loading && (
              <ActivityIndicator
                size="small"
                color={Colors.dropdownIcon}
                style={{ marginRight: 6 }}
              />
            )}

            {loadError && (
              <Pressable onPress={fetchOptions} style={styles.retryIcon}>
                <Ionicons name="refresh" size={18} color={Colors.link} />
              </Pressable>
            )}

            {value && allowReset && !loading && !loadError && (
              <Pressable onPress={clearValue} hitSlop={10} style={styles.clear}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Colors.dropdownIcon}
                />
              </Pressable>
            )}

            {!loading && !loadError && (
              <Ionicons
                name="chevron-down"
                size={20}
                color={Colors.dropdownIcon}
              />
            )}
          </View>
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
        title={title}
      />
    </>
  );
};

export default DropdownInput;

const styles = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  title: { marginVertical: 6, fontSize: 14, color: Colors.textMain },
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
  left: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 },
  icon: { fontSize: 18, marginRight: 6 },
  text: { fontSize: 16, flex: 1, color: Colors.textMain},
  right: { flexDirection: "row", alignItems: "center" },
  clear: { marginRight: 4 },
  error: { marginTop: 4, fontSize: 12, color: Colors.error500 },
  retryIcon: { marginRight: 6 },
});
