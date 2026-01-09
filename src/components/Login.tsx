import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import WeehenaLogo from '../assets/images/Weehena Logo(Ai) copy copy copy.png';

export const Login: React.FC = () => {
  const [showModal, setShowModal] = useState(false)
  const [credential, setCredential] = useState('') // ✅ Changed from email to credential
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, connectionError } = useAuth()
  const navigate = useNavigate()

  const handleBeginDay = () => {
    setShowModal(true)
    setError('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credential.trim() || !password.trim()) {
      setError('Please enter both username and password')
      return
    }

    setLoading(true)
    setError('')

    try {
      const success = await login(credential.trim(), password.trim()) // ✅ Updated to pass credential
      if (success) {
        navigate('/inventory')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      if (err.message && err.message.includes('Invalid login credentials')) {
        setError('Invalid username or password. Please check your credentials and try again, or sign up if you don\'t have an account.')
      } else if (err.message && err.message.includes('Email not confirmed')) {
        setError('Please verify your email before logging in. Check your inbox for a confirmation link.')
      } else if (err.message && err.message.includes('company')) {
        setError('Your account is not assigned to a farm. Please contact your administrator for assistance.')
      } else if (err.message && err.message.includes('connect')) {
        setError('Unable to connect to database. Please check your internet connection and try again.')
      } else {
        setError(err.message || 'Login failed. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src={WeehenaLogo} alt="Weehena Farm Logo" className="h-16 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Weehena Farm</h1>
          <p className="mt-2 text-gray-600">{today}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {!showModal ? (
            <div className="text-center">
              <button
                onClick={handleBeginDay}
                className="w-full py-3 px-4 bg-red-600 text-white font-semibold rounded-lg shadow hover:bg-red-700 transition-colors flex items-center justify-center"
              >
                <Calendar className="w-5 h-5 mr-2" />
                Begin Day
              </button>
              {connectionError && (
                <p className="mt-4 text-sm text-red-600">{connectionError}</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label> {/* Updated label */}
                <input
                  type="text" // ✅ Changed from email to text
                  value={credential} // ✅ Updated to credential
                  onChange={(e) => setCredential(e.target.value)} // ✅ Updated to credential
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  placeholder="Enter your username" // Updated placeholder
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-red-600 text-white font-semibold rounded-lg shadow hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-2 px-4 mt-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}