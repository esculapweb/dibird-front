import { StyleSheet, View, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { LinearGradient } from "expo-linear-gradient";

import FlatButtonBottom from "./FlatButtonBottom";
import { useTheme } from "../../store/theme-context";

const FormWrapper = ({
  header,
  bottomButtonLabel,
  bottomButtonHandler,
  children,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.safeArea}>
      <View style={styles.backgroundBlob1} />
      <View style={styles.backgroundBlob2} />
      <View style={styles.backgroundBlob3} />

      <View style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.container}
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>
            {header}

            <LinearGradient
              colors={[Colors.mainCardBg1, Colors.mainCardBg2]}
              start={[0, 0]}
              end={[1, 1]}
              style={styles.formContainer}
            >
              {children}
            </LinearGradient>
          </View>
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

const stylesFn = (Colors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors.backgroundMain,
    },
    container: {
      flexGrow: 1,
    },
    inner: {
      flex: 1,
      paddingHorizontal: 24,
    },
    backgroundBlob1: {
      position: "absolute",
      width: 250,
      height: 250,
      borderRadius: 100,
      top: -50,
      right: -80,
      opacity: 0.6,
      transform: [{ rotate: "25deg" }],
      backgroundColor: Colors.mainBlob1,
    },
    backgroundBlob2: {
      position: "absolute",
      width: 200,
      height: 200,
      borderRadius: 60,
      bottom: 100,
      left: -60,
      opacity: 0.5,
      transform: [{ rotate: "-15deg" }],
      backgroundColor: Colors.mainBlob2,
    },
    backgroundBlob3: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: 50,
      top: "60%",
      right: -40,
      opacity: 0.4,
      transform: [{ rotate: "45deg" }],
      backgroundColor: Colors.mainBlob3,
    },
    formContainer: {
      padding: 24,
      borderRadius: 32,
      backgroundColor: Colors.mainCardBg1,
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      shadowColor: Colors.shadow,
      elevation: 8,
      overflow: "hidden",
      marginBottom: 16,
    },
  });
