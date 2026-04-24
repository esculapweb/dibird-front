import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAnalytics, setUserId } from "@react-native-firebase/analytics";

import api from "../services/api";
import { initGlobalFilters } from "../util/storageHelper";

let onProfileSavedCallbacks = [];
export const registerOnProfileSaved = (callback) => {
  onProfileSavedCallbacks.push(callback);
  return () => {
    onProfileSavedCallbacks = onProfileSavedCallbacks.filter(
      (cb) => cb !== callback,
    );
  };
};

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
  registration_ip: "",
  timezone: "",
};

const ProfileContext = createContext({
  profile: null,
  profileLoading: true,
  updateProfile: async (updatedData) => {},
  refreshProfile: async () => {},
  isTokenReady: false,
  error: null,
  territory: null,
});

export const ProfileProvider = ({ children, isAuthenticated }) => {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const url = "/myapi/profile/me/";

  const refreshProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      setError(null);
      const { data } = await api.get(url);
      await saveProfile(data);
    } catch (e) {
      setError(e);
      console.warn("Failed to refresh profile:", e.code, e.message);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const saveProfile = async (data) => {
    const safeProfile = { ...EMPTY_PROFILE, ...data };
    setProfile(safeProfile);
    await AsyncStorage.setItem("profile", JSON.stringify(safeProfile));
    await initGlobalFilters(safeProfile.territory);
    onProfileSavedCallbacks.forEach((cb) => cb(safeProfile.territory));

    if (safeProfile.user) {
      await setUserId(getAnalytics(), safeProfile.user.toString());
    }
  };

  const updateProfile = useCallback(async (updatedData) => {
    const { data } = await api.put(url, updatedData);
    return await saveProfile(data);
  }, []);

  useEffect(() => {
    const updateAnalytics = async () => {
      if (isAuthenticated) {
        AsyncStorage.removeItem("profile").then(() => {
          refreshProfile();
        });
      } else {
        setProfile(null);
        setError(null);
        setProfileLoading(false);
        AsyncStorage.removeItem("profile");
        await setUserId(getAnalytics(), null);
      }
    };
    updateAnalytics();
  }, [isAuthenticated]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && isAuthenticated) {
        refreshProfile();
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, refreshProfile]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profileLoading,
        updateProfile,
        refreshProfile,
        isTokenReady: isAuthenticated,
        error,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
