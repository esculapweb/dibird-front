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

const ProfileForm = ({ submitHandler, loading }) => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState("");

  const [territoryOptions, setTerritoryOptions] = useState([]);
  const [territoryValue, setTerritoryValue] = useState("");

  const [privateProfile, setPrivateProfile] = useState(false);
  const [privateDiaries, setPrivateDiaries] = useState(false);

  const [timezoneOptions, setTimezoneOptions] = useState([]);
  const [timezoneValue, setTimezoneValue] = useState("");

  const [invalid, setInvalid] = useState({
    firstName: false,
    lastName: false,
    userName: false,
    territory: false,
    timezone: false,
  });

  const profileCtx = useProfile();

  useEffect(() => {
    const loadData = async () => {
      try {
        const timezones = await fetchTimezones();
        const countries = await fetchCountries();
        setTimezoneOptions(timezones);
        setTerritoryOptions(countries);
      } catch (e) {
        console.warn(t("failed_to_load_data"), e.code, e.message);
      }
    };

    loadData();
  }, [language]);

  useEffect(() => {
    setFirstName(profileCtx.profile.user_data.first_name);
    setLastName(profileCtx.profile.user_data.last_name);
    setUserName(profileCtx.profile.user_data.username);
    setPrivateProfile(profileCtx.profile.private);
    setPrivateDiaries(profileCtx.profile.private_diary);
  }, [profileCtx.profile]);

  const validateForm = () => {
    const newInvalid = {
      // firstName: !firstName.trim(),
      // lastName: !lastName.trim(),
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

  return (
    <>
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
        initial={profileCtx.profile.territory}
        value={territoryValue}
        setValue={setTerritoryValue}
        options={territoryOptions}
        error={invalid?.territory}
      />

      <DropdownInput
        title={t("timezone")}
        placeholder={t("select_timezone")}
        initial={profileCtx.profile.timezone}
        value={timezoneValue}
        setValue={setTimezoneValue}
        options={timezoneOptions}
        error={invalid?.timezone}
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
      />

      <View style={styles.buttons}>
        <AnimatedLoadingButton onPress={onSubmit} loading={loading}>
          {t("save")}
        </AnimatedLoadingButton>
      </View>
    </>
  );
};

export default ProfileForm;

const styles = StyleSheet.create({
  buttons: {
    marginTop: 18,
  },
});
