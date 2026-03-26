import {
  forwardRef,
  useMemo,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";

import { useTheme } from "../../store/theme-context";

const ConfirmBottomSheet = forwardRef(
  (
    {
      type = "warning",
      title,
      description,
      confirmText,
      cancelText,
      onConfirm,
    },
    ref,
  ) => {
    const { Colors } = useTheme();
    const styles = stylesFn(Colors);
    const bottomSheetRef = useRef(null);
    const snapPoints = useMemo(() => ["35%"], []);
    const [data, setData] = useState(null);

    const TYPE_CONFIG = {
      danger: {
        icon: "close-circle",
      },
      warning: {
        icon: "warning",
      },
      success: {
        icon: "checkmark-circle",
      },
    };

    const colorMap = {
      danger: Colors.error500,
      warning: Colors.buttonBrightBg,
      success: Colors.seenIcon,
    };

    const color = colorMap[type];

    const present = (payload) => {
      setData(payload);
      bottomSheetRef.current?.present();
    };

    const dismiss = () => {
      bottomSheetRef.current?.dismiss();
    };

    useImperativeHandle(ref, () => ({
      present,
      dismiss,
    }));

    const handleConfirm = () => {
      dismiss();
      onConfirm?.(data);
    };

    const config = TYPE_CONFIG[type];

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        handleStyle={{
          backgroundColor: Colors.primary100,
        }}
        handleIndicatorStyle={{
          backgroundColor: Colors.textSecondary,
          width: 40,
          height: 4,
        }}
        backgroundStyle={{
          backgroundColor: Colors.primary100,
        }}
      >
        <BottomSheetView style={styles.container}>
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.description}>
            {typeof description === "function"
              ? description(data)
              : description}
          </Text>

          <Pressable
            style={[styles.primaryButton, { backgroundColor: color }]}
            onPress={handleConfirm}
          >
            <Text style={styles.primaryText}>{confirmText}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={dismiss}>
            <Text
              style={[styles.secondaryText, { color: Colors.textSecondary }]}
            >
              {cancelText}
            </Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

export default ConfirmBottomSheet;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      padding: 20,
      gap: 14,
      backgroundColor: Colors.primary100,
    },
    iconWrapper: {
      alignItems: "center",
      marginBottom: 4,
    },
    title: {
      fontSize: 17,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
    },
    description: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    primaryButton: {
      marginTop: 10,
      padding: 14,
      borderRadius: 10,
      alignItems: "center",
    },
    primaryText: {
      color: Colors.buttonBrightColor,
      fontWeight: "600",
    },
    secondaryButton: {
      padding: 12,
      alignItems: "center",
    },
    secondaryText: {
      fontWeight: "500",
    },
  });
