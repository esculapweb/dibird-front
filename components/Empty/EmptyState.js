import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";
import FlatButton from "../ui/FlatButton";

const EmptyState = ({ type, onAdd, onClear }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  if (type === "filtered") {
    return (
      <View style={styles.container}>
        <Ionicons
          name="search-outline"
          size={48}
          color={Colors.textSecondary}
        />
        <Text style={styles.message}>Ничего не найдено</Text>

        <FlatButton onPress={onClear} style={{ marginTop: 12 }}>
          Сбросить фильтры
        </FlatButton>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons
        name="location-outline"
        size={48}
        color={Colors.textSecondary}
      />
      <Text style={styles.message}>Здесь пока нет мест</Text>

      <FlatButton onPress={onAdd} style={{ marginTop: 12 }}>
        Добавить первое место
      </FlatButton>
    </View>
  );
};

export default EmptyState;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      marginTop: 60,
    },
    message: {
      marginTop: 12,
      color: Colors.textSecondary,
    },
  });
