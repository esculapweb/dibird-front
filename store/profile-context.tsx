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
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getAnalytics, setUserId } from "@react-native-firebase/analytics";

import { db } from "../services/db/client";
import { queryClient } from "../services/queryClient";
import { clearPersistedQueryCache } from "../services/queryPersist";
import { mutationQueueTable, profileTable } from "../services/db/schema";
import * as profileRepository from "../hooks/repositories/profileRepository";
import * as observationRepository from "../hooks/repositories/observationRepository";
import * as diaryRepository from "../hooks/repositories/diaryRepository";
import * as placeRepository from "../hooks/repositories/placeRepository";
import * as profileSync from "../services/sync/profileSync";
import * as avatarSync from "../services/sync/avatarSync";
import { subscribeToReconnect } from "../services/sync/networkStatus";
import {
  initGlobalFilters,
  getLastLoggedInUserId,
  setLastLoggedInUserId,
} from "../util/storageHelper";
import { AppError, Profile, ProfileFormData } from "../types";
import { logError } from "../services/errors";

export interface FailedProfileEdit {
  message: string | null;
  createdAt: number;
}

interface ProfileContextType {
  profile: Profile | null;
  profileLoading: boolean;
  updateProfile: (updatedData: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  isTokenReady: boolean;
  error: AppError | null;
  failedEdit: FailedProfileEdit | null;
  retryFailedEdit: () => Promise<void>;
  discardFailedEdit: () => void;
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

const ProfileContext = createContext<ProfileContextType | null>(null);
export const ProfileProvider = ({
  children,
  isAuthenticated,
  isInitializing,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
  isInitializing: boolean;
}) => {
  const [error, setError] = useState<AppError | null>(null);
  const [initialLoadAttempted, setInitialLoadAttempted] = useState(false);

  const { data: rows, updatedAt } = useLiveQuery(
    db.select().from(profileTable).limit(1),
  );
  const profileRow = rows[0] ?? null;
  const profile = profileRow ? profileRepository.rowToProfile(profileRow) : null;
  const profileLoading = isAuthenticated && !profile && !initialLoadAttempted;

  const { data: failedMutations } = useLiveQuery(
    db
      .select()
      .from(mutationQueueTable)
      .where(
        and(
          inArray(mutationQueueTable.entity, ["profile", "avatar"]),
          eq(mutationQueueTable.status, "error"),
        ),
      )
      .orderBy(asc(mutationQueueTable.createdAt)),
  );
  const failedMutation = failedMutations[0] ?? null;
  const failedEdit: FailedProfileEdit | null = failedMutation
    ? { message: failedMutation.lastError, createdAt: failedMutation.createdAt }
    : null;

  const lastRefreshRef = useRef<number>(0);

  const refreshProfile = useCallback(async () => {
    lastRefreshRef.current = Date.now();
    try {
      setError(null);
      await profileSync.runProfileSync();
      await avatarSync.runAvatarSync();
    } catch (e) {
      const err = e as AppError;
      setError(err);
      logError(err, "Failed to refresh profile");
    } finally {
      setInitialLoadAttempted(true);
    }
  }, []);

  const updateProfile = useCallback(async (updatedData: Partial<Profile>) => {
    profileRepository.applyLocalPatch(
      updatedData as unknown as Partial<ProfileFormData>,
    );
    await profileSync.runProfileSync();
  }, []);

  const retryFailedEdit = useCallback(async () => {
    if (!failedMutation) return;
    profileRepository.retryMutation(failedMutation.id);
    await profileSync.runProfileSync();
    await avatarSync.runAvatarSync();
  }, [failedMutation]);

  const discardFailedEdit = useCallback(() => {
    if (!failedMutation) return;
    profileRepository.discardMutation(failedMutation.id);
  }, [failedMutation]);

  useEffect(() => {
    if (isInitializing) return;

    if (!isAuthenticated) {
      profileRepository.clearProfile();
      setError(null);
      setInitialLoadAttempted(false);
      setUserId(getAnalytics(), null);
      return;
    }
    setInitialLoadAttempted(false);
    refreshProfile();
  }, [isAuthenticated, isInitializing]);

  useEffect(() => {
    if (!profile) return;

    (async () => {
      // A different account logging in on the same device shouldn't inherit
      // whatever offline observation/diary/place data (synced mirrors *and*
      // still-unsynced edits) the previous session left behind — but an
      // ordinary re-login of the *same* user (e.g. after a 401-triggered
      // logout) must keep it, since that's exactly the data a forced logout
      // shouldn't lose. lastLoggedInUserId deliberately survives Logout()'s
      // AsyncStorage wipe (see util/storageHelper.ts) so this comparison
      // still works right after a logout, not just across app restarts.
      if (profile.user) {
        const lastUserId = await getLastLoggedInUserId();
        if (lastUserId !== null && lastUserId !== profile.user) {
          observationRepository.clearAllLocal();
          diaryRepository.clearAllLocal();
          placeRepository.clearAllLocal();
          // Same reasoning as the local repositories above, but for the
          // React Query cache (in-memory and its AsyncStorage persistence,
          // see services/queryPersist.ts) — territory/species/stat data
          // cached under the previous account must not leak into this one.
          queryClient.clear();
          await clearPersistedQueryCache();
        }
        await setLastLoggedInUserId(profile.user);
      }

      await initGlobalFilters(profile.territory ?? null);
      onProfileSavedCallbacks.forEach((cb) => cb(profile.territory ?? null));

      if (profile.user) {
        await setUserId(getAnalytics(), profile.user.toString());
      }
    })();
  }, [updatedAt]);

  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribeReconnect = subscribeToReconnect(() => {
      profileSync.runProfileSync();
      avatarSync.runAvatarSync();
    });

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
            profileSync.runProfileSync();
            avatarSync.runAvatarSync();
          }
        }, 500);
      }
    });

    return () => {
      unsubscribeReconnect();
      sub.remove();
      if (timeout) clearTimeout(timeout);
    };
  }, [isAuthenticated]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profileLoading,
        updateProfile,
        refreshProfile,
        isTokenReady: isAuthenticated,
        error,
        failedEdit,
        retryFailedEdit,
        discardFailedEdit,
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
