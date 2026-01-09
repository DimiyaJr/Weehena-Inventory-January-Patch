import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth()

  // Add debugging to see what's in the user object
  React.useEffect(() => {
    if (user) {
      console.log('ProtectedRoute: User object:', user)
      console.log('ProtectedRoute: User type:', typeof user)
      console.log('ProtectedRoute: User stringified:', JSON.stringify(user))
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // More explicit check for user existence
  const hasValidUser = user && typeof user === 'object' && user.id

  if (!hasValidUser) {
    console.log('ProtectedRoute: No valid user, redirecting to login')
    return <Navigate to="/" replace />
  }

  console.log('ProtectedRoute: User authenticated, rendering children')
  
  // Ensure children is properly rendered
  return <React.Fragment>{children}</React.Fragment>
}