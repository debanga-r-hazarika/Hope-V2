import { ShieldX, Home, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ModernButton } from '../components/ui/ModernButton';

export function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-yellow-100 mb-6">
            <ShieldX className="w-12 h-12 text-yellow-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">You are not authorized</h2>
          <p className="text-gray-600 mb-8">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <ModernButton
            variant="secondary"
            className="flex-1"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </ModernButton>
          <Link to="/dashboard" className="flex-1">
            <ModernButton variant="primary" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Go to Dashboard
            </ModernButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
