import { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";

import Input from "../Auth/Input";
import AnimatedLoadingButton from "../ui/AnimatedLoadingButton";
import DropdownInput from "../ui/DropdownInput";
import api from "../../services/api";
import RadioGroup from "../ui/RadioGroup";
import Avatar from "./Avatar";



const ProfileForm = ({ data, submitHandler, loading }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarName, setAvatarName] = useState("");

  const [territoryOptions, setTerritoryOptions] = useState([]);
  const [territoryValue, setTerritoryValue] = useState("");

  const [privateProfile, setPrivateProfile] = useState(false);
  const [privateDiaries, setPrivateDiaries] = useState(false);

  const [timezoneOptions, setTimezoneOptions] = useState([]);
  const [timezoneValue, setTimezoneValue] = useState("");

  const [invalid, setInvalid] = useState({
    firstName: false,
    lastName: false,
    username: false,
    territory: false,
    timezone: false,
  });

  const isoToFlagEmoji = (isoCode) => {
    if (!isoCode) return "";
    return isoCode
      .toUpperCase()
      .replace(/./g, (char) =>
        String.fromCodePoint(127397 + char.charCodeAt())
      );
  };

  useEffect(() => {
    const fetchTimezones = async () => {
      const res = await api.get("/api/timezones/");
      const formattedTimezones = res.data.map(([value, label]) => ({
        value,
        label,
      }));

      setTimezoneOptions(formattedTimezones);
    };
    fetchTimezones();
  }, [data]);

  useEffect(() => {
    const fetchCountries = async () => {
      const res = await api.get("/api/territory-dropdown-my/");
      const formattedCountries = res.data.map(([value, label]) => ({
        value,
        label: label.label,
        icon: isoToFlagEmoji(label["data-code"]),
      }));

      setTerritoryOptions(formattedCountries);
    };
    fetchCountries();
  }, [data]);

  useEffect(() => {
    if (data?.user_data) {
      setFirstName(data.user_data.first_name || "");
      setLastName(data.user_data.last_name || "");
      setUsername(data.user_data.username || "");
      setPrivateProfile(data.private || false);
      setPrivateDiaries(data.private_diary || false);
    }
  }, [data]);

  useEffect(() => {
    const n =
      firstName && lastName
        ? `${firstName[0]}${lastName[0]}`
        : username.slice(0, 2);
    setAvatarName(n.toUpperCase());
  }, [firstName, lastName, username]);

  const validateForm = () => {
    const newInvalid = {
      firstName: !firstName.trim(),
      lastName: !lastName.trim(),
      username: !username.trim(),
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
      username,
      territory: territoryValue,
      timezone: timezoneValue,
      private: privateProfile,
      private_diary: privateDiaries,
    };

    submitHandler(formData, data.user);
  };

  return (
    <>
      <Avatar data={data} avatarName={avatarName} />

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
        value={username}
        onUpdateValue={setUsername}
        isInvalid={invalid.username}
      />

      <DropdownInput
        title="My country"
        placeholder="Select country"
        initial={data?.territory}
        value={territoryValue}
        setValue={setTerritoryValue}
        options={territoryOptions}
        error={invalid?.territory}
      />

      <DropdownInput
        title="Timezone"
        placeholder="Select timezone"
        initial={data?.timezone}
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
