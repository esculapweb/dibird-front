import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import api from "../services/api";
import { Put } from "../util/requests";

const ProfileContext = createContext();

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState({});
  const url = "/myapi/profile/me/";

  const loadProfile = useCallback(async () => {
    const stored = await AsyncStorage.getItem("profile");
    if (stored) setProfile(JSON.parse(stored));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = async (data) => {
    setProfile(data);
    await AsyncStorage.setItem("profile", JSON.stringify(data));
  };

  const updateProfile = useCallback(async (updatedData) => {
    const { data } = await Put(url, updatedData, "Profile updated");
    await saveProfile(data);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await api.get(url);
      await saveProfile(data);
    } catch (err) {
      console.error("Failed to refresh profile:", err);
      throw err;
    }
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
