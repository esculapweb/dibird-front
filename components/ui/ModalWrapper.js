import { Modal, Pressable, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../store/theme-context";
import { SafeAreaView } from "react-native-safe-area-context";

const ICON_SIZE = 24;
const BUTTON_SIZE = 40;

const ModalWrapper = ({ children, onClose, onApply, visible, title }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SafeAreaView edges={['top']}
          style={{ flex: 1, backgroundColor: Colors.backgroundMain }}
        >
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.iconButton,
                styles.leftButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={ICON_SIZE} color={Colors.textMain} />
            </Pressable>

            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>

            {onApply && (
              <Pressable
                onPress={onApply}
                style={({ pressed }) => [
                  styles.iconButton,
                  styles.rightButton,
                  styles.applyButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="checkmark"
                  size={ICON_SIZE}
                  color={Colors.buttonBrightColor}
                />
              </Pressable>
            )}
          </View>
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default ModalWrapper;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.backgroundMain,
    },

    header: {
      height: 56,
      paddingVertical: 8,
      backgroundColor: Colors.primary100,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    title: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
      maxWidth: "70%",
    },

    iconButton: {
      position: "absolute",
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      top: 8,
    },

    leftButton: {
      left: 16,
      backgroundColor: Colors.primary200,
      borderWidth: 1,
      borderColor: Colors.border,
    },

    rightButton: {
      right: 16,
    },

    applyButton: {
      backgroundColor: Colors.buttonBrightBg,
    },

    pressed: {
      opacity: 0.8,
      transform: [{ scale: 0.96 }],
    },
  });
