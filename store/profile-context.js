import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import api, { getAccessToken } from "../services/api";
import { initGlobalTerritory } from "../util/storageHelper";

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
  profile: null,
  updateProfile: async (updatedData) => {},
  refreshProfile: async () => {},
  isTokenReady: false,
  error: null,
});

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const url = "/myapi/profile/me/";

  const loadProfile = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("profile");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") setProfile(parsed);
      }
    } catch (e) {
      console.warn("Failed to load profile from storage", e);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) return;

      const { data } = await api.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await saveProfile(data);
    } catch (e) {
      setError(e);
      console.warn("Failed to refresh profile:", e.code, e.message);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const saveProfile = async (data) => {
    const safeProfile = {
      ...EMPTY_PROFILE,
      ...data,
    };
    setProfile(safeProfile);
    await AsyncStorage.setItem("profile", JSON.stringify(safeProfile));
    await initGlobalTerritory(safeProfile.territory);
  };

  const updateProfile = useCallback(async (updatedData) => {
    const { data } = await api.put(url, updatedData);
    return await saveProfile(data);
  }, []);

  const resetProfile = useCallback(() => {
    setProfile(null);
    setError(null);
    setIsTokenReady(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const init = async () => {
      const token = await getAccessToken();
      setIsTokenReady(!!token);
      // if (token) {
      //   setIsTokenReady(true);
      // } else {
      //   setProfileLoading(false);
      // }
    };
    init();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && isTokenReady) {
        refreshProfile();
      }
    });

    return () => sub.remove();
  }, [isTokenReady]);

  useEffect(() => {
    if (isTokenReady) {
      refreshProfile();
    }
  }, [isTokenReady, refreshProfile]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profileLoading,
        updateProfile,
        refreshProfile,
        resetProfile,
        isTokenReady,
        error,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
