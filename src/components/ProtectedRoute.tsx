import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { Unauthorized } from '../pages/Unauthorized';
import type { ModuleId } from '../types/modules';

interface ProtectedRouteProps {
  children: React.ReactNode;
  moduleId?: ModuleId;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, moduleId, requireAdmin }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const { getAccessLevel, loading: accessLoading } = useModuleAccess();
  const location = useLocation();

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check admin requirement
  if (requireAdmin && profile?.role !== 'admin') {
    return <Unauthorized />;
  }

  // Check module access
  if (moduleId) {
    const accessLevel = getAccessLevel(moduleId);
    if (accessLevel === 'no-access') {
      return <Unauthorized />;
    }
  }

  return <>{children}</>;
}
