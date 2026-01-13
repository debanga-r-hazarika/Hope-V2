import { AlertCircle, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModernButton } from '../components/ui/ModernButton';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100 mb-6">
            <AlertCircle className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Page Not Found</h2>
          <p className="text-gray-600 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link to="/dashboard">
          <ModernButton variant="primary" className="w-full">
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </ModernButton>
        </Link>
      </div>
    </div>
  );
}
