import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionContext';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

interface StaffAdminRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  showAccessDenied?: boolean;
}

/**
 * StaffAdminRoute - Protects routes accessible by staff admins (is_admin)
 * as well as super admins. Looser than AdminRoute, which requires is_super_admin.
 *
 * Usage:
 * <StaffAdminRoute>
 *   <AccountPreferences />
 * </StaffAdminRoute>
 */
const StaffAdminRoute: React.FC<StaffAdminRouteProps> = ({
  children,
  redirectTo = '/app',
  showAccessDenied = true
}) => {
  const { isAdmin, isSuperAdmin, isLoading } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isSuperAdmin) {
    if (showAccessDenied) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="bg-red-100 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <ShieldExclamationIcon className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You don't have permission to access this page.
              This area is restricted to admin staff.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.history.back()}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Go Back
              </button>
              <a
                href="/app"
                className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default StaffAdminRoute;
