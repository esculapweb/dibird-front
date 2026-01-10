import { useState, useEffect } from "react";
import { Text } from "react-native";

import StatsTabs from "../navigation/StatsTabs";
import { fetchSeen } from "../util/fetches";

const StatScreen = () => {
  const [seen, setSeen] = useState([]);
  const [notSeen, setNotSeen] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { seenList, notSeenList } = await fetchSeen();
        setSeen(seenList);
        setNotSeen(notSeenList);
      } catch (e) {
        console.warn("Failed to load data", e);
      }
    };
    loadData();
  }, []);

  if (!seen.length && !notSeen.length) return <Text>Loading...</Text>;

  return <StatsTabs seen={seen} notSeen={notSeen} />;
};

export default StatScreen;
