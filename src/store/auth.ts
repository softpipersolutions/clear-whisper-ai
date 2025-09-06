import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean; // Keep hardcoded flag for now
  
  // Actions
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  initialize: () => void;
  updateProfile: (metadata: Record<string, any>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  isAdmin: false, // TODO: Replace with RLS + Supabase Auth claims

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        return { error: error.message };
      }
      
      return {};
    } catch (error: any) {
      return { error: error.message || 'Sign in failed' };
    }
  },

  signUp: async (email: string, password: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      
      if (error) {
        return { error: error.message };
      }
      
      return {};
    } catch (error: any) {
      return { error: error.message || 'Sign up failed' };
    }
  },

  signInWithGoogle: async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      
      if (error) {
        return { error: error.message };
      }
      
      return {};
    } catch (error: any) {
      return { error: error.message || 'Google sign in failed' };
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  },

  initialize: () => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        set({ 
          session, 
          user: session?.user ?? null,
          loading: false,
          // Hardcode admin for specific email (TODO: replace with RLS)
          isAdmin: session?.user?.email === 'admin@clearchat.ai'
        });
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ 
        session, 
        user: session?.user ?? null,
        loading: false,
        // Hardcode admin for specific email (TODO: replace with RLS)
        isAdmin: session?.user?.email === 'admin@clearchat.ai'
      });
    });

    // Return cleanup function
    return () => subscription.unsubscribe();
  },

  updateProfile: (metadata: Record<string, any>) => {
    const { user } = get();
    if (user) {
      set({
        user: {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            ...metadata
          }
        }
      });
    }
  },
}));