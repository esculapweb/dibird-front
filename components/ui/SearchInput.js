import { View, TextInput, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";

const SearchInput = ({ value, onChange, placeholder, onClear, style }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const showClear = value && value.length > 0;

  return (
    <View style={[styles.container, style && style]}>
      <Ionicons name="search-outline" size={20} color={Colors.textSecondary} />

      <TextInput
        style={styles.input}
        placeholder={placeholder ?? t("search")}
        placeholderTextColor={Colors.textSecondary}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {showClear && (
        <Pressable
          onPress={onClear}
          hitSlop={8}
          accessibilityLabel={t("clear_search")}
          accessibilityRole="button"
        >
          <Ionicons
            name="close-circle"
            size={18}
            color={Colors.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
};

export default SearchInput;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      height: 44,
      paddingHorizontal: 12,
      marginHorizontal: 12,
      marginTop: 8,
      borderRadius: 12,
      backgroundColor: Colors.primary100,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    input: {
      flex: 1,
      marginHorizontal: 4,
      paddingVertical: 0,
      fontSize: 16,
      color: Colors.textMain,
    },

    clearButton: {
      padding: 4,
    },
  });
