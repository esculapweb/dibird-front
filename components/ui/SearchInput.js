import { View, TextInput, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";

const SearchInput = ({ value, onChange, placeholder }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const showClear = value && value.length > 0;

  return (
    <View style={styles.container}>
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
          onPress={() => onChange("")}
          hitSlop={10}
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

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",

      height: 44,
      paddingHorizontal: 12,
      marginHorizontal: 8,
      marginTop: 8,

      borderRadius: 12,
      backgroundColor: Colors.primary100,
    },

    input: {
      flex: 1,
      marginHorizontal: 4,
      paddingVertical: 0,

      fontSize: 16,
      color: Colors.textMain,

      shadowColor: Colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    clearButton: {
      padding: 4,
    },
  });
