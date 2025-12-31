import { useState, useEffect } from "react";
import { StyleSheet, View, Image, ScrollView } from "react-native";

import Input from "../Auth/Input";
import Button from "../ui/Button";
import DropdownInput from "../ui/DropdownInput";
import { Config } from "../../constants/config";
import api from "../../services/api";

const ProfileForm = ({ data, submitHandler }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");

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
        icon: isoToFlagEmoji(label['data-code']),
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

    submitHandler(formData);
  };

  return (
    <>
      <ScrollView>
        <View style={styles.imageContainer}>
          {data?.avatar && (
            <Image
              source={{
                uri: `${Config.baseUrl}/media/${data.avatar}.150x150_q85_crop.jpg`,
              }}
              style={styles.image}
            />
          )}
        </View>

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

        <Input
          label="Only I can see my profile"
          value={privateProfile}
          onUpdateValue={setPrivateProfile}
          isInvalid={invalid.privateProfile}
        />

        <Input
          label="Diaries are private by default"
          value={privateDiaries}
          onUpdateValue={setPrivateDiaries}
          isInvalid={invalid.privateDiaries}
        />

        <View style={styles.buttons}>
          <Button onPress={onSubmit}>Save</Button>
        </View>
      </ScrollView>
    </>
  );
};

export default ProfileForm;

const styles = StyleSheet.create({
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: 75,
    height: 75,
    resizeMode: "contain",
  },
  buttons: {
    marginTop: 18,
  },
  picker: {
    height: 200,
    width: "100%",
  },
});
