import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import ModalWrapper from "../ui/ModalWrapper";

const EditPlaceModal = ({ visible, place, onClose, onSave, isLoading }) => {
  const { t } = useTranslation();
  return (
    <ModalWrapper
      visible={visible}
      onClose={onClose}
      onApply={onSave}
      title={t("edit_place")}
    >
      <View>
        <Text>EditPlaceModal</Text>
      </View>
    </ModalWrapper>
  );
};

export default EditPlaceModal;

const styles = StyleSheet.create({});
