import { useState, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import { useTranslation } from "react-i18next";

import Input from "../ui/Input";
import AnimatedLoadingButton from "../ui/AnimatedLoadingButton";
import DropdownInput from "../ui/DropdownInput";
import PrivacyToggle from "../ui/PrivacyToggle";
import { useProfile } from "../../store/profile-context";
import { fetchTimezones, fetchMyCountries } from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { useTheme } from "../../store/theme-context";

const ProfileForm = ({ submitHandler, loading, success }) => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

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
    submitHandler({
      first_name: firstName,
      last_name: lastName,
      username: userName,
      territory: territoryValue,
      timezone: timezoneValue,
      private: privateProfile,
      private_diary: privateDiaries,
    });
  };

  const {
    query: queryMyCountries,
    sort: countriesSort,
    onSortChange: onCountriesSortChange,
  } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
  });

  const { query: queryTimeZones } = useDropdownQuery({
    type: "TimezonesDropdown",
    queryFn: fetchTimezones,
    params: [],
  });

  useEffect(() => {
    if (!profile?.user_data) return;
    setInitialValues();
  }, [profile]);

  return (
    <View style={styles.outer}>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Input
            label={t("first_name")}
            value={firstName}
            onUpdateValue={setFirstName}
            isInvalid={invalid.firstName}
          />
        </View>
        <View style={styles.rowItem}>
          <Input
            label={t("last_name")}
            value={lastName}
            onUpdateValue={setLastName}
            isInvalid={invalid.lastName}
          />
        </View>
      </View>

      <Input
        label={t("username")}
        value={userName}
        onUpdateValue={setUserName}
        isInvalid={invalid.userName}
        prefix="@"
      />

      <View style={styles.hairline} />

      <DropdownInput
        title={t("my_country")}
        placeholder={t("select_country")}
        value={territoryValue}
        setValue={setTerritoryValue}
        query={queryMyCountries}
        type="CountriesDropdown"
        sort={countriesSort}
        onSortChange={onCountriesSortChange}
      />

      <DropdownInput
        title={t("timezone")}
        placeholder={t("select_timezone")}
        value={timezoneValue}
        setValue={setTimezoneValue}
        query={queryTimeZones}
      />

      <View style={styles.hairline} />
        <Text style={styles.privacyLabel}>{t("profile")}</Text>
        <PrivacyToggle
          value={privateProfile}
          onChange={setPrivateProfile}
          gender="male"
          style={{marginBottom: 12}}
        />
        <View style={styles.hairline} />
        <Text style={styles.privacyLabel}>{t("new_observatoins_and_diaries")}</Text>
        <PrivacyToggle
          value={privateDiaries}
          onChange={setPrivateDiaries}
          gender="multiple"
        />

      <View style={styles.buttonContainer}>
        <AnimatedLoadingButton
          onPress={onSubmit}
          loading={loading}
          success={success}
          bright
        >
          {t("save")}
        </AnimatedLoadingButton>
      </View>
    </View>
  );
};

export default ProfileForm;

const stylesFn = (Colors) =>
  StyleSheet.create({
    outer: {
      paddingBottom: 8,
    },
    hairline: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.tabBorder,
      marginBottom: 12,
      marginHorizontal: -24,
    },
    row: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 4,
    },
    rowItem: {
      flex: 1,
    },
    divider: {
      marginBottom: 12,
    },
    buttonContainer: {
      marginTop: 24,
      borderRadius: 16,
    },
    privacyLabel: {
      marginBottom: 8,
      fontSize: 13,
      fontWeight: "700",
      color: Colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,

    },
  });
