import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAnalytics, setUserId } from "@react-native-firebase/analytics";

import api from "../services/api";
import { initGlobalFilters } from "../util/storageHelper";
import { AppError } from "../types";

interface UserData {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
}

interface Profile {
  user_data: UserData;
  avatar: string;
  avatar_thumbnail: string;
  private: boolean;
  private_diary: boolean;
  user: number | null;
  registration_ip: string;
  timezone: string;
  territory?: string | null;
}

interface ProfileContextType {
  profile: Profile | null;
  profileLoading: boolean;
  updateProfile: (updatedData: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  isTokenReady: boolean;
  error: AppError | null;
}

type ProfileCallback = (territory: string | null) => void;

let onProfileSavedCallbacks: ProfileCallback[] = [];

export const registerOnProfileSaved = (callback: ProfileCallback) => {
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

const ProfileContext = createContext<ProfileContextType | null>(null);
export const ProfileProvider = ({
  children,
  isAuthenticated,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
}) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const url = "/myapi/profile/me/";

  const refreshProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      setError(null);
      const { data } = await api.get(url);
      await saveProfile(data);
    } catch (e) {
      const err = e as AppError;
      setError(err);
      console.warn("Failed to refresh profile:", err.code, err.message);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const saveProfile = async (data: Partial<Profile>) => {
    const safeProfile = { ...EMPTY_PROFILE, ...data };
    setProfile(safeProfile);
    await AsyncStorage.setItem("profile", JSON.stringify(safeProfile));
    await initGlobalFilters(safeProfile.territory);
    onProfileSavedCallbacks.forEach((cb) => cb(safeProfile.territory ?? null));

    if (safeProfile.user) {
      await setUserId(getAnalytics(), safeProfile.user.toString());
    }
  };

  const updateProfile = useCallback(async (updatedData: Partial<Profile>) => {
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

export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (!context)
    throw new Error("useProfile must be used within ProfileProvider");
  return context;
};
