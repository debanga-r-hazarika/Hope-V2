import { Routes, Route, Navigate, useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ModuleAccessProvider, useModuleAccess } from './contexts/ModuleAccessContext';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { NotFound } from './pages/NotFound';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { UserDetail } from './pages/UserDetail';
import { MyProfile } from './pages/MyProfile';
import { Finance } from './pages/Finance';
import { Contributions } from './pages/Contributions';
import { Income } from './pages/Income';
import { Expenses } from './pages/Expenses';
import { Documents } from './pages/Documents';
import { Agile } from './pages/Agile';
import { Operations } from './pages/Operations';
import { Sales } from './pages/Sales';
import { Admin } from './pages/Admin';
import { Analytics } from './pages/Analytics';

type OperationsSection = 'suppliers' | 'raw-materials' | 'recurring-products' | 'production' | 'processed-goods' | 'machines' | 'tag-overview';
type SalesSection = 'customers' | 'orders' | null;

// Wrapper components to inject accessLevel and navigation
function DocumentsWithAccess() {
  const { getAccessLevel } = useModuleAccess();
  return <Documents accessLevel={getAccessLevel('documents')} />;
}

function AgileWithAccess() {
  const { getAccessLevel } = useModuleAccess();
  return <Agile accessLevel={getAccessLevel('agile')} />;
}

function AnalyticsWithAccess() {
  const { getAccessLevel } = useModuleAccess();
  return <Analytics accessLevel={getAccessLevel('analytics')} />;
}

function OperationsWithAccess() {
  const navigate = useNavigate();
  const { getAccessLevel } = useModuleAccess();
  const params = useParams<{ section?: string }>();
  const section = params.section as OperationsSection | null || null;

  const handleNavigateToSection = (newSection: OperationsSection | null) => {
    if (newSection === null) {
      navigate('/operations');
    } else {
      navigate(`/operations/${newSection}`);
    }
  };

  const handleNavigateToOrder = (orderId: string) => {
    navigate(`/sales/orders/${orderId}`);
  };

  return (
    <Operations
      section={section}
      onNavigateToSection={handleNavigateToSection}
      accessLevel={getAccessLevel('operations')}
      onNavigateToOrder={handleNavigateToOrder}
    />
  );
}

function SalesWithAccess() {
  const navigate = useNavigate();
  const { getAccessLevel } = useModuleAccess();
  const params = useParams<{ section?: string; id?: string }>();
  const section = (params.section as SalesSection) || null;
  const selectedCustomerId = section === 'customers' && params.id ? params.id : null;
  const selectedOrderId = section === 'orders' && params.id ? params.id : null;

  const handleNavigateToSection = (newSection: SalesSection) => {
    if (newSection === null) {
      navigate('/sales');
    } else {
      navigate(`/sales/${newSection}`);
    }
  };

  const handleViewCustomer = (customerId: string) => {
    navigate(`/sales/customers/${customerId}`);
  };

  const handleViewOrder = (orderId: string) => {
    navigate(`/sales/orders/${orderId}`);
  };

  const handleBackToCustomers = () => {
    navigate('/sales/customers');
  };

  const handleBackToOrders = () => {
    navigate('/sales/orders');
  };

  return (
    <Sales
      section={section}
      selectedCustomerId={selectedCustomerId}
      selectedOrderId={selectedOrderId}
      onNavigateToSection={handleNavigateToSection}
      onViewCustomer={handleViewCustomer}
      onViewOrder={handleViewOrder}
      onBackToCustomers={handleBackToCustomers}
      onBackToOrders={handleBackToOrders}
      accessLevel={getAccessLevel('sales')}
    />
  );
}

function UsersWithNavigate() {
  const navigate = useNavigate();
  return <Users onViewUser={(userId) => navigate(`/users/${userId}`)} />;
}

function FinanceWithAccess() {
  const navigate = useNavigate();
  const { getAccessLevel } = useModuleAccess();
  const [searchParams] = useSearchParams();
  const focusTxnId = searchParams.get('focus');
  const focusType = searchParams.get('type') as 'contribution' | 'income' | 'expense' | null;

  const handleNavigateToSection = (section: 'contributions' | 'income' | 'expenses') => {
    navigate(`/finance/${section}`);
  };

  const handleOpenTransaction = (target: 'contribution' | 'income' | 'expense', txnId: string) => {
    if (target === 'contribution') {
      navigate(`/finance/contributions?focus=${txnId}`);
    } else if (target === 'income') {
      navigate(`/finance/income?focus=${txnId}`);
    } else if (target === 'expense') {
      navigate(`/finance/expenses?focus=${txnId}`);
    }
  };

  return (
    <Finance
      onNavigateToSection={handleNavigateToSection}
      accessLevel={getAccessLevel('finance')}
      onOpenTransaction={handleOpenTransaction}
    />
  );
}

function ContributionsWithAccess() {
  const navigate = useNavigate();
  const { getAccessLevel } = useModuleAccess();
  const [searchParams] = useSearchParams();
  const focusTxnId = searchParams.get('focus');

  return (
    <Contributions
      onBack={() => navigate('/finance')}
      hasWriteAccess={getAccessLevel('finance') === 'read-write'}
      focusTransactionId={focusTxnId || undefined}
    />
  );
}

function IncomeWithAccess() {
  const navigate = useNavigate();
  const { getAccessLevel } = useModuleAccess();
  const [searchParams] = useSearchParams();
  const focusTxnId = searchParams.get('focus');

  return (
    <Income
      onBack={() => navigate('/finance')}
      hasWriteAccess={getAccessLevel('finance') === 'read-write'}
      focusTransactionId={focusTxnId || undefined}
      onViewContribution={(txnId) => navigate(`/finance/contributions?focus=${txnId}`)}
      onViewOrder={(orderId) => navigate(`/sales/orders/${orderId}`)}
    />
  );
}

function ExpensesWithAccess() {
  const navigate = useNavigate();
  const { getAccessLevel } = useModuleAccess();
  const [searchParams] = useSearchParams();
  const focusTxnId = searchParams.get('focus');

  return (
    <Expenses
      onBack={() => navigate('/finance')}
      hasWriteAccess={getAccessLevel('finance') === 'read-write'}
      focusTransactionId={focusTxnId || undefined}
    />
  );
}

function AdminWithNavigate() {
  const navigate = useNavigate();
  return <Admin onBack={() => navigate('/dashboard')} />;
}

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
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
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

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute>
              <UsersWithNavigate />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/:userId"
          element={
            <ProtectedRoute>
              <UserDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <MyProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance"
          element={
            <ProtectedRoute moduleId="finance">
              <FinanceWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/contributions"
          element={
            <ProtectedRoute moduleId="finance">
              <ContributionsWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/income"
          element={
            <ProtectedRoute moduleId="finance">
              <IncomeWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/expenses"
          element={
            <ProtectedRoute moduleId="finance">
              <ExpensesWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute moduleId="analytics">
              <AnalyticsWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="documents"
          element={
            <ProtectedRoute moduleId="documents">
              <DocumentsWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="agile"
          element={
            <ProtectedRoute moduleId="agile">
              <AgileWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="operations"
          element={
            <ProtectedRoute moduleId="operations">
              <OperationsWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="operations/:section"
          element={
            <ProtectedRoute moduleId="operations">
              <OperationsWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales"
          element={
            <ProtectedRoute moduleId="sales">
              <SalesWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales/:section"
          element={
            <ProtectedRoute moduleId="sales">
              <SalesWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales/:section/:id"
          element={
            <ProtectedRoute moduleId="sales">
              <SalesWithAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminWithNavigate />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
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
