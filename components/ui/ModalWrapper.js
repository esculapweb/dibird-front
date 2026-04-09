import { Modal, View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../store/theme-context";
import { SafeAreaView } from "react-native-safe-area-context";

import IconButton from "./IconButton";

const ICON_SIZE = 18;
const BUTTON_SIZE = 36;

const ModalWrapper = ({
  children,
  onClose,
  onApply,
  visible,
  title,
  onSort,
  showSortIcon,
}) => {
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
        <SafeAreaView
          edges={["top"]}
          style={{ flex: 1, backgroundColor: Colors.backgroundMain }}
        >
          <View style={styles.header}>
            <IconButton
              onPress={onClose}
              icon="close-circle"
              size={BUTTON_SIZE}
              tintColor={Colors.radioBorder}
            />

            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>

            {showSortIcon && onSort && (
              <View style={styles.sortWrapper}><IconButton
                onPress={onSort}
                icon="swap-vertical"
                size={ICON_SIZE}
                tintColor={Colors.textSecondary}
              /></View>
            )}

            {onApply && (
              <IconButton
                onPress={onApply}
                icon="checkmark-circle"
                size={BUTTON_SIZE}
                tintColor={Colors.main100}
              />
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
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: Colors.primary100,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
    },
    sortWrapper: {
      borderWidth: 1,
      borderColor: Colors.textSecondary,
      borderRadius: 14,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    }
  });
