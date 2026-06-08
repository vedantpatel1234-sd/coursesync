import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthState {
  user: Profile | null
  loading: boolean
  setUser: (user: Profile | null) => void
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user, loading: false }),

  fetchProfile: async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    set({ user: (data as Profile) ?? null, loading: false })
  },

  signIn: async (email: string, password: string) => {
    // Clear any existing session first
    await supabase.auth.signOut()
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()
      set({ user: (profile as Profile) ?? null, loading: false })
    }
  },

  signOut: async () => {
    // Clear all storage before signing out
    localStorage.clear()
    sessionStorage.clear()
    await supabase.auth.signOut({ scope: 'local' })
    set({ user: null, loading: false })
  },
}))