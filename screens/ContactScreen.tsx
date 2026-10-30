import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import Toast from "react-native-toast-message";

import Input from "../components/ui/Input";
import Layout from "../components/ui/Layout";
import AnimatedLoadingButton from "../components/ui/AnimatedLoadingButton";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useProfile } from "../store/profile-context";
import { useApiError } from "../hooks/useApiError";
import { useProfileDisplay } from "../hooks/Profile/useProfileDisplay";
import { sendContactMessage } from "../util/fetches";
import { openSupportEmail } from "../util/openSupportEmail";
import { Config } from "../constants/config";
import {
  AppError,
  AppStackRouteProp,
  AuthStackNavigationProp,
  ContactMessage,
} from "../types";

// Mirror the backend (api.models.Contact): typing past these would only come
// back as a 400. `message` is a TextField with no limit in the model, the cap
// here matches the serializer's CONTACT_MESSAGE_MAX_LENGTH.
const MAX_LENGTH: Record<keyof ContactMessage, number> = {
  name: 100,
  email: 254,
  subject: 255,
  message: 5000,
};

const FIELDS = Object.keys(MAX_LENGTH) as (keyof ContactMessage)[];

type FieldErrors = Partial<Record<keyof ContactMessage, string>>;

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * The "write to us" form. Posts to the same `/api/contact/` as the website, so
 * the letter lands in the same inbox and the same admin list. Open to guests:
 * someone stuck on a confirmation letter has no account to sign in with.
 */
const ContactScreen = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  // Both stacks declare the route with the same params; `goBack` is all the
  // screen does with the navigator.
  const navigation = useNavigation<AuthStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Contact">>();
  const { profile } = useProfile();
  const { showErrorToast } = useApiError();
  const { fullName } = useProfileDisplay({
    firstName: profile?.user_data?.first_name,
    lastName: profile?.user_data?.last_name,
    username: profile?.user_data?.username,
  });

  const [form, setForm] = useState<ContactMessage>(() => ({
    name: fullName,
    email: route.params?.prefillEmail ?? profile?.user_data?.email ?? "",
    subject: "",
    message: "",
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const setField = (field: keyof ContactMessage) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (data: ContactMessage): FieldErrors => {
    const result: FieldErrors = {};
    for (const field of FIELDS) {
      if (!data[field]) result[field] = t("contact_field_required");
    }
    if (data.email && !isEmail(data.email)) {
      result.email = t("contact_invalid_email");
    }
    return result;
  };

  const submitHandler = async () => {
    if (loading) return;

    const trimmed: ContactMessage = {
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
    };

    const localErrors = validate(trimmed);
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await sendContactMessage(trimmed);
      Toast.show({
        type: "success",
        text1: t("contact_sent_title"),
        text2: t("contact_sent_message"),
      });
      navigation.goBack();
    } catch (e) {
      const err = e as AppError;
      const data = err.response?.data;
      // A 400 is DRF's per-field validation ({ email: ["..."] }): it belongs
      // under the field, a toast would hide which one. Everything else
      // (offline, 5xx) goes through the common toast. In every case the typed
      // text stays in the form for another try.
      const serverErrors: FieldErrors = {};
      if (err.status === 400 && data && typeof data === "object") {
        for (const field of FIELDS) {
          const value = (data as Record<string, unknown>)[field];
          const first = Array.isArray(value) ? value[0] : value;
          if (typeof first === "string") serverErrors[field] = first;
        }
      }
      if (Object.keys(serverErrors).length) {
        setErrors(serverErrors);
      } else if (err.status === 429) {
        // The form has its own server-side limit (a few letters an hour). DRF's
        // own text counts the wait in seconds, which reads like an error code.
        Toast.show({
          type: "error",
          text1: t("contact_too_many_title"),
          text2: t("contact_too_many_message"),
        });
      } else {
        showErrorToast(e, "ContactForm");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout withKeyboard style={{ paddingHorizontal: 24, paddingTop: 24 }}>
      <Text style={styles.hint}>{t("contact_hint")}</Text>

      <Input
        label={t("contact_name")}
        onUpdateValue={setField("name")}
        value={form.name}
        isInvalid={!!errors.name}
        error={errors.name}
        autoCapitalize="words"
        maxLength={MAX_LENGTH.name}
        textContentType="name"
        autoComplete="name"
        testID="contact-name-input"
      />

      <Input
        label={t("email_address")}
        onUpdateValue={setField("email")}
        value={form.email}
        isInvalid={!!errors.email}
        error={errors.email}
        keyboardType="email-address"
        maxLength={MAX_LENGTH.email}
        textContentType="emailAddress"
        autoComplete="email"
        testID="contact-email-input"
      />

      <Input
        label={t("contact_subject")}
        onUpdateValue={setField("subject")}
        value={form.subject}
        isInvalid={!!errors.subject}
        error={errors.subject}
        autoCapitalize="sentences"
        autoCorrect
        maxLength={MAX_LENGTH.subject}
        testID="contact-subject-input"
      />

      <Input
        label={t("contact_message")}
        onUpdateValue={setField("message")}
        value={form.message}
        isInvalid={!!errors.message}
        error={errors.message}
        autoCapitalize="sentences"
        autoCorrect
        multiline
        minHeight={140}
        maxLength={MAX_LENGTH.message}
        testID="contact-message-input"
      />

      <View style={styles.buttonContainer}>
        <AnimatedLoadingButton
          onPress={submitHandler}
          loading={loading}
          testID="contact-submit-button"
        >
          {t("contact_send")}
        </AnimatedLoadingButton>
      </View>

      {/* The mail app stays as a way out: for an attachment, or when the
          form itself is what is broken. */}
      <Text style={styles.alternative}>
        {t("contact_or_email")}{" "}
        <Text
          style={styles.link}
          onPress={openSupportEmail}
          testID="contact-email-link"
        >
          {Config.email}
        </Text>
      </Text>
    </Layout>
  );
};

export default ContactScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    hint: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 16,
      lineHeight: 18,
    },
    buttonContainer: {
      marginVertical: 16,
      borderRadius: 16,
    },
    alternative: {
      fontSize: 13,
      color: Colors.textSecondary,
      textAlign: "center",
      marginBottom: 24,
    },
    link: {
      color: Colors.main100,
      textDecorationLine: "underline",
    },
  });
