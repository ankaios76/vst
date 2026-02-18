import { useState, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'

export default function LoginPage() {
  const { login } = useAuth()
  const { tr } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
    } catch (err: any) {
      setError(err.message || tr('Login fehlgeschlagen', 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src="/logo.png" alt="GonoPBX" className="h-16 w-auto" />
          </div>

          <h2 className="text-center text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">
            {tr('Anmeldung', 'Sign in')}
          </h2>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {tr('Benutzername', 'Username')}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder={tr('Benutzername eingeben', 'Enter username')}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {tr('Passwort', 'Password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder={tr('Passwort eingeben', 'Enter password')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              {loading ? tr('Anmeldung...', 'Signing in...') : tr('Anmelden', 'Sign in')}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 dark:text-gray-600 text-xs mt-6">
          {tr('GonoPBX Telefonanlage', 'GonoPBX PBX')}
        </p>
      </div>
    </div>
  )
}
