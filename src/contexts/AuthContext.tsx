import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase, User } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔍 Getting initial session...');
        
        // Add timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session request timeout')), 10000)
        );
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        if (!mounted) return;
        
        if (error) {
          console.error('❌ Error getting session:', error);
          console.error('🔧 Check your Supabase configuration and network connection');
          setLoading(false);
          setInitialized(true);
          return;
        }

        console.log('📱 Initial session:', session ? `Found (${session.user.id})` : 'None');
        setSession(session);
        
        if (session?.user) {
          console.log('👤 User found in session:', session.user.id);
          await fetchUserProfile(session.user.id);
        } else {
          setLoading(false);
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('❌ Error in getInitialSession:', error);
        
        // Provide more specific error information
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          console.error('🌐 Network Error: Cannot connect to Supabase');
          console.error('🔧 Troubleshooting steps:');
          console.error('   1. Check your internet connection');
          console.error('   2. Verify VITE_SUPABASE_URL in .env file');
          console.error('   3. Ensure Supabase project is active');
          console.error('   4. Check for firewall/VPN blocking the connection');
        }
        
        setLoading(false);
        setInitialized(true);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || !initialized) return;

      console.log('🔄 Auth state changed:', event, session?.user?.id);
      
      // Prevent duplicate processing
      if (event === 'SIGNED_IN' && session?.user) {
        // Only process if this is a different user or we don't have a user yet
        if (!user || user.id !== session.user.id) {
          console.log('👤 Processing new user authentication...');
          setSession(session);
          setLoading(true);
          await fetchUserProfile(session.user.id);
        } else {
          console.log('👤 Same user already authenticated, skipping...');
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('👤 User signed out');
        setSession(null);
        setUser(null);
        setLoading(false);
      } else {
        setSession(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [initialized, user?.id]);

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('🔍 Fetching user profile for:', userId);
      
      // Add timeout to prevent hanging
      const profilePromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      );
      
      const { data, error } = await Promise.race([
        profilePromise,
        timeoutPromise
      ]) as any;

      console.log('📊 User profile query result:', { data, error });

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        
        // Provide more specific error information
        if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
          console.error('🌐 Network Error: Cannot connect to Supabase database');
          console.error('🔧 This usually means:');
          console.error('   - Supabase project is paused or inactive');
          console.error('   - Network connectivity issues');
          console.error('   - Incorrect Supabase URL or API key');
        }
        
        setLoading(false);
        return;
      }

      if (data) {
        console.log('✅ User profile found:', data.email);
        setUser(data);
        setLoading(false);
      } else {
        console.log('🆕 User profile not found, creating...');
        
        // Get auth user data with timeout
        const authUserPromise = supabase.auth.getUser();
        const authTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth user fetch timeout')), 10000)
        );
        
        const { data: authUser } = await Promise.race([
          authUserPromise,
          authTimeoutPromise
        ]) as any;
        
        if (!authUser.user) {
          console.log('❌ No auth user found');
          setLoading(false);
          return;
        }

        console.log('✅ Auth user found:', authUser.user.email);
        
        // Create user profile using auth user data
        const newUserData = {
          id: authUser.user.id,
          email: authUser.user.email!,
          full_name: authUser.user.user_metadata?.full_name || null,
          subscription_status: 'free' as const,
          email_verified: true,
        };

        console.log('📝 Creating user with data:', newUserData);

        const createUserPromise = supabase
          .from('users')
          .insert([newUserData])
          .select()
          .single();
          
        const createTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('User creation timeout')), 10000)
        );

        const { data: newUser, error: createError } = await Promise.race([
          createUserPromise,
          createTimeoutPromise
        ]) as any;

        if (createError) {
          console.error('❌ Error creating user profile:', createError);
          setLoading(false);
        } else {
          console.log('✅ User profile created:', newUser.email);
          setUser(newUser);
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('❌ Error in fetchUserProfile:', error);
      
      // Provide more specific error information
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('🌐 Network Error: Cannot connect to Supabase');
        console.error('🔧 Please check your network connection and Supabase configuration');
      } else if (error.message?.includes('timeout')) {
        console.error('⏱️ Request Timeout: Supabase is taking too long to respond');
        console.error('🔧 This might indicate network issues or Supabase server problems');
      }
      
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      console.log('🚀 Starting signup process...');
      console.log('📧 Email:', email);
      console.log('👤 Full name:', fullName);
      
      const signupPromise = supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Signup timeout')), 15000)
      );
      
      const { data, error } = await Promise.race([
        signupPromise,
        timeoutPromise
      ]) as any;

      console.log('📊 Signup result:', { data, error });

      if (error) {
        console.error('❌ Signup error:', error);
        return { error };
      }

      console.log('✅ Signup successful');
      // User profile will be created automatically when auth state changes
      return { error: null };
    } catch (error) {
      console.error('❌ Signup exception:', error);
      
      if (error.message?.includes('timeout')) {
        return { error: { message: 'Request timeout. Please check your connection and try again.' } };
      }
      
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🚀 Starting signin process...');
      console.log('📧 Email:', email);
      
      const signinPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Signin timeout')), 15000)
      );
      
      const { data, error } = await Promise.race([
        signinPromise,
        timeoutPromise
      ]) as any;

      console.log('📊 Signin result:', { data, error });

      if (error) {
        console.error('❌ Signin error:', error);
        return { error };
      }

      console.log('✅ Signin successful, user:', data.user?.id);
      // User profile will be fetched automatically when auth state changes
      return { error: null };
    } catch (error) {
      console.error('❌ Signin exception:', error);
      
      if (error.message?.includes('timeout')) {
        return { error: { message: 'Request timeout. Please check your connection and try again.' } };
      }
      
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚀 Starting signout process...');
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setLoading(false);
      console.log('✅ Signout successful');
    } catch (error) {
      console.error('❌ Error signing out:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('🚀 Starting password reset for:', email);
      
      const resetPromise = supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Password reset timeout')), 15000)
      );
      
      const { error } = await Promise.race([
        resetPromise,
        timeoutPromise
      ]) as any;
      
      console.log('📊 Password reset result:', { error });
      return { error };
    } catch (error) {
      console.error('❌ Password reset exception:', error);
      
      if (error.message?.includes('timeout')) {
        return { error: { message: 'Request timeout. Please check your connection and try again.' } };
      }
      
      return { error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};