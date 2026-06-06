import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAnalytics, setUserId } from "@react-native-firebase/analytics";

import { initGlobalFilters } from "../util/storageHelper";
import { AppError, Profile } from "../types";
import { fetchMyProfile, updateMyProfile } from "../util/fetches";
import { logError } from "../services/errors";

interface ProfileContextType {
  profile: Profile | null;
  profileLoading: boolean;
  updateProfile: (updatedData: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  isTokenReady: boolean;
  error: AppError | null;
}

type ProfileCallback = (territory: number | null) => void;

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

  const lastRefreshRef = useRef<number>(0);

  const refreshProfile = useCallback(async () => {
    lastRefreshRef.current = Date.now();
    try {
      setProfileLoading(true);
      setError(null);
      const data = await fetchMyProfile();
      await saveProfile(data);
    } catch (e) {
      const err = e as AppError;
      setError(err);
      logError(err, "Failed to refresh profile");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const saveProfile = async (data: Partial<Profile>) => {
    const safeProfile = { ...EMPTY_PROFILE, ...data };
    setProfile(safeProfile);
    await AsyncStorage.setItem("profile", JSON.stringify(safeProfile));
    await initGlobalFilters(safeProfile.territory ?? null);
    onProfileSavedCallbacks.forEach((cb) => cb(safeProfile.territory ?? null));

    if (safeProfile.user) {
      await setUserId(getAnalytics(), safeProfile.user.toString());
    }
  };

  const updateProfile = useCallback(async (updatedData: Partial<Profile>) => {
    const data = await updateMyProfile(updatedData);
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

  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let prevState = AppState.currentState;

    const sub = AppState.addEventListener("change", (state) => {
      const wasBackground =
        prevState === "background" || prevState === "inactive";
      prevState = state;

      if (state === "active" && wasBackground && isAuthenticatedRef.current) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          const secsSinceRefresh = (Date.now() - lastRefreshRef.current) / 1000;
          if (secsSinceRefresh > 10) {
            refreshProfile();
          }
        }, 500);
      }
    });

    return () => {
      sub.remove();
      if (timeout) clearTimeout(timeout);
    };
  }, [refreshProfile]);

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
