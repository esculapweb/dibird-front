import { useState, useEffect } from "react";
import { StyleSheet, View, Image, ScrollView, Pressable } from "react-native";

import Input from "../Auth/Input";
import Button from "../ui/Button";
import { Config } from "../../constants/config";
import api from "../../services/api";

import SelectListModal from "../../screens/SelectListModal";

const ProfileForm = ({ data, submitHandler }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");

  const [territoryModalVisible, setTerritoryModalVisible] = useState(false);
  const [territoryOptions, setTerritoryOptions] = useState([]);
  const [territoryValue, setTerritoryValue] = useState("");
  const [territoryLabel, setTerritoryLabel] = useState("");

  const [privateProfile, setPrivateProfile] = useState(false);
  const [privateDiaries, setPrivateDiaries] = useState(false);

  const [timezoneOptions, setTimezoneOptions] = useState([]);
  const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);
  const [timezoneValue, setTimezoneValue] = useState("");
  const [timezoneLabel, setTimezoneLabel] = useState("");

  const [search, setSearch] = useState("");

  const [invalid, setInvalid] = useState({
    firstName: false,
    lastName: false,
    username: false,
    territory: false,
    timezone: false,
  });

  useEffect(() => {
    const fetchTimezones = async () => {
      const res = await api.get("/api/timezones/");
      const formattedTimezones = res.data.map(([value, label]) => ({
        value,
        label,
      }));

      setTimezoneOptions(formattedTimezones);

      if (data?.timezone) {
        const tzOption = formattedTimezones.find(
          (tz) => tz.value === data.timezone
        );
        setTimezoneValue(data.timezone);
        setTimezoneLabel(tzOption?.label || data.timezone);
      }
    };
    fetchTimezones();
  }, [data]);

  useEffect(() => {
    const fetchCountries = async () => {
      const res = await api.get("/api/territory-dropdown-my/");
      const formattedCountries = res.data.map(([value, label]) => ({
        value,
        label: label.label,
      }));

      setTerritoryOptions(formattedCountries);

      if (data?.territory) {
        const countryOption = formattedCountries.find(
          (c) => c.value === data.territory
        );
        setTerritoryValue(data.territory);
        setTerritoryLabel(countryOption?.label || data.territory);
      }
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

  const openTimezoneModal = () => {
    setSearch("");
    setTimezoneModalVisible(true);
  };

  const onSelectTimezone = (selectedValue) => {
    const tzOption = timezoneOptions.find((tz) => tz.value === selectedValue);
    setTimezoneValue(selectedValue);
    setTimezoneLabel(tzOption?.label || selectedValue);
    setTimezoneModalVisible(false);
  };

  const openTerritoryModal = () => {
    setSearch("");
    setTerritoryModalVisible(true);
  };

  const onSelectTerritory = (selectedValue) => {
    const tOption = territoryOptions.find((t) => t.value === selectedValue);
    setTerritoryValue(selectedValue);
    setTerritoryLabel(tOption?.label || selectedValue);
    setTerritoryModalVisible(false);
  };

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
        <Pressable onPress={openTerritoryModal}>
            <Input
            label="My country"
            value={territoryLabel}
            editable={false}
            pointerEvents="none"
            />
        </Pressable>

        <Pressable onPress={openTimezoneModal}>
          <Input
            label="Timezone"
            value={timezoneLabel}
            editable={false}
            pointerEvents="none"
          />
        </Pressable>

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

      <SelectListModal
        title="Timezone"
        visible={timezoneModalVisible}
        options={timezoneOptions}
        selected={timezoneValue}
        search={search}
        setSearch={setSearch}
        onClose={() => setTimezoneModalVisible(false)}
        onSelect={onSelectTimezone}
      />

      <SelectListModal
        title="Country"
        visible={territoryModalVisible}
        options={territoryOptions}
        selected={territoryValue}
        search={search}
        setSearch={setSearch}
        onClose={() => setTerritoryModalVisible(false)}
        onSelect={onSelectTerritory}
      />
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
    width: 100,
    height: 100,
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
