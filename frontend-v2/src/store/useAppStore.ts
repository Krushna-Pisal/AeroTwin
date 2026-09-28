import { create } from 'zustand'

export type GlobalMode = 'Observed' | 'Forecast' | 'Scenario'
export type Role = 'citizen' | 'municipal' | null

interface AppState {
  role: Role
  globalMode: GlobalMode
  setRole: (role: Role) => void
  setGlobalMode: (mode: GlobalMode) => void
  logout: () => void
}

export const useAppStore = create<AppState>((set) => ({
  role: (sessionStorage.getItem('aerotwin_role') as Role) || null,
  globalMode: 'Observed',
  setRole: (role) => {
    if (role) sessionStorage.setItem('aerotwin_role', role)
    else sessionStorage.removeItem('aerotwin_role')
    set({ role })
  },
  setGlobalMode: (mode) => set({ globalMode: mode }),
  logout: () => {
    sessionStorage.removeItem('aerotwin_role')
    set({ role: null, globalMode: 'Observed' })
  }
}))
