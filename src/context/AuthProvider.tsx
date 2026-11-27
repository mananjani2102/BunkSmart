import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Session, type User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  AppError,
  assertNoError,
  getFriendlyErrorMessage,
  unwrapData,
  unwrapMaybeData,
} from '@/lib/errors';
import { cancelAllClassReminders } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { type Profile } from '@/types/db';

const PROFILE_COLUMNS =
  'id, full_name, default_target, baseline_attended, baseline_held, baseline_date, created_at, updated_at';

export interface SignInResult {
  error: string | null;
}

export interface SignUpResult {
  error: string | null;
  needsEmailConfirmation: boolean;
}

export interface ProfilePatch {
  full_name?: string;
  default_target?: number;
  baseline_attended?: number;
  baseline_held?: number;
  baseline_date?: string | null;
}

export interface AuthStateValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

export interface AuthActionsValue {
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<Profile>;
  refreshProfile: () => Promise<Profile | null>;
}

const AuthStateContext = createContext<AuthStateValue | null>(null);
const AuthActionsContext = createContext<AuthActionsValue | null>(null);

function getMetadataFullName(user: User | null): string {
  const raw = user?.user_metadata?.full_name;
  return typeof raw === 'string' ? raw.trim().slice(0, 80) : '';
}

async function fetchOrCreateProfile(
  userId: string,
  fallbackFullName: string
): Promise<Profile> {
  const existing = unwrapMaybeData(
    await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle<Profile>()
  );

  if (existing) {
    return existing;
  }

  const insertResult = await supabase.from('profiles').insert({
    id: userId,
    full_name: fallbackFullName,
  });

  if (insertResult.error && insertResult.error.code !== '23505') {
    assertNoError(insertResult);
  }

  return unwrapData(
    await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single<Profile>()
  );
}

const SESSION_INIT_TIMEOUT_MS = 8000;

class SessionTimeoutError extends Error {
  constructor() {
    super('Session initialization timed out.');
  }
}

/**
 * Provides split auth state and stable auth action contexts.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const metadataFullName = getMetadataFullName(user);

  const userIdRef = useRef<string | null>(userId);
  const metadataFullNameRef = useRef<string>(metadataFullName);

  useEffect(() => {
    userIdRef.current = userId;
    metadataFullNameRef.current = metadataFullName;
  }, [userId, metadataFullName]);

  useEffect(() => {
    let cancelled = false;

    const initializeSession = async () => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const sessionPromise = supabase.auth.getSession();
        void sessionPromise.catch(() => undefined);

        const { data, error } = await Promise.race([
          sessionPromise,
          new Promise<never>((_resolve, reject) => {
            timeoutId = setTimeout(() => {
              reject(new SessionTimeoutError());
            }, SESSION_INIT_TIMEOUT_MS);
          }),
        ]);
        if (error) {
          await supabase.auth.signOut({ scope: 'local' });
          if (!cancelled) {
            setSession(null);
            setProfile(null);
          }
        } else if (!cancelled) {
          setSession(data.session ?? null);
        }
      } catch (err) {
        if (!(err instanceof SessionTimeoutError)) {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // Best-effort clear of corrupted session.
          }
        }
        if (!cancelled) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) {
        return;
      }
      setSession(nextSession ?? null);
      if (!nextSession?.user) {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      const cacheKey = `bunksmart:profile:${userId}`;
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && !cancelled) {
          setProfile(JSON.parse(cached) as Profile);
        }
      } catch {
        // Cache read is non-fatal
      }

      try {
        const loaded = await fetchOrCreateProfile(userId, metadataFullName);
        if (!cancelled) {
          setProfile(loaded);
          void AsyncStorage.setItem(cacheKey, JSON.stringify(loaded));
        }
      } catch {
        // Leave profile as cached or null; callers can retry with refreshProfile.
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [userId, metadataFullName]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          return { error: getFriendlyErrorMessage(error) };
        }
        return { error: null };
      } catch (err) {
        return { error: getFriendlyErrorMessage(err) };
      }
    },
    []
  );

  const signUp = useCallback(
    async (
      fullName: string,
      email: string,
      password: string
    ): Promise<SignUpResult> => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim().slice(0, 80),
            },
          },
        });
        if (error) {
          return {
            error: getFriendlyErrorMessage(error),
            needsEmailConfirmation: false,
          };
        }
        return {
          error: null,
          needsEmailConfirmation: !data.session,
        };
      } catch (err) {
        return {
          error: getFriendlyErrorMessage(err),
          needsEmailConfirmation: false,
        };
      }
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      const [, authResult] = await Promise.allSettled([
        cancelAllClassReminders(),
        supabase.auth.signOut(),
      ]);

      if (
        authResult.status === 'rejected' ||
        (authResult.status === 'fulfilled' && authResult.value.error)
      ) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Local auth state is still cleared in finally.
      }
    } finally {
      setProfile(null);
      setSession(null);
    }
  }, []);

  const updateProfile = useCallback(
    async (patch: ProfilePatch): Promise<Profile> => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) {
        throw new AppError('Log in to update your profile.');
      }

      const payload: ProfilePatch = {};
      if (patch.full_name !== undefined) {
        payload.full_name = patch.full_name.trim().slice(0, 80);
      }
      if (patch.default_target !== undefined) {
        payload.default_target = patch.default_target;
      }
      if (patch.baseline_attended !== undefined) {
        payload.baseline_attended = patch.baseline_attended;
      }
      if (patch.baseline_held !== undefined) {
        payload.baseline_held = patch.baseline_held;
      }
      if (patch.baseline_date !== undefined) {
        payload.baseline_date = patch.baseline_date;
      }

      const updated = unwrapData(
        await supabase
          .from('profiles')
          .update(payload)
          .eq('id', currentUserId)
          .select(PROFILE_COLUMNS)
          .single<Profile>()
      );

      if (userIdRef.current === currentUserId) {
        setProfile(updated);
        void AsyncStorage.setItem(
          `bunksmart:profile:${currentUserId}`,
          JSON.stringify(updated)
        );
      }
      return updated;
    },
    []
  );

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) {
      setProfile(null);
      return null;
    }

    const loaded = await fetchOrCreateProfile(
      currentUserId,
      metadataFullNameRef.current
    );
    if (userIdRef.current === currentUserId) {
      setProfile(loaded);
    }
    return loaded;
  }, []);

  const activeProfile =
    userId && profile && profile.id === userId ? profile : null;

  const stateValue = useMemo<AuthStateValue>(
    () => ({
      session,
      user,
      profile: activeProfile,
      loading,
    }),
    [session, user, activeProfile, loading]
  );

  const actionsValue = useMemo<AuthActionsValue>(
    () => ({
      signIn,
      signUp,
      signOut,
      updateProfile,
      refreshProfile,
    }),
    [signIn, signUp, signOut, updateProfile, refreshProfile]
  );

  return (
    <AuthActionsContext.Provider value={actionsValue}>
      <AuthStateContext.Provider value={stateValue}>
        {children}
      </AuthStateContext.Provider>
    </AuthActionsContext.Provider>
  );
}

/**
 * Returns the reactive authentication and profile state.
 */
export function useAuthState(): AuthStateValue {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState must be used within an AuthProvider.');
  }
  return context;
}

/**
 * Returns stable authentication action functions whose identities never change.
 */
export function useAuthActions(): AuthActionsValue {
  const context = useContext(AuthActionsContext);
  if (!context) {
    throw new Error('useAuthActions must be used within an AuthProvider.');
  }
  return context;
}
