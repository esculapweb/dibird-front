import { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import Input from "../ui/Input";
import AnimatedLoadingButton from "../ui/AnimatedLoadingButton";
import DropdownInput from "../ui/DropdownInput";
import RadioGroup from "../ui/RadioGroup";
import { useProfile } from "../../store/profile-context";
import { fetchTimezones, fetchCountries } from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import { useTranslatedQuery } from "../../hooks/useQueryWithTranslation";

const ProfileForm = ({ submitHandler, loading, success }) => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { profile } = useProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState("");

  const [territoryValue, setTerritoryValue] = useState("");
  const [privateProfile, setPrivateProfile] = useState(false);
  const [privateDiaries, setPrivateDiaries] = useState(false);
  const [timezoneValue, setTimezoneValue] = useState("");

  const [invalid, setInvalid] = useState({
    firstName: false,
    lastName: false,
    userName: false,
    territory: false,
    timezone: false,
  });

  const setInitialValues = () => {
    setFirstName(profile.user_data.first_name ?? "");
    setLastName(profile.user_data.last_name ?? "");
    setUserName(profile.user_data.username ?? "");
    setPrivateProfile(profile.private ?? false);
    setPrivateDiaries(profile.private_diary ?? false);
    setTerritoryValue(profile.territory ?? "");
    setTimezoneValue(profile.timezone ?? "");
  };

  const validateForm = () => {
    const newInvalid = {
      userName: !userName.trim(),
      territory: !String(territoryValue ?? "").trim(),
      timezone: !String(timezoneValue ?? "").trim(),
    };
    setInvalid(newInvalid);

    return !Object.values(newInvalid).some((v) => v);
  };

  const onSubmit = () => {
    if (!validateForm()) return;

    const formData = {
      first_name: firstName,
      last_name: lastName,
      username: userName,
      territory: territoryValue,
      timezone: timezoneValue,
      private: privateProfile,
      private_diary: privateDiaries,
    };

    submitHandler(formData);
  };

  useEffect(() => {
    if (!profile?.user_data) return;
    setInitialValues();
  }, [profile]);

  return (
    <View style={styles.outer}>
      <View style={styles.container}>
        <Input
          label={t("first_name")}
          value={firstName}
          onUpdateValue={setFirstName}
          isInvalid={invalid.firstName}
        />
        <Input
          label={t("last_name")}
          value={lastName}
          onUpdateValue={setLastName}
          isInvalid={invalid.lastName}
        />
        <Input
          label={t("username")}
          value={userName}
          onUpdateValue={setUserName}
          isInvalid={invalid.userName}
        />

        <DropdownInput
          title={t("my_country")}
          placeholder={t("select_country")}
          value={territoryValue}
          setValue={setTerritoryValue}
          query={useTranslatedQuery({
            queryFn: fetchCountries,
            params: [language],
          })}
        />

        <DropdownInput
          title={t("timezone")}
          placeholder={t("select_timezone")}
          value={timezoneValue}
          setValue={setTimezoneValue}
          query={useTranslatedQuery({ queryFn: fetchTimezones })}
        />

        <RadioGroup
          label={t("only_i_can_see_my_profile")}
          value={privateProfile}
          onChange={setPrivateProfile}
          direction="row"
          isInvalid={invalid.privateProfile}
          options={[
            { label: t("yes"), value: true },
            { label: t("no"), value: false },
          ]}
          style={styles.radioGroup}
        />

        <RadioGroup
          label={t("diaries_are_private_by_default")}
          value={privateDiaries}
          onChange={setPrivateDiaries}
          direction="row"
          isInvalid={invalid.privateDiaries}
          options={[
            { label: t("yes"), value: true },
            { label: t("no"), value: false },
          ]}
          style={styles.radioGroup}
        />

        <View style={styles.buttons}>
          <AnimatedLoadingButton
            onPress={onSubmit}
            loading={loading}
            success={success}
          >
            {t("save")}
          </AnimatedLoadingButton>
        </View>
      </View>
    </View>
  );
};

export default ProfileForm;

const styles = StyleSheet.create({
  outer: { flex: 1, justifyContent: "space-between" },
  container: {
    padding: 18,
  },
  buttons: {
    marginTop: 10,
  },
  flatButtonContainer: {
    paddingHorizontal: 18,
  },
  radioGroup: {
    marginBottom: 16,
  },
});
