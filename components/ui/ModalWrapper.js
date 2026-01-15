import { Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { Colors } from "../../constants/styles";

const ModalWrapper = ({ children, onClose, visible, title }) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>{t("cancel")}</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 60 }} />
        </View>
        {children}
      </View>
    </Modal>
  );
};

export default ModalWrapper;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  header: {
    height: 56,
    backgroundColor: Colors.primary100,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  title: { fontSize: 16, fontWeight: "600" },
  cancel: { fontSize: 16, color: Colors.linkLight },
});
