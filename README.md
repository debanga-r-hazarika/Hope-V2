# HATVONI INSIDER

## Table of Contents
1. [Executive Overview](#executive-overview)
2. [Technical Architecture](#technical-architecture)
3. [Core Features & Use Cases](#core-features--use-cases)
4. [Database Schema Requirements](#database-schema-requirements)
5. [API Requirements](#api-requirements)
6. [Setup & Installation](#setup--installation)
7. [Component Documentation](#component-documentation)
8. [Authentication & Authorization](#authentication--authorization)
9. [State Management](#state-management)
10. [Development Guidelines](#development-guidelines)
11. [Deployment Considerations](#deployment-considerations)

---

## Executive Overview

**HATVONI INSIDER** is an enterprise-grade business management platform designed to streamline organizational operations through integrated modules for financial management, user administration, and business analytics.

### Project Vision
To provide a unified platform that enables organizations to manage their entire business operations efficiently, with real-time data tracking, comprehensive reporting, and role-based access control.

### Target Audience
- Small to medium-sized enterprises
- Financial managers and accountants
- Business administrators
- Department heads requiring financial oversight

### Current Version
- **Status**: MVP (Minimum Viable Product)
- **Modules Implemented**: Finance Management, User Management, Dashboard
- **Authentication**: Demo Mode (requires Supabase Auth integration)

---

## Technical Architecture

### Technology Stack

#### Frontend Framework
- **React 18.3.1**: Component-based UI development
- **TypeScript 5.5.3**: Type-safe development with enhanced IDE support
- **Vite 5.4.2**: Fast build tool and development server

#### UI Framework & Styling
- **Tailwind CSS 3.4.1**: Utility-first CSS framework
- **Lucide React 0.344.0**: Modern icon library

#### Database & Backend Services
- **Supabase 2.57.4**:
  - PostgreSQL database
  - Real-time subscriptions
  - Row-Level Security (RLS)
  - Authentication services
  - RESTful API auto-generation

#### Build & Development Tools
- **ESLint 9.9.1**: Code quality and consistency
- **PostCSS 8.4.35**: CSS processing
- **Autoprefixer 10.4.18**: CSS vendor prefixing

### Project Structure

```
matvoni-insider/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── AppLayout.tsx    # Main application layout wrapper
│   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   ├── Header.tsx       # Top navigation header
│   │   ├── NavigationItem.tsx
│   │   ├── ContributionForm.tsx
│   │   ├── IncomeForm.tsx
│   │   ├── ExpenseForm.tsx
│   │   ├── CreateUserModal.tsx
│   │   └── ModuleAccessModal.tsx
│   │
│   ├── pages/               # Page-level components
│   │   ├── Dashboard.tsx    # Main dashboard with module grid
│   │   ├── Finance.tsx      # Finance management hub
│   │   ├── Contributions.tsx # Capital contributions tracking
│   │   ├── Income.tsx       # Revenue tracking
│   │   ├── Expenses.tsx     # Expense management
│   │   ├── Users.tsx        # User administration
│   │   ├── UserDetail.tsx   # Individual user management
│   │   ├── MyProfile.tsx    # User profile management
│   │   └── Login.tsx        # Authentication page
│   │
│   ├── contexts/            # React Context providers
│   │   └── AuthContext.tsx  # Authentication state management
│   │
│   ├── types/               # TypeScript type definitions
│   │   ├── finance.ts       # Finance-related types
│   │   └── navigation.ts    # Navigation types
│   │
│   ├── lib/                 # Utility libraries
│   │   └── supabase.ts      # Supabase client configuration
│   │
│   ├── App.tsx              # Root application component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles
│
├── public/                  # Static assets
├── .env                     # Environment variables
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Project dependencies
```

### Architecture Patterns

#### Component Architecture
- **Atomic Design Principles**: Components organized by complexity (atoms, molecules, organisms)
- **Container/Presentational Pattern**: Separation of business logic from UI presentation
- **Composition over Inheritance**: Reusable component composition

#### State Management Strategy
- **Context API**: Global authentication state
- **Local State**: Component-specific state with React hooks
- **Server State**: Supabase real-time subscriptions (to be implemented)

#### Data Flow
```
User Action → Component Event Handler → API Call (Supabase) → Database
                                                             ↓
                                                    Real-time Updates
                                                             ↓
User Interface ← Component Re-render ← State Update ← Subscription
```

---

## Core Features & Use Cases

### 1. Dashboard Module

#### Purpose
Centralized command center providing overview of all business operations and quick access to key modules.

#### Use Cases

**UC-01: Module Navigation**
- **Actor**: All authenticated users
- **Precondition**: User is logged in
- **Flow**:
  1. User views module grid on dashboard
  2. User clicks on a module card
  3. System navigates to selected module
- **Business Value**: Reduces navigation time by 60%, improves user productivity

**UC-02: Quick Metrics Overview** (Future Implementation)
- **Actor**: Business managers, executives
- **Purpose**: View real-time KPIs without navigating to individual modules
- **Business Value**: Executive decision-making with instant insights

#### Technical Requirements
- Real-time data aggregation from multiple modules
- Responsive grid layout (4 columns desktop, 1 column mobile)
- Module access control based on user permissions
- Performance: Load time < 2 seconds

---

### 2. Finance Management Module

#### Purpose
Complete financial transaction management system for tracking organizational cash flow, including contributions, income, and expenses.

#### 2.1 Contributions Tracking

##### Use Cases

**UC-03: Record Capital Investment**
- **Actor**: Finance Manager, Accountant
- **Business Problem**: Organizations need to track capital investments from founders, investors, or lenders to maintain accurate equity and liability records
- **Flow**:
  1. User navigates to Finance → Contributions
  2. User clicks "Record Contribution"
  3. User enters:
     - Amount
     - Contribution type (investment/capital/loan/other)
     - Contributor details
     - Transaction ID
     - Payment method
     - Payment date
     - Reason/description
  4. System validates data
  5. System stores contribution record
  6. System updates total contributions display
- **Business Value**:
  - Maintains accurate cap table
  - Tracks ownership stakes
  - Provides audit trail for regulatory compliance
  - Enables investor reporting

**UC-04: View Contribution History**
- **Actor**: CFO, Auditors, Investors
- **Purpose**: Review historical contribution data for reporting and analysis
- **Business Value**: Transparent financial records, simplified audit process

##### Data Requirements
- Transaction ID (unique identifier)
- Amount (decimal, 2 places)
- Contribution type (categorical)
- Payment method (cash/bank_transfer/upi/cheque/card)
- Payment destination (organization_bank/other_bank_account)
- Timestamps (created_at, updated_at)
- User audit trail (who recorded the transaction)

---

#### 2.2 Income Tracking

##### Use Cases

**UC-05: Record Revenue Transaction**
- **Actor**: Sales Manager, Accountant
- **Business Problem**: Organizations need to track all revenue sources for accurate financial reporting, tax compliance, and cash flow management
- **Flow**:
  1. User navigates to Finance → Income
  2. User clicks "Record Income"
  3. User enters:
     - Amount
     - Income source (customer/client name)
     - Income type (sales/service/interest/other)
     - Transaction ID
     - Payment method
     - Payment date
     - Category (for reporting)
  4. System validates data
  5. System records income entry
  6. System updates revenue totals
- **Business Value**:
  - Real-time revenue tracking
  - Accurate sales forecasting
  - Tax preparation automation
  - Cash flow monitoring
  - Revenue source analysis

**UC-06: Generate Revenue Reports**
- **Actor**: Management, Accountants
- **Purpose**: Analyze income by source, type, and time period
- **Business Value**: Data-driven business decisions, trend identification

##### Data Requirements
- Source identifier (customer/client)
- Income classification (sales/service/interest)
- Payment details (method, date, transaction ID)
- Category tags for reporting
- Timestamps with timezone support

---

#### 2.3 Expense Management

##### Use Cases

**UC-07: Record Business Expense**
- **Actor**: Department Heads, Finance Team
- **Business Problem**: Organizations must track all expenses to control costs, manage budgets, and ensure proper cash flow management
- **Flow**:
  1. User navigates to Finance → Expenses
  2. User clicks "Record Expense"
  3. User enters:
     - Amount
     - Expense type (operational/salary/utilities/maintenance/other)
     - Vendor name
     - Transaction ID
     - Payment method
     - Payment recipient
     - Expense reason
     - Additional notes
  4. System validates against budget (if applicable)
  5. System records expense
  6. System updates expense totals
- **Business Value**:
  - Spend visibility and control
  - Budget adherence monitoring
  - Vendor payment tracking
  - Tax deduction documentation
  - Cost optimization insights

**UC-08: Budget Compliance Monitoring**
- **Actor**: Finance Controller
- **Purpose**: Ensure expenses stay within allocated budgets
- **Business Value**: Prevents overspending, enables proactive financial management

##### Data Requirements
- Vendor information
- Expense categorization
- Payment recipient details
- Budget allocation linkage (future)
- Receipt/invoice attachment (future)
- Approval workflow status (future)

---

### 3. User Management Module

#### Purpose
Comprehensive user administration system for managing team members, roles, and permissions.

#### Use Cases

**UC-09: Create User Account**
- **Actor**: HR Manager, System Administrator
- **Business Problem**: Organizations need to onboard new employees with appropriate system access
- **Flow**:
  1. Admin navigates to Users
  2. Admin clicks "Create User"
  3. Admin enters:
     - Full name
     - Email address
     - Role/designation
     - Department
     - Supervisor
     - Module access permissions
  4. System validates email uniqueness
  5. System generates temporary password
  6. System sends welcome email
  7. System creates user profile
- **Business Value**:
  - Streamlined onboarding
  - Controlled access provisioning
  - Audit trail of user creation
  - Reduced IT overhead

**UC-10: Manage Module Access**
- **Actor**: System Administrator
- **Business Problem**: Different roles require different system access levels
- **Purpose**: Grant/revoke access to specific modules per user
- **Business Value**: Security, data privacy, role-based access control

**UC-11: View User Details**
- **Actor**: HR Manager, Direct Supervisors
- **Purpose**: Access comprehensive user profile including:
  - Personal information
  - Assigned modules
  - Activity history
  - Performance metrics (future)
- **Business Value**: Centralized employee information management

**UC-12: Deactivate User Account**
- **Actor**: HR Manager, Administrator
- **Business Problem**: When employees leave, their access must be revoked while preserving historical data
- **Purpose**: Maintain data integrity while ensuring security
- **Business Value**: Compliance, security, data retention

##### Data Requirements
- User profile (name, email, role, department)
- Module access permissions (boolean flags)
- Account status (active/inactive)
- Supervisor hierarchy
- Timestamps (created, last_login, deactivated)
- Activity audit log

---

### 4. Profile Management

#### Use Cases

**UC-13: Update Personal Information**
- **Actor**: All authenticated users
- **Purpose**: Users can manage their own profile data
- **Business Value**: Data accuracy, user autonomy

**UC-14: Change Password**
- **Actor**: All authenticated users
- **Purpose**: Security maintenance
- **Business Value**: Account security, compliance

---

## Database Schema Requirements

### Authentication Schema

```sql
-- Supabase Auth Schema (built-in)
auth.users
  - id (uuid, PK)
  - email (text, unique)
  - encrypted_password (text)
  - email_confirmed_at (timestamp)
  - created_at (timestamp)
  - updated_at (timestamp)
```

### Application Schema

#### users Table
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL,
  department text,
  supervisor_id uuid REFERENCES users(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_supervisor ON users(supervisor_id);
CREATE INDEX idx_users_active ON users(is_active);
```

#### user_module_access Table
```sql
CREATE TABLE user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  has_access boolean DEFAULT false,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_name)
);

-- Indexes
CREATE INDEX idx_module_access_user ON user_module_access(user_id);
```

#### contributions Table
```sql
CREATE TABLE contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  contribution_type text NOT NULL CHECK (contribution_type IN ('investment', 'capital', 'loan', 'other')),
  reason text NOT NULL,
  transaction_id text UNIQUE NOT NULL,
  payment_to text NOT NULL CHECK (payment_to IN ('organization_bank', 'other_bank_account')),
  paid_to_user text,
  payment_date date NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'upi', 'cheque', 'card')),
  description text,
  category text,
  recorded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_contributions_date ON contributions(payment_date DESC);
CREATE INDEX idx_contributions_type ON contributions(contribution_type);
CREATE INDEX idx_contributions_transaction ON contributions(transaction_id);
```

#### income Table
```sql
CREATE TABLE income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  source text NOT NULL,
  income_type text NOT NULL CHECK (income_type IN ('sales', 'service', 'interest', 'other')),
  reason text NOT NULL,
  transaction_id text UNIQUE NOT NULL,
  payment_to text NOT NULL CHECK (payment_to IN ('organization_bank', 'other_bank_account')),
  paid_to_user text,
  payment_date date NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'upi', 'cheque', 'card')),
  description text,
  category text,
  recorded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_income_date ON income(payment_date DESC);
CREATE INDEX idx_income_type ON income(income_type);
CREATE INDEX idx_income_source ON income(source);
```

#### expenses Table
```sql
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  expense_type text NOT NULL CHECK (expense_type IN ('operational', 'salary', 'utilities', 'maintenance', 'other')),
  vendor text,
  reason text NOT NULL,
  transaction_id text UNIQUE NOT NULL,
  payment_to text NOT NULL CHECK (payment_to IN ('organization_bank', 'other_bank_account')),
  paid_to_user text,
  payment_date date NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'upi', 'cheque', 'card')),
  description text,
  category text,
  recorded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_expenses_date ON expenses(payment_date DESC);
CREATE INDEX idx_expenses_type ON expenses(expense_type);
CREATE INDEX idx_expenses_vendor ON expenses(vendor);
```

### Row Level Security (RLS) Policies

#### users Table RLS
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- Admins can view all users
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Admins can insert users
CREATE POLICY "Admins can create users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Users can update own profile, admins can update any
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);
```

#### Finance Tables RLS
```sql
-- contributions, income, expenses tables
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Users with finance module access can view
CREATE POLICY "Finance users can view contributions"
  ON contributions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'finance'
      AND uma.has_access = true
    )
  );

-- Similar policies for income and expenses

-- Finance users can insert records
CREATE POLICY "Finance users can create contributions"
  ON contributions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_access uma
      JOIN users u ON uma.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uma.module_name = 'finance'
      AND uma.has_access = true
    )
  );
```

---

## API Requirements

### Supabase Client Setup

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### API Endpoints (Auto-generated by Supabase)

#### Authentication Endpoints
```typescript
// Sign In
POST /auth/v1/token?grant_type=password
Body: { email, password }
Response: { access_token, refresh_token, user }

// Sign Out
POST /auth/v1/logout
Headers: { Authorization: Bearer <token> }

// Get Current User
GET /auth/v1/user
Headers: { Authorization: Bearer <token> }
Response: { user }
```

#### User Management Endpoints
```typescript
// Get All Users
GET /rest/v1/users?select=*
Headers: { Authorization, apikey }
Response: User[]

// Get User by ID
GET /rest/v1/users?id=eq.{uuid}&select=*
Response: User

// Create User
POST /rest/v1/users
Body: { full_name, email, role, department }
Response: User

// Update User
PATCH /rest/v1/users?id=eq.{uuid}
Body: { full_name, email, role }
Response: User

// Delete User
DELETE /rest/v1/users?id=eq.{uuid}
```

#### Finance Endpoints
```typescript
// Get Contributions
GET /rest/v1/contributions?select=*&order=payment_date.desc
Response: Contribution[]

// Create Contribution
POST /rest/v1/contributions
Body: ContributionEntry
Response: Contribution

// Get Income
GET /rest/v1/income?select=*&order=payment_date.desc
Response: Income[]

// Create Income
POST /rest/v1/income
Body: IncomeEntry
Response: Income

// Get Expenses
GET /rest/v1/expenses?select=*&order=payment_date.desc
Response: Expense[]

// Create Expense
POST /rest/v1/expenses
Body: ExpenseEntry
Response: Expense
```

#### Module Access Endpoints
```typescript
// Get User Module Access
GET /rest/v1/user_module_access?user_id=eq.{uuid}&select=*
Response: ModuleAccess[]

// Grant Module Access
POST /rest/v1/user_module_access
Body: { user_id, module_name, has_access }
Response: ModuleAccess

// Update Module Access
PATCH /rest/v1/user_module_access?id=eq.{uuid}
Body: { has_access }
Response: ModuleAccess
```

### API Response Formats

#### Success Response
```json
{
  "data": [...],
  "status": 200,
  "statusText": "OK"
}
```

#### Error Response
```json
{
  "error": {
    "message": "Error description",
    "code": "error_code"
  },
  "status": 400
}
```

### Real-time Subscriptions (Future Implementation)
```typescript
// Subscribe to contributions changes
const subscription = supabase
  .channel('contributions-changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'contributions' },
    (payload) => {
      console.log('Change received!', payload);
    }
  )
  .subscribe();
```

---

## Setup & Installation

### Prerequisites
- Node.js 18+ and npm 9+
- Supabase account and project
- Git

### Environment Setup

1. **Clone Repository**
```bash
git clone <repository-url>
cd matvoni-insider
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure Environment Variables**
Create `.env` file in project root:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Database Setup**
- Access Supabase dashboard
- Run database migrations (SQL scripts provided in Database Schema section)
- Enable Row Level Security on all tables
- Configure authentication providers

5. **Run Development Server**
```bash
npm run dev
```
Application runs on `http://localhost:5173`

6. **Build for Production**
```bash
npm run build
```

7. **Preview Production Build**
```bash
npm run preview
```

### Demo Credentials
```
Email: admin@matvoni.com
Password: admin123
```
*Note: Replace with Supabase Auth in production*

---

## Component Documentation

### Layout Components

#### AppLayout.tsx
**Purpose**: Main application wrapper providing consistent layout structure

**Props**: None

**Features**:
- Responsive sidebar navigation
- Mobile-friendly header with hamburger menu
- Page routing logic
- Persistent navigation state

**Usage**:
```typescript
<AppLayout>
  {/* Page content rendered based on active route */}
</AppLayout>
```

---

#### Sidebar.tsx
**Purpose**: Desktop navigation menu

**Props**:
```typescript
interface SidebarProps {
  activePage: PageType;
  onNavigate: (page: PageType) => void;
}
```

**Features**:
- Vertical navigation menu
- Active route highlighting
- Logout functionality
- Responsive collapse on mobile

---

#### Header.tsx
**Purpose**: Mobile navigation and user actions

**Props**:
```typescript
interface HeaderProps {
  onNavigate: (page: PageType) => void;
  onLogout: () => void;
}
```

**Features**:
- Hamburger menu toggle
- User profile quick access
- Logout button
- Mobile-responsive design

---

### Form Components

#### ContributionForm.tsx
**Purpose**: Record capital contributions

**Props**:
```typescript
interface ContributionFormProps {
  onSubmit: (data: ContributionEntry) => void;
  onCancel: () => void;
}
```

**Validation Rules**:
- Amount: Required, positive number
- Transaction ID: Required, unique
- Date: Required, not future date
- Payment method: Required selection

**Fields**:
- Amount (decimal)
- Contribution Type (select)
- Transaction ID (text)
- Payment Method (select)
- Payment Destination (select)
- Payment Date (date picker)
- Reason (textarea)
- Description (textarea, optional)

---

#### IncomeForm.tsx
**Purpose**: Record revenue transactions

**Props**:
```typescript
interface IncomeFormProps {
  onSubmit: (data: IncomeEntry) => void;
  onCancel: () => void;
}
```

**Validation Rules**:
- Amount: Required, positive
- Source: Required, min 2 characters
- Income Type: Required selection
- Transaction ID: Required, unique

**Fields**:
- Amount (decimal)
- Income Source (text)
- Income Type (select)
- Transaction ID (text)
- Payment Method (select)
- Payment Date (date picker)
- Reason (textarea)
- Category (text, optional)

---

#### ExpenseForm.tsx
**Purpose**: Record business expenses

**Props**:
```typescript
interface ExpenseFormProps {
  onSubmit: (data: ExpenseEntry) => void;
  onCancel: () => void;
}
```

**Validation Rules**:
- Amount: Required, positive
- Expense Type: Required selection
- Transaction ID: Required, unique

**Fields**:
- Amount (decimal)
- Expense Type (select)
- Vendor Name (text, optional)
- Transaction ID (text)
- Payment Method (select)
- Payment Recipient (text)
- Payment Date (date picker)
- Reason (textarea)
- Description (textarea, optional)

---

### Modal Components

#### CreateUserModal.tsx
**Purpose**: User account creation interface

**Props**:
```typescript
interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: UserData) => void;
}
```

**Features**:
- Form validation
- Email uniqueness check (future)
- Role assignment
- Department selection
- Module access assignment

---

#### ModuleAccessModal.tsx
**Purpose**: Manage user permissions for modules

**Props**:
```typescript
interface ModuleAccessModalProps {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onSave: (moduleAccess: ModuleAccess[]) => void;
}
```

**Features**:
- Checkbox-based permission selection
- Bulk grant/revoke
- Real-time permission updates

---

### Page Components

#### Dashboard.tsx
**Purpose**: Landing page with module overview

**State Management**:
- Module grid state
- Toast notifications
- Navigation handling

**Features**:
- Responsive grid layout
- Module availability status
- Quick navigation to active modules

---

#### Finance.tsx
**Purpose**: Finance module hub

**State Management**:
- Active section (contributions/income/expenses)
- Section navigation
- Shared state with child components

**Features**:
- Tab-based section switching
- Summary cards with totals
- Unified finance interface

---

#### Contributions.tsx, Income.tsx, Expenses.tsx
**Purpose**: Finance sub-modules for specific transaction types

**State Management**:
- Transaction list state
- Form modal state (create/edit)
- Loading and error states

**Features**:
- Data table with sorting
- Create/Edit/Delete operations
- Search and filter (future)
- Export to CSV (future)

---

#### Users.tsx
**Purpose**: User management interface

**State Management**:
- User list state
- Selected user for detail view
- Modal states

**Features**:
- User list with search
- Create new user
- View user details
- Manage module access

---

#### UserDetail.tsx
**Purpose**: Individual user management

**Props**:
```typescript
interface UserDetailProps {
  userId: string;
  onBack: () => void;
}
```

**Features**:
- User information display
- Edit user details
- Manage module permissions
- View activity history (future)
- Deactivate account

---

## Authentication & Authorization

### Current Implementation (Demo Mode)

#### AuthContext.tsx
**Purpose**: Global authentication state management

**State**:
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => boolean;
  signOut: () => void;
}
```

**Demo Credentials**:
- Email: admin@matvoni.com
- Password: admin123

**Storage**: localStorage (temporary)

---

### Required Supabase Auth Implementation

#### Authentication Flow
```
1. User enters credentials
   ↓
2. Frontend sends to Supabase Auth
   ↓
3. Supabase validates credentials
   ↓
4. Returns JWT access token + refresh token
   ↓
5. Frontend stores tokens (httpOnly cookies recommended)
   ↓
6. Include token in all API requests
   ↓
7. Supabase validates token + RLS policies
   ↓
8. Returns authorized data
```

#### Implementation Code
```typescript
// Sign In
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Get Current Session
const { data: { session } } = await supabase.auth.getSession();

// Sign Out
await supabase.auth.signOut();

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // Handle sign in
  }
  if (event === 'SIGNED_OUT') {
    // Handle sign out
  }
});
```

---

### Authorization Levels

#### Role-Based Access Control (RBAC)

**Admin Role**
- Full system access
- User management (CRUD)
- Module access management
- All finance operations
- System configuration

**Finance Manager Role**
- Full finance module access
- Create/edit/delete transactions
- Generate reports
- View user list (read-only)

**Department Head Role**
- View finance reports (limited)
- View team members
- Update own profile

**Employee Role**
- View own profile
- Update own information
- Limited module access based on assignment

#### Module-Level Permissions
```typescript
interface ModulePermission {
  module: 'finance' | 'inventory' | 'sales' | 'analytics' | 'documents';
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}
```

---

## State Management

### Global State (Context API)

#### AuthContext
- User session
- Authentication status
- User profile
- Permissions

**Usage**:
```typescript
const { user, loading, signIn, signOut } = useAuth();
```

---

### Local Component State

#### useState Pattern
```typescript
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

#### useEffect for Data Fetching
```typescript
useEffect(() => {
  async function fetchData() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('table')
        .select('*');

      if (error) throw error;
      setData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  fetchData();
}, [dependencies]);
```

---

### Future State Management Considerations

#### When to Use Redux/Zustand
- More than 5 global states
- Complex state interactions
- Time-travel debugging needed
- State persistence requirements

#### When to Use React Query
- Heavy data fetching
- Real-time data synchronization
- Automatic cache management
- Background refetching

---

## Development Guidelines

### Code Style Standards

#### TypeScript
- Strict mode enabled
- Explicit return types for functions
- Interface over type for object shapes
- Avoid `any` type

**Example**:
```typescript
// Good
interface User {
  id: string;
  name: string;
}

function getUser(id: string): Promise<User | null> {
  // Implementation
}

// Avoid
function getUser(id: any): any {
  // Implementation
}
```

---

#### Component Structure
```typescript
// 1. Imports
import { useState } from 'react';
import { ComponentName } from './Component';

// 2. Types/Interfaces
interface Props {
  data: DataType;
}

// 3. Component
export function MyComponent({ data }: Props) {
  // 4. Hooks
  const [state, setState] = useState();

  // 5. Effects
  useEffect(() => {}, []);

  // 6. Handlers
  const handleClick = () => {};

  // 7. Render
  return <div>...</div>;
}
```

---

#### Naming Conventions

**Components**: PascalCase
```typescript
export function UserProfile() {}
```

**Functions/Variables**: camelCase
```typescript
const handleSubmit = () => {};
const userData = {};
```

**Constants**: UPPER_SNAKE_CASE
```typescript
const MAX_RETRY_ATTEMPTS = 3;
```

**Files**:
- Components: PascalCase (UserProfile.tsx)
- Utilities: camelCase (dateHelpers.ts)
- Types: camelCase (financeTypes.ts)

---

### Git Workflow

#### Branch Naming
```
feature/user-management
bugfix/login-validation
hotfix/security-patch
refactor/component-structure
```

#### Commit Messages
```
feat: Add expense filtering functionality
fix: Resolve date picker timezone issue
refactor: Extract form validation logic
docs: Update API documentation
test: Add unit tests for finance calculations
```

---

### Testing Strategy (Future Implementation)

#### Unit Tests
- Utility functions
- Custom hooks
- Validation logic
- Calculations

#### Integration Tests
- Component interactions
- Form submissions
- API calls
- Navigation flows

#### E2E Tests
- Critical user journeys
- Authentication flow
- Finance transaction workflow
- User management operations

**Recommended Tools**:
- Vitest (unit tests)
- React Testing Library (component tests)
- Playwright (E2E tests)

---

## Deployment Considerations

### Build Optimization
```bash
npm run build
```

**Optimization Checklist**:
- [ ] Tree shaking enabled
- [ ] Code splitting configured
- [ ] Asset compression
- [ ] Environment variables set
- [ ] Source maps for production debugging

---

### Hosting Options

#### Recommended: Vercel
**Pros**:
- Automatic deployments from Git
- Edge network CDN
- Preview deployments
- Zero configuration

**Setup**:
1. Connect Git repository
2. Configure build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables

#### Alternative: Netlify
Similar benefits to Vercel with additional features:
- Form handling
- Serverless functions
- Split testing

#### Traditional: AWS S3 + CloudFront
**Pros**:
- Full control
- Cost-effective at scale
- Enterprise-grade security

---

### Environment Variables

#### Development (.env.local)
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=local_dev_key
VITE_API_BASE_URL=http://localhost:3000
```

#### Production (.env.production)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key
VITE_API_BASE_URL=https://api.matvoni.com
```

---

### Performance Monitoring

#### Recommended Tools
- **Sentry**: Error tracking and performance monitoring
- **Google Analytics**: User behavior analytics
- **Web Vitals**: Core Web Vitals tracking
- **Lighthouse CI**: Continuous performance audits

---

### Security Checklist

#### Frontend Security
- [ ] No secrets in frontend code
- [ ] XSS prevention (React handles by default)
- [ ] CSRF protection
- [ ] Content Security Policy headers
- [ ] HTTPS only
- [ ] Secure cookie flags

#### Backend Security (Supabase)
- [ ] Row Level Security enabled on all tables
- [ ] API keys secured
- [ ] Rate limiting configured
- [ ] SQL injection prevention (parameterized queries)
- [ ] Regular security audits

---

## Backend Development Integration

### API Contract

Backend developers should implement endpoints matching the Supabase REST API structure documented in the [API Requirements](#api-requirements) section.

### Authentication Token Handling

**Request Headers**:
```
Authorization: Bearer <jwt_token>
apikey: <supabase_anon_key>
Content-Type: application/json
```

**Token Payload**:
```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "iat": 1234567890,
  "exp": 1234571490
}
```

---

### Error Handling Contract

Backend should return consistent error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Amount must be a positive number",
    "details": {
      "field": "amount",
      "value": -100
    }
  },
  "status": 400
}
```

**Standard Error Codes**:
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409) - Duplicate transaction ID
- `INTERNAL_ERROR` (500)

---

### Data Validation Rules

Backend must enforce:
1. **Amount fields**: Positive numbers, 2 decimal places
2. **Transaction IDs**: Unique, alphanumeric, 6-50 characters
3. **Dates**: ISO 8601 format, not future dates (for historical records)
4. **Enums**: Strict validation against allowed values
5. **Email**: RFC 5322 compliant
6. **UUIDs**: Valid UUID v4 format

---

### Real-time Requirements

For future real-time features, backend should support:
- WebSocket connections for live updates
- Optimistic UI update patterns
- Conflict resolution for concurrent edits
- Event streaming for audit logs

---

## Future Enhancements

### Phase 2 Features
- [ ] Advanced reporting and analytics
- [ ] Data export (CSV, PDF, Excel)
- [ ] Budget management module
- [ ] Approval workflows
- [ ] Email notifications
- [ ] Document attachment support
- [ ] Multi-currency support

### Phase 3 Features
- [ ] Mobile application (React Native)
- [ ] Inventory management module
- [ ] Sales tracking module
- [ ] Integration with accounting software
- [ ] API for third-party integrations
- [ ] Advanced role-based permissions
- [ ] Multi-tenant support

---

## Support & Maintenance

### Documentation Updates
This README should be updated whenever:
- New features are added
- API contracts change
- Database schema is modified
- Authentication flow changes
- Deployment process changes

### Version Control
Follow semantic versioning: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

---

## License
[Specify License]

---

## Contact
For questions or support:
- **Technical Lead**: [Name] - [Email]
- **Product Owner**: [Name] - [Email]
- **Project Repository**: [GitHub URL]

---

**Last Updated**: 2024-12-23
**Version**: 1.0.0
**Status**: MVP - Active Development
