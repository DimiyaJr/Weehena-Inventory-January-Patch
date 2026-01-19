import { useState, useEffect, useRef } from 'react'
import { supabase, supabaseInitError } from '../lib/supabase'
// ADD this import at top
import { detectDeviceType, DeviceType } from '../utils/deviceDetection';

// Add these new interfaces at the top with AuthUser
export interface PasswordResetData {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  userId: string;
  message?: string;
}

export interface AuthUser {
  id: string
  username: string
  role: string
  first_login: boolean
  is_temporary_password?: boolean // NEW FIELD
  email?: string // ✅ Made optional
  title: 'Mr' | 'Mrs' | 'Ms' | 'Dr' // ✅ New
  first_name: string // ✅ New
  last_name: string // ✅ New
  employee_id?: string // ✅ New
  phone_number: string // ✅ New
  deviceType?: DeviceType; // ADD THIS LINE
}

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine) // Track online status
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const initRef = useRef(false)

  // Helper function to ensure role is always a string
  const normalizeRole = (role: any): string => {
    console.log('normalizeRole received:', role, 'type:', typeof role)
    if (typeof role === 'string') return role
    if (typeof role === 'object' && role?.name) return role.name
    if (typeof role === 'object' && role?.role) return role.role
    return 'Sales Rep' // Default fallback
  }

  // Create user from session data (fallback approach)
  const createUserFromSession = (session: any): AuthUser => {
    console.log('createUserFromSession - Raw user_metadata:', session.user.user_metadata)
    console.log('Raw user_metadata role:', session.user.user_metadata?.role)
    console.log('Normalized role:', normalizeRole(session.user.user_metadata?.role))
    
    return {
      id: session.user.id,
      username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
      role: normalizeRole(session.user.user_metadata?.role) || 'Sales Rep',
      first_login: session.user.user_metadata?.first_login !== undefined ? session.user.user_metadata.first_login : true,
      is_temporary_password: session.user.user_metadata?.is_temporary_password !== undefined ? session.user.user_metadata.is_temporary_password : false, // NEW
      email: session.user.email || undefined,
      title: session.user.user_metadata?.title || 'Mr', // ✅ Default or handle as needed
      first_name: session.user.user_metadata?.first_name || 'First Name', // ✅ Default or handle as needed
      last_name: session.user.user_metadata?.last_name || 'Last Name', // ✅ Default or handle as needed
      employee_id: session.user.user_metadata?.employee_id || undefined,
      phone_number: session.user.phone || session.user.user_metadata?.phone_number || 'N/A', // ✅ Use session.user.phone if available
      deviceType: detectDeviceType(), // ADD THIS LINE
    }
  }

  useEffect(() => {
    // Check for supabase initialization error first
    if (supabaseInitError) {
      console.error('useAuth: Supabase initialization error detected:', supabaseInitError)
      setConnectionError(supabaseInitError)
      setLoading(false)
      return
    }

    // Prevent multiple initializations
    if (initRef.current) return
    initRef.current = true

    console.log('useAuth: Initializing authentication...')
    
    let mounted = true
    let authSubscription: any = null

    // Immediate timeout to prevent hanging
    const immediateTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.log('useAuth: Force clearing loading state after 2 seconds')
        setLoading(false)
      }
    }, 2000)

    const processUser = async (session: any) => {
      if (!mounted) return

      if (session?.user) {
        console.log('useAuth: Processing user session')
        const sessionUser = createUserFromSession(session)
        console.log('Created session user with role:', sessionUser.role)
        setUser(sessionUser)
        setConnectionError(null)
        setLoading(false)

        // Background database enhancement (non-blocking)
        setTimeout(async () => {
          if (!mounted) return
          // NEW: Defensive check for supabase client
          if (!supabase) {
            console.error('useAuth: Supabase client is null in background query. Cannot fetch user details.');
            // This scenario should ideally be caught by supabaseInitError, but this adds robustness.
            return;
          }
          try {
            const { data } = await supabase
              .from('users')
              .select('username, role, first_login, email, title, first_name, last_name, employee_id, phone_number, is_temporary_password') // ADDED is_temporary_password
              .eq('id', session.user.id)
              .maybeSingle()

            if (mounted && data) {
              console.log('Background DB query found user with role:', data.role)
              setUser(prev => prev ? {
                ...prev,
                username: data.username || prev.username,
                role: normalizeRole(data.role) || prev.role,
                first_login: data.first_login !== undefined ? data.first_login : prev.first_login,
                is_temporary_password: data.is_temporary_password !== undefined ? data.is_temporary_password : prev.is_temporary_password, // NEW
                email: data.email || prev.email,
                title: data.title || prev.title,
                first_name: data.first_name || prev.first_name,
                last_name: data.last_name || prev.last_name,
                employee_id: data.employee_id || prev.employee_id,
                phone_number: data.phone_number || prev.phone_number,
              } : null)
            }
          } catch (error) {
            console.warn('useAuth: Background DB query failed (non-critical):', error)
          }
        }, 100)
      } else {
        console.log('useAuth: No session found')
        setUser(null)
        setConnectionError(null)
        setLoading(false)
      }
    }

    const initAuth = async () => {
      try {
        console.log('useAuth: Setting up auth listener...')
        
        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('useAuth: Auth state changed:', event)
          clearTimeout(immediateTimeout)
          await processUser(session)
        })
        authSubscription = subscription

        // Quick initial session check (no timeout, just let it resolve naturally)
        console.log('useAuth: Checking initial session...')
        
        // Use a simple approach - just get the session without complex timeout logic
        supabase.auth.getSession()
          .then(({ data: { session }, error }) => {
            if (!mounted) return
            
            if (error) {
              console.warn('useAuth: Initial session check error:', error.message)
             // Clear any stale session data if there's an authentication error
             supabase.auth.signOut().catch(() => {
               // Ignore signOut errors as we're already in an error state
             })
              setUser(null)
              setLoading(false)
              return
            }
            
           // If no session exists, ensure we clear any stale data
           if (!session) {
             supabase.auth.signOut().catch(() => {
               // Ignore signOut errors as this is just cleanup
             })
           }
           
            console.log('useAuth: Initial session result:', !!session)
            clearTimeout(immediateTimeout)
            processUser(session)
          })
          .catch((error) => {
            console.warn('useAuth: Session check failed:', error.message)
            if (mounted) {
             // Clear any stale session data on session check failure
             supabase.auth.signOut().catch(() => {
               // Ignore signOut errors as we're already in an error state
             })
              clearTimeout(immediateTimeout)
              setUser(null)
              setLoading(false)
            }
          })

      } catch (error: any) {
        console.error('useAuth: Setup failed:', error)
        if (mounted) {
          clearTimeout(immediateTimeout)
          setUser(null)
          setLoading(false)
        }
      }
    }

    // Network status listeners
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    initAuth()

    return () => {
      console.log('useAuth: Cleanup')
      mounted = false
      initRef.current = false
      clearTimeout(immediateTimeout)
      
      // Cleanup network listeners
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      
      if (authSubscription) {
        // Ensure unsubscribe is called correctly
        // Supabase client's onAuthStateChange returns an object with an unsubscribe method
        // if (typeof authSubscription.unsubscribe === 'function') {
        authSubscription.unsubscribe()
        // }
      }
    }
  }, [])

  const login = async (credential: string, password: string) => {
    try {
      setConnectionError(null)
      console.log('useAuth: Attempting login with username:', credential)

      const username = credential.trim();

      // Query the public.users table to find the associated email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email') // Only select email, as phone login is being removed
        .ilike('username', username)
        .maybeSingle();

      if (userError) throw userError;
      if (!userData || !userData.email) {
        // If no user found with that username, or user has no email, consider it invalid credentials
        throw new Error('Invalid username or password.');
      }

      // Use the retrieved email for signInWithPassword
      const { error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: password
      });

      if (error) throw error
      return true
    } catch (error: any) {
      console.error('useAuth: Login error:', error)
      throw error
    }
  }

  const signup = async (userData: {
    title: 'Mr' | 'Mrs' | 'Ms' | 'Dr'
    first_name: string
    last_name: string
    employee_id?: string
    email?: string // ✅ Optional
    phone_number: string
    username: string
    password: string
  }) => {
    try {
      setConnectionError(null)
      console.log('useAuth: Attempting signup')

      // Supabase Auth signUp requires either email or phone.
      // If email is provided, use it. Otherwise, use phone number.
      const authIdentifier = userData.email?.trim() || userData.phone_number.trim();
      const authOptions: any = { password: userData.password };

      if (userData.email?.trim()) {
        authOptions.email = userData.email.trim();
      } else {
        authOptions.phone = userData.phone_number.trim();
      }

      const { data, error } = await supabase.auth.signUp({
        ...authOptions,
        options: {
          data: {
            username: userData.username.trim(),
            role: 'Sales Rep',
            first_login: true,
            title: userData.title,
            first_name: userData.first_name,
            last_name: userData.last_name,
            employee_id: userData.employee_id,
            phone_number: userData.phone_number,
          }
        }
      })

      if (error) throw error
      if (!data.user) throw new Error('Signup failed. No user returned.')

      // Background database record creation
      setTimeout(() => {
        supabase.from('users').insert([{
          id: data.user.id,
          username: userData.username.trim(),
          email: userData.email?.trim(),
          role: 'Sales Rep',
          first_login: true,
          title: userData.title,
          first_name: userData.first_name,
          last_name: userData.last_name,
          employee_id: userData.employee_id,
          phone_number: userData.phone_number,
        }]).then(({ error }) => {
          if (error) {
            console.warn('useAuth: DB record creation failed (non-critical):', error.message)
          }
        })
      }, 100)

      return true
    } catch (error: any) {
      console.error('useAuth: Signup error:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      console.log('useAuth: Logging out...')
      
      // Clear all sales rep-specific caches on logout
      const userId = user?.id;
      if (userId) {
        localStorage.removeItem(`sales_rep_assigned_products_${userId}`);
        localStorage.removeItem(`ongoing_on_demand_orders_${userId}_Sales Rep`);
        localStorage.removeItem(`on_demand_orders_data_${userId}`);
        // Add any other cache keys specific to sales reps
        console.log('useAuth: Cleared localStorage caches for user ID:', userId);
      }
      
      // Always attempt logout to clear any stale session data
      const { error } = await supabase.auth.signOut()
      if (error) {
        // Check for session not found error specifically
        if (error.message.toLowerCase().includes('session') || 
            error.message.toLowerCase().includes('not found') ||
            error.message.toLowerCase().includes('does not exist')) {
          console.log('useAuth: Session already cleared or expired')
        } else {
          console.warn('useAuth: Logout warning:', error.message)
        }
      }
      
      // Always clear local state regardless of API call result
      setUser(null)
      setConnectionError(null)
    } catch (error) {
      // Handle network or other errors during logout
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.toLowerCase().includes('session') || 
          errorMessage.toLowerCase().includes('not found') ||
          errorMessage.toLowerCase().includes('does not exist')) {
        console.log('useAuth: Session already cleared or expired')
      } else {
        console.warn('useAuth: Logout error (non-critical):', error)
      }
      // Ensure local state is cleared even if logout fails
      setUser(null)
      setConnectionError(null)
    }
  }

  // ADD NEW FUNCTIONS before the return statement:

  // Reset password (user changes from temporary to permanent)
  const resetPassword = async (userId: string, currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      console.log('resetPassword: Starting password reset for user:', userId);
      
      // Verify current password
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('password, is_temporary_password')
        .eq('id', userId)
        .single();

      console.log('resetPassword: User data fetched:', { 
        hasPassword: !!userData?.password, 
        isTemporary: userData?.is_temporary_password 
      });

      if (userError) {
        console.error('resetPassword: User fetch error:', userError);
        throw userError;
      }
      if (!userData) throw new Error('User not found');

      // Compare plain text passwords
      if (userData.password !== currentPassword) {
        console.error('resetPassword: Current password mismatch');
        throw new Error('Current password is incorrect');
      }

      console.log('resetPassword: Current password verified, updating database...');

      // In resetPassword function, replace the update section with:
      const { data: resetResult, error: updateError } = await supabase
        .rpc('reset_user_password', {
          p_user_id: userId,
          p_new_password: newPassword
        });

      console.log('resetPassword: Function call result:', { 
        result: resetResult, 
        error: updateError 
      });

      if (updateError) {
        console.error('resetPassword: Function call error:', updateError);
        throw updateError;
      }

      if (!resetResult) {
        throw new Error('Password reset failed - user not found or no changes made');
      }

      console.log('resetPassword: Password reset successful, updating local state...');

      // Update local user state
      setUser(prev => prev ? { ...prev, is_temporary_password: false } : null);

      console.log('resetPassword: Complete');
      return true;
    } catch (error: any) {
      console.error('useAuth: Reset password error:', error);
      throw error;
    }
  };

  // Change password (user changes their own password while logged in)
  const changePassword = async (userId: string, oldPassword: string, newPassword: string): Promise<boolean> => {
    try {
      // Verify old password
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('password')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('User not found');

      if (userData.password !== oldPassword) {
        throw new Error('Old password is incorrect');
      }

      // Update password (keep is_temporary_password as false since user is changing their own password)
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Also update Supabase Auth password
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (authError) throw authError;

      return true;
    } catch (error: any) {
      console.error('useAuth: Change password error:', error);
      throw error;
    }
  };

  // Request password reset (user forgot password - notifies Super Admins)
  const requestPasswordReset = async (userId: string, message?: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('password_reset_requests')
        .insert({
          user_id: userId,
          requested_by_user_id: userId,
          status: 'pending',
          request_message: message || 'User forgot password and requesting reset'
        });

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('useAuth: Request password reset error:', error);
      throw error;
    }
  };

  // In the return statement at the end of the component, UPDATE:
  return { 
    user, 
    loading, 
    login, 
    signup, 
    logout, 
    connectionError, 
    isOnline, 
    deviceType: detectDeviceType(),
    resetPassword, // NEW
    changePassword, // NEW
    requestPasswordReset // NEW
  }
}