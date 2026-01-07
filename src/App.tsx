import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ModuleAccessProvider, useModuleAccess } from './contexts/ModuleAccessContext';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { ChangePasswordModal } from './components/ChangePasswordModal';

function AppContent() {
  const { user, loading, requiresPasswordChange } = useAuth();
  const { loading: moduleLoading } = useModuleAccess();

  if (loading || moduleLoading) {
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
    return <Login />;
  }

  if (requiresPasswordChange) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ChangePasswordModal
          onPasswordChanged={() => {
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return <AppLayout />;
}

function App() {
  return (
    <AuthProvider>
      <ModuleAccessProvider>
        <AppContent />
      </ModuleAccessProvider>
    </AuthProvider>
  );
}

export default App;
