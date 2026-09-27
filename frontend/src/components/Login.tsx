import { useState } from "react"

export type Role = "citizen" | "municipal"

const ACCOUNTS: Record<Role, { username: string; password: string; title: string; detail: string }> = {
  citizen: {
    username: "citizen",
    password: "citizen",
    title: "Citizen",
    detail: "See the station reading, the 24-hour outlook, and report what you notice.",
  },
  municipal: {
    username: "municipal",
    password: "municipal",
    title: "Municipal corporation",
    detail: "See hotspot detail, evidence, and intervention scenarios.",
  },
}

export function Login({ onEnter }: { onEnter: (role: Role) => void }) {
  const [role, setRole] = useState<Role>("citizen")
  const [username, setUsername] = useState("citizen")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const account = ACCOUNTS[role]

  function choose(next: Role) {
    setRole(next)
    setUsername(ACCOUNTS[next].username)
    setPassword("")
    setError(null)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (username.trim() === account.username && password === account.password) {
      onEnter(role)
      return
    }
    setError("That username or password does not match this sign-in.")
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-[#12110f] px-4 py-10 text-[#f4efe6]">
      <div className="w-full max-w-md">
        <p className="text-xs tracking-[0.18em] text-[#d6c48a]">PUNE</p>
        <h1 className="font-display text-4xl">AeroTwin</h1>
        <p className="mt-2 text-sm text-[#d6d3d1]">Sign in as a citizen or as the municipal corporation. These are two views of the same stations.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          {(Object.keys(ACCOUNTS) as Role[]).map((key) => (
            <button key={key} type="button" onClick={() => choose(key)} className={`rounded-2xl px-3 py-3 text-left ${role === key ? "bg-[#f4efe6] text-[#1c1915]" : "bg-[#1c1915]"}`}>
              <span className="block font-medium">{ACCOUNTS[key].title}</span>
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-4 rounded-3xl bg-[#f4efe6] p-4 text-[#1c1915]">
          <p className="text-sm">{account.detail}</p>
          <label className="mt-3 block text-xs">
            Username
            <input className="mt-1 w-full rounded-xl border border-[#d9d0c1] bg-white px-3 py-2" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label className="mt-3 block text-xs">
            Password
            <input className="mt-1 w-full rounded-xl border border-[#d9d0c1] bg-white px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <p className="mt-2 text-xs text-[#57534e]">Demo sign-in: {account.username} / {account.password}. This is not a PMC account system.</p>
          {error && <p className="mt-2 text-sm text-[#9f1239]">{error}</p>}
          <button type="submit" className="mt-4 w-full rounded-full bg-[#1c1915] py-2 text-sm text-[#f4efe6]">Sign in</button>
        </form>
      </div>
    </main>
  )
}
