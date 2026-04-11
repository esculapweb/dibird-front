import { View, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import FlatButtonBottom from "./FlatButtonBottom";
import { useTheme } from "../../store/theme-context";
import BackgroundScene from "./BackgroundScene";


const FormWrapper = ({ header, bottomButtonLabel, bottomButtonHandler, children }) => {
  const { Colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.backgroundMain }}>
      <BackgroundScene />

      <View style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
          showsVerticalScrollIndicator={false}
        >
          {header}
          {children}
        </KeyboardAwareScrollView>

        {bottomButtonLabel && (
          <FlatButtonBottom onPress={bottomButtonHandler}>
            {bottomButtonLabel}
          </FlatButtonBottom>
        )}
      </View>
    </View>
  );
};

export default FormWrapper;