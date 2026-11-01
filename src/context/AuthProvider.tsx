import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Session, type User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

const PROFILE_COLUMNS = 'id, full_name, default_target, created_at, updated_at';

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
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
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

const AuthContext = createContext<AuthContextValue | null>(null);

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const metadataFullName = getMetadataFullName(user);

  useEffect(() => {
    let cancelled = false;

    const initializeSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          await supabase.auth.signOut({ scope: 'local' });
          if (!cancelled) {
            setSession(null);
            setProfile(null);
          }
        } else if (!cancelled) {
          setSession(data.session ?? null);
        }
      } catch {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          // Ignore secondary cleanup error when clearing invalid local session.
        }
        if (!cancelled) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
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
      await cancelAllClassReminders();
    } catch {
      // Continue signing out even if local reminder cleanup fails.
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
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
      if (!userId) {
        throw new AppError('Log in to update your profile.');
      }

      const payload: ProfilePatch = {};
      if (patch.full_name !== undefined) {
        payload.full_name = patch.full_name.trim().slice(0, 80);
      }
      if (patch.default_target !== undefined) {
        payload.default_target = patch.default_target;
      }

      const updated = unwrapData(
        await supabase
          .from('profiles')
          .update(payload)
          .eq('id', userId)
          .select(PROFILE_COLUMNS)
          .single<Profile>()
      );

      setProfile(updated);
      void AsyncStorage.setItem(`bunksmart:profile:${userId}`, JSON.stringify(updated));
      return updated;
    },
    [userId]
  );

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    if (!userId) {
      setProfile(null);
      return null;
    }

    const loaded = await fetchOrCreateProfile(userId, metadataFullName);
    setProfile(loaded);
    return loaded;
  }, [userId, metadataFullName]);

  const activeProfile =
    userId && profile && profile.id === userId ? profile : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile: activeProfile,
      loading,
      signIn,
      signUp,
      signOut,
      updateProfile,
      refreshProfile,
    }),
    [
      session,
      user,
      activeProfile,
      loading,
      signIn,
      signUp,
      signOut,
      updateProfile,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
