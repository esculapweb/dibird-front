import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import api, { getAccessToken } from "../services/api";
import { Put } from "../util/requests";
import i18n from "../services/i18n";

const EMPTY_PROFILE = {
  user_data: {
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    is_active: true,
  },
  avatar: "",
  avatar_thumbnail: "",
  private: false,
  private_diary: false,
  user: null,
  territory: null,
  registration_ip: "",
  timezone: "",
};

const ProfileContext = createContext({
  profile: EMPTY_PROFILE,
  updateProfile: async (updatedData) => {},
  refreshProfile: async () => {},
  isTokenReady: false,
  error: null,
});

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [error, setError] = useState(null);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const url = "/myapi/profile/me/";

  const loadProfile = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("profile");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return;

      setProfile({
        ...EMPTY_PROFILE,
        ...parsed,
      });
    } catch (e) {
      console.warn("Failed to load profile from storage", e);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const init = async () => {
      const token = await getAccessToken();
      if (token) setIsTokenReady(true);
    };
    init();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!isTokenReady) return;
    try {
      setError(null);
      const { data } = await api.get(url);
      await saveProfile(data);
    } catch (e) {
      setError(e);
      console.warn("Failed to refresh profile:", e.code, e.message);
    }
  }, [isTokenReady]);

  useEffect(() => {
    if (!isTokenReady) return;
    refreshProfile();
  }, [isTokenReady, refreshProfile]);

  const saveProfile = async (data) => {
    const safeProfile = {
      ...EMPTY_PROFILE,
      ...data,
    };
    setProfile(safeProfile);
    await AsyncStorage.setItem("profile", JSON.stringify(safeProfile));
  };

  const updateProfile = useCallback(async (updatedData) => {
    const response = await Put(url, updatedData, i18n.t("profile_updated"));
    if (!response) return;
    await saveProfile(response.data);
  }, []);

  return (
    <ProfileContext.Provider
      value={{ profile, updateProfile, refreshProfile, isTokenReady, error }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
