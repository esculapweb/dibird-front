import { useState, useEffect } from "react";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";

import StatsTabs from "../navigation/StatsTabs";
import { fetchSeen } from "../util/fetches";
import { useLanguage } from "../store/language-context";
import { useProfile } from "../store/profile-context";
const StatScreen = () => {
  const [seen, setSeen] = useState([]);
  const [notSeen, setNotSeen] = useState([]);
  const { language } = useLanguage();
  const { t } = useTranslation();

  const profileCtx = useProfile();

  useEffect(() => {
    const loadData = async () => {
      if (!profileCtx.isTokenReady) return;
      try {
        const { seenList, notSeenList } = await fetchSeen();
        setSeen(seenList);
        setNotSeen(notSeenList);
      } catch (e) {
        console.warn(t('failed_to_load_data'), e);
      }
    };
    loadData();
  }, [language, profileCtx.isTokenReady]);

  if (!seen.length && !notSeen.length) return <Text>{t("loading_")}</Text>;

  return <StatsTabs seen={seen} notSeen={notSeen} />;
};

export default StatScreen;
