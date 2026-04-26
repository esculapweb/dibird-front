import { BaseToast } from "react-native-toast-message";
import { useTheme, ThemeColors } from "../../store/theme-context";

const createToast = (colorKey) => (props) => {
  const { Colors } = useTheme();
  return (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: Colors[colorKey],
        backgroundColor: Colors.primary100,
        borderWidth: 1,
        borderColor: Colors.toastBorder,
        borderRadius: 12,
        // padding: 10,
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{ color: Colors.textMain, fontSize: 15, fontWeight: "600" }}
      text2Style={{ color: Colors.textSecondary, fontSize: 13 }}
      text2NumberOfLines={6}
    />
  );
};

const ThemedToast = {
  success: createToast("toastSuccess"),
  error: createToast("toastError"),
  info: createToast("toastInfo"),
};

export default ThemedToast;
