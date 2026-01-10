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
        console.warn(t('failed_to_load_data'), e);
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
        label="First name"
        value={firstName}
        onUpdateValue={setFirstName}
        isInvalid={invalid.firstName}
      />
      <Input
        label="Last name"
        value={lastName}
        onUpdateValue={setLastName}
        isInvalid={invalid.lastName}
      />
      <Input
        label="Username"
        value={userName}
        onUpdateValue={setUserName}
        isInvalid={invalid.userName}
      />

      <DropdownInput
        title="My country"
        placeholder="Select country"
        initial={profileCtx.profile.territory}
        value={territoryValue}
        setValue={setTerritoryValue}
        options={territoryOptions}
        error={invalid?.territory}
      />

      <DropdownInput
        title="Timezone"
        placeholder="Select timezone"
        initial={profileCtx.profile.timezone}
        value={timezoneValue}
        setValue={setTimezoneValue}
        options={timezoneOptions}
        error={invalid?.timezone}
      />

      <RadioGroup
        label="Only I can see my profile"
        value={privateProfile}
        onChange={setPrivateProfile}
        direction="row"
        isInvalid={invalid.privateProfile}
        options={[
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]}
      />

      <RadioGroup
        label="Diaries are private by default"
        value={privateDiaries}
        onChange={setPrivateDiaries}
        direction="row"
        isInvalid={invalid.privateDiaries}
        options={[
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]}
      />

      <View style={styles.buttons}>
        <AnimatedLoadingButton onPress={onSubmit} loading={loading}>
          Save
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
