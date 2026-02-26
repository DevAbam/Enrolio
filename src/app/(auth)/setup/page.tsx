'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'

export default function SetupPage() {
  const [form, setForm] = useState({
    schoolName: '',
    adminName: '',
    email: '',
    password: '',
  })
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const router = useRouter()

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Setup failed. Please try again.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0f0a] flex items-center justify-center p-4">
        <div className="card p-8 w-full max-w-sm text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="section-title mb-2">Setup complete!</h2>
          <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-full bg-green-600 text-white flex items-center justify-center text-xl font-bold mb-3">
              S
            </div>
            <h1 className="text-2xl font-bold text-green-900 dark:text-green-50">Set up your school</h1>
            <p className="text-sm text-gray-500 mt-1">Create your first admin account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="schoolName">School Name *</label>
              <input
                id="schoolName"
                type="text"
                className="input"
                placeholder="Sunshine Academy"
                value={form.schoolName}
                onChange={(e) => update('schoolName', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="adminName">Admin Full Name *</label>
              <input
                id="adminName"
                type="text"
                className="input"
                placeholder="John Mensah"
                value={form.adminName}
                onChange={(e) => update('adminName', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="email">Email Address *</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="admin@school.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password *</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Setting up…' : 'Create School & Admin'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-400">
            Already set up?{' '}
            <a href="/login" className="text-green-600 hover:underline">Sign in</a>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">SchoolOps Pro</p>
      </div>
    </div>
  )
}
