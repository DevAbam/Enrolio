'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function friendlyError(err: unknown): string {
    if (err instanceof TypeError || (err instanceof Error && err.message.toLowerCase().includes('fetch'))) {
      return 'No internet connection. Please check your network and try again.'
    }
    if (err instanceof Error) {
      const msg = err.message.toLowerCase()
      if (msg.includes('invalid_credentials') || msg.includes('invalid login') || msg.includes('invalid email or password') || msg.includes('email not confirmed') === false && msg.includes('credentials'))
        return 'Incorrect email or password. Please try again.'
      if (msg.includes('email not confirmed'))
        return 'Please confirm your email address before signing in.'
      if (msg.includes('too many requests') || msg.includes('rate limit'))
        return 'Too many login attempts. Please wait a few minutes and try again.'
      if (msg.includes('user not found'))
        return 'No account found with this email address.'
      return err.message
    }
    return 'An unexpected error occurred. Please try again.'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      console.debug('signInWithPassword:', { signInData, authError })

      if (authError) {
        console.error('Supabase signin error', authError)
        setError(friendlyError(authError))
        setLoading(false)
        return
      }

      const { data: currentUser } = await supabase.auth.getUser()
      console.debug('Supabase current user after sign-in:', currentUser)

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(friendlyError(err))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="card p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold mb-3">
              E
            </div>
            <h1 className="text-2xl font-bold text-fg">Welcome back</h1>
            <p className="text-sm text-fg-muted mt-1">Sign in to Enrolio</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="admin@yourschool.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-fg-subtle">
            Sign In with your provided credentials
            {/* <a href="/setup" className="text-accent hover:underline">
              Set up your school
            </a> */}
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">Enrolio</p>
      </div>
    </div>
  )
}
