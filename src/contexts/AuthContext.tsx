import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role: string;
  is_active?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  requiresPasswordChange: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

  const fetchUserProfile = async (authUserId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, auth_user_id, full_name, email, role, is_active')
        .eq('auth_user_id', authUserId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception fetching user profile:', err);
      return null;
    }
  };

  const checkPasswordChangeRequired = async (authUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('requires_password_change')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) {
        console.error('Error checking password change requirement:', error);
        return false;
      }

      return data?.requires_password_change ?? false;
    } catch (err) {
      console.error('Error checking password change requirement:', err);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        console.error('Auth session error:', error.message);
        setUser(null);
        setProfile(null);
        setRequiresPasswordChange(false);
      } else {
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          const [userProfile, needsChange] = await Promise.all([
            fetchUserProfile(currentUser.id),
            checkPasswordChangeRequired(currentUser.id)
          ]);
          
          // Check if user is active
          if (userProfile && userProfile.is_active === false) {
            // User is inactive, sign them out
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setRequiresPasswordChange(false);
          } else {
            setProfile(userProfile);
            setRequiresPasswordChange(needsChange);
          }
        } else {
          setProfile(null);
          setRequiresPasswordChange(false);
        }
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          const [userProfile, needsChange] = await Promise.all([
            fetchUserProfile(currentUser.id),
            checkPasswordChangeRequired(currentUser.id)
          ]);
          
          // Check if user is active
          if (userProfile && userProfile.is_active === false) {
            // User is inactive, sign them out
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setRequiresPasswordChange(false);
          } else {
            setProfile(userProfile);
            setRequiresPasswordChange(needsChange);
          }
        } else {
          setProfile(null);
          setRequiresPasswordChange(false);
        }
        setLoading(false);
      })();
    });

    void init();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    const currentUser = data.user ?? null;
    setUser(currentUser);
    if (currentUser) {
      const [userProfile, needsChange] = await Promise.all([
        fetchUserProfile(currentUser.id),
        checkPasswordChangeRequired(currentUser.id)
      ]);
      
      // Check if user is active
      if (userProfile && userProfile.is_active === false) {
        // User is inactive, sign them out immediately
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setRequiresPasswordChange(false);
        return { error: 'Your account has been deactivated. Please contact your administrator.' };
      }
      
      setProfile(userProfile);
      setRequiresPasswordChange(needsChange);
    }
    return {};
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error.message);
    }
    setUser(null);
    setProfile(null);
    setRequiresPasswordChange(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, requiresPasswordChange, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
