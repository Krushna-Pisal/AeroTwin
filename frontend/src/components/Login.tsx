import React, { useState } from "react"

export type Role = "citizen" | "municipal"

const ACCOUNTS: Record<Role, { username: string; password: string; title: string; subtitle: string; icon: string; detail: string }> = {
  citizen: {
    username: "citizen",
    password: "citizen",
    title: "Citizen Portal",
    subtitle: "Public Air Quality & Community Reporting",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    detail: "Access local air quality monitoring, submit civic complaints, and contribute spatial crowd-sourced data.",
  },
  municipal: {
    username: "municipal",
    password: "municipal",
    title: "Municipal Corporation",
    subtitle: "PMC Command Center & GIS Management",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h6M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    detail: "Manage citizen complaints, review spatial contributions, dispatch departments, and run scenario simulations.",
  },
}

export function Login({ onEnter }: { onEnter: (role: Role) => void }) {
  const [role, setRole] = useState<Role>("citizen")
  const [username, setUsername] = useState("citizen")
  const [password, setPassword] = useState("citizen")
  const [error, setError] = useState<string | null>(null)
  const account = ACCOUNTS[role]

  function choose(next: Role) {
    setRole(next)
    setUsername(ACCOUNTS[next].username)
    setPassword(ACCOUNTS[next].password)
    setError(null)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (username.trim() === account.username && password === account.password) {
      onEnter(role)
      return
    }
    setError("Invalid username or password for this role portal.")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4 py-12 text-slate-100">
      <div className="w-full max-w-lg rounded-2xl border border-[#1e2432] bg-[#0d1117] p-8 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg"
            style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-green-400 uppercase">PUNE URBAN DIGITAL TWIN</span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white" style={{ fontFamily: "var(--font-display)" }}>AeroTwin</h1>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-400">
          Select your authentication role to access the environmental intelligence platform.
        </p>

        {/* Role Selector Tabs */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {(Object.keys(ACCOUNTS) as Role[]).map((key) => {
            const active = role === key
            const item = ACCOUNTS[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => choose(key)}
                className={`flex flex-col rounded-xl p-4 text-left transition-all border ${
                  active
                    ? "border-green-500 bg-green-500/10 text-white shadow-md shadow-green-500/5"
                    : "border-[#1e2432] bg-[#111827] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <svg className={`h-5 w-5 ${active ? "text-green-400" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {active && <span className="h-2 w-2 rounded-full bg-green-400" />}
                </div>
                <span className="mt-2 text-sm font-semibold text-white">{item.title}</span>
                <span className="text-[11px] text-slate-400 line-clamp-1">{key === "citizen" ? "citizen / citizen" : "municipal / municipal"}</span>
              </button>
            )
          })}
        </div>

        {/* Sign In Form */}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="rounded-xl border border-[#1e2432] bg-[#111827] p-3 text-xs text-slate-300">
            <p className="font-medium text-green-400">{account.title}</p>
            <p className="mt-1 text-slate-400">{account.detail}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#111827] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#111827] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
              required
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-[#111827] px-3 py-2 text-[11px] text-slate-400 border border-[#1e2432]">
            <span>Credentials: <code className="text-green-400">{account.username}</code> / <code className="text-green-400">{account.password}</code></span>
            <button
              type="button"
              onClick={() => {
                setUsername(account.username)
                setPassword(account.password)
              }}
              className="text-xs font-medium text-green-400 hover:underline"
            >
              Fill Credentials
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
          >
            Sign In to {account.title}
          </button>
        </form>

        <div className="mt-6 border-t border-[#1e2432] pt-4 text-center text-xs text-slate-500">
          AeroTwin Environmental Twin Platform &copy; 2026 Pune Municipal Corporation
        </div>
      </div>
    </main>
  )
}
