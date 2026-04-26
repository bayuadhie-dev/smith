import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'

interface RoleBasedRedirectProps {
  deskPath?: string
}

export default function RoleBasedRedirect({ 
  deskPath = '/desk' 
}: RoleBasedRedirectProps) {
  const { user, isAuthenticated, loading } = useAppSelector((state) => state.auth)
  
  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-blue-200">Loading...</p>
        </div>
      </div>
    )
  }
  
  // If not authenticated, this shouldn't render (but handle gracefully)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  // If user data is still loading after auth confirmed
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-blue-200">Loading user data...</p>
        </div>
      </div>
    )
  }
  
  // All authenticated users go to desk (modules will be filtered by permissions)
  return <Navigate to={deskPath} replace />
}
