import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import StatsTabs from "../navigation/StatsTabs";
import { fetchSeen } from "../util/fetches";
import { useLanguage } from "../store/language-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";

const StatScreen = () => {
  const [seen, setSeen] = useState([]);
  const [notSeen, setNotSeen] = useState([]);
  const { language } = useLanguage();
  const { t } = useTranslation();

  useEffect(() => {
    const loadData = async () => {
      try {
        const { seenList, notSeenList } = await fetchSeen();
        setSeen(seenList);
        setNotSeen(notSeenList);
      } catch (e) {
        console.warn(t('failed_to_load_data'), e.code, e.message);
      }
    };
    loadData();
  }, [language]);

  if (!seen.length && !notSeen.length) return <LoadingOverlay />;

  return <StatsTabs seen={seen} notSeen={notSeen} />;
};

export default StatScreen;
