import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Menu, X } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Dashboard } from '../pages/Dashboard';
import { Users } from '../pages/Users';
import { MyProfile } from '../pages/MyProfile';
import { UserDetail } from '../pages/UserDetail';
import { Finance } from '../pages/Finance';
import { Documents } from '../pages/Documents';
import { Contributions } from '../pages/Contributions';
import { Income } from '../pages/Income';
import { Expenses } from '../pages/Expenses';
import { Agile } from '../pages/Agile';
import { Operations } from '../pages/Operations';
import { Sales } from '../pages/Sales';
import { Admin } from '../pages/Admin';
import { NAVIGATION_ITEMS, type NavigationItem, type PageType } from '../types/navigation';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import type { ModuleId } from '../types/modules';

type FinanceSection = 'dashboard' | 'contributions' | 'income' | 'expenses';
type OperationsSection = 'suppliers' | 'raw-materials' | 'recurring-products' | 'production' | 'processed-goods' | 'machines' | 'tag-overview' | null;
type SalesSection = 'customers' | 'orders' | null;

export function AppLayout() {
  const { signOut, profile } = useAuth();
  const { access: moduleAccess, loading: accessLoading, getAccessLevel } = useModuleAccess();
  const [activePage, setActivePage] = useState<PageType>('dashboard');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [financeSection, setFinanceSection] = useState<FinanceSection>('dashboard');
  const [operationsSection, setOperationsSection] = useState<OperationsSection>(null);
  const [salesSection, setSalesSection] = useState<SalesSection>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [focusContributionTxnId, setFocusContributionTxnId] = useState<string | null>(null);
  const [focusIncomeTxnId, setFocusIncomeTxnId] = useState<string | null>(null);
  const [focusExpenseTxnId, setFocusExpenseTxnId] = useState<string | null>(null);

  const handleLogout = async () => {
    await signOut();
  };

  const handleViewUser = (userId: string) => {
    setSelectedUserId(userId);
    setIsMobileMenuOpen(false);
  };

  const handleBackToUsers = () => {
    setSelectedUserId(null);
  };

  const handleNavigate = (page: PageType) => {
    const isBlockedModule =
      (page === 'finance' && getAccessLevel('finance') === 'no-access') ||
      (page === 'documents' && getAccessLevel('documents') === 'no-access') ||
      (page === 'agile' && getAccessLevel('agile') === 'no-access') ||
      (page === 'operations' && getAccessLevel('operations') === 'no-access') ||
      (page === 'sales' && getAccessLevel('sales') === 'no-access');

    // Block admin page for non-admins
    if (page === 'admin' && profile?.role !== 'admin') {
      setActivePage('dashboard');
      setIsMobileMenuOpen(false);
      return;
    }

    if (isBlockedModule) {
      setActivePage('dashboard');
      setSelectedUserId(null);
      setFinanceSection('dashboard');
      setOperationsSection(null);
      setFocusContributionTxnId(null);
      setFocusIncomeTxnId(null);
      setFocusExpenseTxnId(null);
      setIsMobileMenuOpen(false);
      return;
    }

    setActivePage(page);
    setSelectedUserId(null);
    setFinanceSection('dashboard');
    // Always show card view when navigating to Operations
    if (page === 'operations') {
      setOperationsSection(null);
    }
    // Always show card view when navigating to Sales
    if (page === 'sales') {
      setSalesSection(null);
      setSelectedCustomerId(null);
      setSelectedOrderId(null);
    }
    setFocusContributionTxnId(null);
    setFocusIncomeTxnId(null);
    setFocusExpenseTxnId(null);
    setIsMobileMenuOpen(false);
  };

  const handleFinanceNavigate = (section: FinanceSection) => {
    setFinanceSection(section);
    if (section !== 'contributions') {
      setFocusContributionTxnId(null);
    }
    if (section !== 'income') {
      setFocusIncomeTxnId(null);
    }
    if (section !== 'expenses') {
      setFocusExpenseTxnId(null);
    }
  };

  const handleOperationsNavigate = (section: OperationsSection) => {
    setOperationsSection(section);
  };

  const handleSalesNavigate = (section: SalesSection) => {
    setSalesSection(section);
  };

  const handleViewCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSalesSection('customers');
    setIsMobileMenuOpen(false);
  };

  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setSalesSection('orders');
    setIsMobileMenuOpen(false);
  };

  const handleBackToCustomers = () => {
    setSelectedCustomerId(null);
    setSalesSection('customers');
  };

  const handleBackToOrders = () => {
    setSelectedOrderId(null);
    setSalesSection('orders');
  };

  const availableNavItems: NavigationItem[] = useMemo(
    () =>
      NAVIGATION_ITEMS.filter((item) => {
        // Admin page: only show for admins
        if (item.id === 'admin') {
          return profile?.role === 'admin';
        }
        // Module access check
        if (item.id === 'finance' || item.id === 'documents' || item.id === 'agile' || item.id === 'operations') {
          return getAccessLevel(item.id as ModuleId) !== 'no-access';
        }
        return true;
      }),
    [getAccessLevel, profile?.role]
  );

  useEffect(() => {
    if (!accessLoading) {
      if (activePage === 'finance' && getAccessLevel('finance') === 'no-access') {
        setActivePage('dashboard');
      }
      if (activePage === 'documents' && getAccessLevel('documents') === 'no-access') {
        setActivePage('dashboard');
      }
      if (activePage === 'agile' && getAccessLevel('agile') === 'no-access') {
        setActivePage('dashboard');
      }
      if (activePage === 'operations' && getAccessLevel('operations') === 'no-access') {
        setActivePage('dashboard');
      }
      // Redirect non-admins from admin page
      if (activePage === 'admin' && profile?.role !== 'admin') {
        setActivePage('dashboard');
      }
    }
  }, [accessLoading, activePage, getAccessLevel, profile?.role]);

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading modules...</p>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    if (activePage === 'users' && selectedUserId !== null) {
      return <UserDetail userId={selectedUserId} onBack={handleBackToUsers} />;
    }

    if (activePage === 'finance') {
      const financeAccessLevel = getAccessLevel('finance');
      const hasWriteAccess = financeAccessLevel === 'read-write';

      switch (financeSection) {
        case 'dashboard':
          return (
            <Finance
              onNavigateToSection={(section) => handleFinanceNavigate(section)}
              accessLevel={financeAccessLevel}
              onOpenTransaction={(target, txnId) => {
                if (target === 'contribution') {
                  setFocusContributionTxnId(txnId);
                  handleFinanceNavigate('contributions');
                } else if (target === 'income') {
                  setFocusIncomeTxnId(txnId);
                  handleFinanceNavigate('income');
                } else if (target === 'expense') {
                  setFocusExpenseTxnId(txnId);
                  handleFinanceNavigate('expenses');
                }
              }}
            />
          );
        case 'contributions':
          return (
            <Contributions
              onBack={() => handleFinanceNavigate('dashboard')}
              hasWriteAccess={hasWriteAccess}
              focusTransactionId={focusContributionTxnId}
            />
          );
        case 'income':
          return (
            <Income
              onBack={() => handleFinanceNavigate('dashboard')}
              hasWriteAccess={hasWriteAccess}
              focusTransactionId={focusIncomeTxnId}
              onViewContribution={(txnId) => {
                setFocusContributionTxnId(txnId);
                handleFinanceNavigate('contributions');
              }}
            />
          );
        case 'expenses':
          return (
            <Expenses
              onBack={() => handleFinanceNavigate('dashboard')}
              hasWriteAccess={hasWriteAccess}
              focusTransactionId={focusExpenseTxnId}
            />
          );
        default:
          return (
            <Finance
              onNavigateToSection={(section) => handleFinanceNavigate(section)}
              accessLevel={financeAccessLevel}
              onOpenTransaction={(target, txnId) => {
                if (target === 'contribution') {
                  setFocusContributionTxnId(txnId);
                  handleFinanceNavigate('contributions');
                } else if (target === 'income') {
                  setFocusIncomeTxnId(txnId);
                  handleFinanceNavigate('income');
                } else if (target === 'expense') {
                  setFocusExpenseTxnId(txnId);
                  handleFinanceNavigate('expenses');
                }
              }}
            />
          );
      }
    }

    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigateToModule={(moduleId) => {
              if (moduleId === 'finance') {
                handleNavigate('finance');
              } else if (moduleId === 'documents') {
                handleNavigate('documents');
              } else if (moduleId === 'agile') {
                handleNavigate('agile');
              } else if (moduleId === 'operations') {
                handleNavigate('operations');
              } else if (moduleId === 'sales') {
                handleNavigate('sales');
              }
            }}
            moduleAccess={moduleAccess}
          />
        );
      case 'users':
        return <Users onViewUser={handleViewUser} />;
      case 'profile':
        return <MyProfile />;
      case 'documents':
        return <Documents accessLevel={getAccessLevel('documents')} />;
      case 'agile':
        return <Agile accessLevel={getAccessLevel('agile')} />;
      case 'operations':
        return (
          <Operations
            section={operationsSection}
            onNavigateToSection={(section) => setOperationsSection(section)}
            accessLevel={getAccessLevel('operations')}
            onNavigateToOrder={(orderId) => {
              // Set order state first
              setSelectedOrderId(orderId);
              setSalesSection('orders');
              setIsMobileMenuOpen(false);
              // Navigate to sales - handleNavigate will reset the state, so we override it after
              handleNavigate('sales');
              // Override handleNavigate's reset in the next tick to ensure it takes effect
              setTimeout(() => {
                setSelectedOrderId(orderId);
                setSalesSection('orders');
              }, 0);
            }}
          />
        );
      case 'sales':
        return (
          <Sales
            section={salesSection}
            selectedCustomerId={selectedCustomerId}
            selectedOrderId={selectedOrderId}
            onNavigateToSection={handleSalesNavigate}
            onViewCustomer={handleViewCustomer}
            onViewOrder={handleViewOrder}
            onBackToCustomers={handleBackToCustomers}
            onBackToOrders={handleBackToOrders}
            accessLevel={getAccessLevel('sales')}
          />
        );
      case 'admin':
        return <Admin onBack={() => handleNavigate('dashboard')} />;
      default:
        return (
          <Dashboard
            onNavigateToModule={(moduleId) => {
              if (moduleId === 'finance') {
                handleNavigate('finance');
              } else if (moduleId === 'documents') {
                handleNavigate('documents');
              } else if (moduleId === 'agile') {
                handleNavigate('agile');
              } else if (moduleId === 'operations') {
                handleNavigate('operations');
              } else if (moduleId === 'sales') {
                handleNavigate('sales');
              }
            }}
            moduleAccess={moduleAccess}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="hidden lg:block">
        <Header
          activePage={activePage}
          navItems={availableNavItems}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
        <main className="pt-16">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {renderPage()}
          </div>
        </main>
      </div>

      <div className="lg:hidden">
        <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-gray-700" />
            ) : (
              <Menu className="w-6 h-6 text-gray-700" />
            )}
          </button>
          <div className="text-lg font-bold text-gray-900">
            HATVONI INSIDER
          </div>
          <div className="w-10"></div>
        </div>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <div
          className={`fixed left-0 top-0 bottom-0 w-64 bg-sidebar transform transition-transform duration-300 ease-in-out z-50 ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            activePage={activePage}
            navItems={availableNavItems}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        </div>

        <main className="pt-16">
          <div className="px-4 py-6">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}
