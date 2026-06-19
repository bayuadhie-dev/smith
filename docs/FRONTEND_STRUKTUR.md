# DOKUMENTASI FRONTEND - Struktur & Komponen

## Daftar Isi
1. [Arsitektur Frontend](#arsitektur-frontend)
2. [Struktur Folder](#struktur-folder)
3. [Routing](#routing)
4. [State Management](#state-management)
5. [API Integration](#api-integration)
6. [Komponen Utama](#komponen-utama)
7. [Pages](#pages)
8. [Hooks](#hooks)
9. [Utils](#utils)

---

## Arsitektur Frontend

### Tech Stack:
- **React 18** - UI Library
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Redux Toolkit** - State management
- **React Router v6** - Routing
- **Axios** - HTTP client
- **Tailwind CSS** - Styling
- **Socket.IO Client** - Real-time communication
- **React Query** - Data fetching (optional)
- **Recharts** - Charts & graphs
- **React Hook Form** - Form handling
- **Zod** - Schema validation

### Design Patterns:
- **Component-based architecture**
- **Container/Presentational pattern**
- **Custom Hooks** untuk logic reuse
- **Context API** untuk theme & language
- **Redux Toolkit** untuk global state

---

## Struktur Folder

```
frontend/src/
├── components/          # Reusable components
│   ├── Common/         # Common UI components
│   ├── Layout/         # Layout components
│   ├── Production/     # Production-specific components
│   ├── Warehouse/      # Warehouse-specific components
│   └── ui/            # shadcn/ui components
├── pages/              # Page components (routes)
│   ├── Auth/          # Login, Register
│   ├── Dashboard/     # Dashboard pages
│   ├── Production/    # Production module pages
│   └── ...
├── services/          # API service layer
├── store/             # Redux store & slices
├── hooks/             # Custom React hooks
├── contexts/          # React Context providers
```
├── utils/             # Utility functions
├── styles/            # Global styles
├── config/            # Configuration
├── locales/           # i18n translations
└── tests/             # Test files

---

## Routing

### Main Routes (`App.tsx`):

```typescript
/                       → Landing Page (public)
/login                  → Login Page (public)
/register               → Register Page (public)
/dashboard              → Main Dashboard (protected)
/production/*           → Production Module (protected)
/warehouse/*            → Warehouse Module (protected)
/sales/*                → Sales Module (protected)
/purchasing/*           → Purchasing Module (protected)
/finance/*              → Finance Module (protected)
/hr/*                   → HR Module (protected)
/quality/*              → Quality Module (protected)
/maintenance/*          → Maintenance Module (protected)
/reports/*              → Reports Module (protected)
/settings/*             → Settings Module (protected)
/profile                → User Profile (protected)
```

### Route Protection:

```typescript
// ProtectedRoute component
<ProtectedRoute>
  <Component />
</ProtectedRoute>

// With permission check
<ProtectedRoute permission="production:view">
  <ProductionPage />
</ProtectedRoute>
```

---

## State Management

### Redux Store Structure:

```typescript
store/
├── index.ts           # Store configuration
├── api.ts             # RTK Query API
└── slices/
    ├── authSlice.ts   # Authentication state
    ├── uiSlice.ts     # UI state (sidebar, theme)
    ├── productionSlice.ts
    ├── warehouseSlice.ts
    └── ...
```

### Auth Slice (`store/slices/authSlice.ts`):

```typescript
interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  roles: string[]
  permissions: string[]
}
```

**Actions**:
- `login(credentials)` - Login user
- `logout()` - Logout user
- `refreshToken()` - Refresh access token
- `setUser(user)` - Set user data

### UI Slice (`store/slices/uiSlice.ts`):

```typescript
interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  language: 'id' | 'en'
  notifications: Notification[]
}
```

**Actions**:
- `toggleSidebar()`
- `setTheme(theme)`
- `setLanguage(language)`
- `addNotification(notification)`

---

## API Integration

### API Service (`services/api.ts`):

```typescript
// Base Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor (add auth token)
api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor (handle errors, refresh token)
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Refresh token logic
      // Redirect to login if refresh fails
    }
    return Promise.reject(error)
  }
)
```

### API Functions:

```typescript
// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refreshToken: (token) => api.post('/auth/refresh', { token })
}

// Products API
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`)
}

// Production API
export const productionAPI = {
  getWorkOrders: (params) => api.get('/production/work-orders', { params }),
  createWorkOrder: (data) => api.post('/production/work-orders', data),
  getShiftProductions: (params) => api.get('/production/shift-production', { params }),
  createShiftProduction: (data) => api.post('/production/shift-production', data)
}
```

---

## Komponen Utama

### 1. Layout Components

#### `Layout.tsx`
```typescript
/**
 * Main layout dengan sidebar dan header
 * Props:
 *   - children: React.ReactNode
 */
function Layout({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

#### `Sidebar.tsx`
```typescript
/**
 * Sidebar navigation
 * Features:
 *   - Collapsible
 *   - Role-based menu items
 *   - Active route highlighting
 */
```

#### `Header.tsx`
```typescript
/**
 * Header dengan user menu, notifications, language switcher
 * Components:
 *   - NotificationBell
 *   - LanguageSwitcher
 *   - UserMenu
 */
```

### 2. Common Components

#### `DataTable.tsx`
```typescript
/**
 * Reusable data table dengan sorting, filtering, pagination
 * Props:
 *   - columns: Column[]
 *   - data: any[]
 *   - onSort?: (column, direction) => void
 *   - onFilter?: (filters) => void
 *   - pagination?: PaginationProps
 */
```

#### `Modal.tsx`
```typescript
/**
 * Modal dialog
 * Props:
 *   - isOpen: boolean
 *   - onClose: () => void
 *   - title: string
 *   - children: React.ReactNode
 *   - size?: 'sm' | 'md' | 'lg' | 'xl'
 */
```

#### `Form Components`
```typescript
// Input.tsx
interface InputProps {
  label: string
  name: string
  type?: string
  error?: string
  register?: UseFormRegister<any>
  placeholder?: string
  disabled?: boolean
}

// Select.tsx
interface SelectProps {
  label: string
  name: string
  options: { value: any, label: string }[]
  error?: string
  register?: UseFormRegister<any>
}

// DatePicker.tsx
// TextArea.tsx
// Checkbox.tsx
// Radio.tsx
```

#### `SearchableSelect.tsx`
```typescript
/**
 * Searchable dropdown select dengan autocomplete
 * Props:
 *   - options: Option[]
 *   - value: any
 *   - onChange: (value) => void
 *   - searchable?: boolean
 *   - clearable?: boolean
 */
```

### 3. Production Components

#### `ShiftProductionForm.tsx`
```typescript
/**
 * Form untuk input produksi per shift
 * Props:
 *   - onSubmit: (data) => void
 *   - initialData?: ShiftProduction
 *   - machines: Machine[]
 *   - products: Product[]
 */
```

#### `OEECard.tsx`
```typescript
/**
 * Card display OEE metrics
 * Props:
 *   - oeeScore: number
 *   - availability: number
 *   - performance: number
 *   - quality: number
 *   - trend?: 'up' | 'down' | 'stable'
 */
```

#### `DowntimeChart.tsx`
```typescript
/**
 * Chart downtime breakdown by category
 * Props:
 *   - data: DowntimeData[]
 *   - chartType?: 'bar' | 'pie' | 'line'
 */
```

---

## Pages

### Production Pages (`pages/Production/`)

#### `ProductionDashboard.tsx`
- **Path**: `/production`
- **Deskripsi**: Dashboard overview produksi
- **Components**:
  - Production summary cards (today, this week, this month)
  - OEE trends chart
  - Machine status grid
  - Recent work orders table
  - Active shift productions

#### `WorkOrderList.tsx`
- **Path**: `/production/work-orders`
- **Deskripsi**: List semua work orders
- **Features**:
  - Filter by status, machine, date range
  - Search by WO number or product
  - Bulk actions (release, cancel)
  - Export to Excel

#### `WorkOrderDetail.tsx`
- **Path**: `/production/work-orders/:id`
- **Deskripsi**: Detail work order
- **Sections**:
  - WO Information
  - Product details & BOM
  - Material requirements & availability
  - Production records
  - Status history
  - Actions (start, complete, cancel)

#### `ShiftProductionInput.tsx`
- **Path**: `/production/shift-input`
- **Deskripsi**: Input produksi per shift
- **Features**:
  - Date & shift selector
  - Machine & product selection
  - Quantity inputs (target, actual, good, reject)
  - Downtime recording by category
  - Real-time OEE calculation
  - Early stop & operator reassignment

#### `ProductionMonitoring.tsx`
- **Path**: `/production/monitoring`
- **Deskripsi**: Real-time production monitoring
- **Features**:
  - Live machine status grid
  - Current shift productions
  - Real-time OEE updates
  - Downtime alerts
  - WebSocket integration

#### `WeeklyPlan.tsx`
- **Path**: `/production/weekly-plan`
- **Deskripsi**: Weekly production planning
- **Features**:
  - Week selector (calendar)
  - Product targets per machine
  - Daily breakdown
  - Generate work orders from plan

---

### Dashboard Pages (`pages/Dashboard/`)

#### `MainDashboard.tsx`
- **Path**: `/dashboard`
- **Deskripsi**: Main dashboard (role-based)
- **Widgets**:
  - Production summary
  - Sales summary
  - Inventory alerts
  - Recent activities
  - Quick actions

#### `ExecutiveDashboard.tsx`
- **Path**: `/dashboard/executive`
- **Deskripsi**: Executive dashboard
- **Widgets**:
  - KPI cards (OEE, delivery, quality)
  - Trend charts (production, sales, costs)
  - Top products
  - Critical issues

---

### Warehouse Pages (`pages/Warehouse/`)

#### `InventoryList.tsx`
- **Path**: `/warehouse/inventory`
- **Features**:
  - Stock levels dengan alerts (low stock)
  - Filter by warehouse, category
  - Search by code/name
  - Stock movements

#### `StockOpname.tsx`
- **Path**: `/warehouse/stock-opname`
- **Features**:
  - Start new opname session
  - Record physical counts
  - Variance analysis
  - Generate adjustments

---

## Hooks

### Custom Hooks (`hooks/`)

#### `useAuth.ts`
```typescript
/**
 * Hook untuk authentication
 * Returns:
 *   - user: User | null
 *   - isAuthenticated: boolean
 *   - login: (credentials) => Promise
 *   - logout: () => void
 *   - checkPermission: (permission) => boolean
 */
```

#### `useApi.ts`
```typescript
/**
 * Hook untuk API calls dengan loading & error state
 * Returns:
 *   - data: T | null
 *   - loading: boolean
 *   - error: Error | null
 *   - refetch: () => void
 */
```

#### `useDebounce.ts`
```typescript
/**
 * Hook untuk debounce value
 * Params:
 *   - value: T
 *   - delay: number (ms)
 * Returns: T (debounced value)
 */
```

#### `useTranslation.ts`
```typescript
/**
 * Hook untuk i18n translation
 * Returns:
 *   - t: (key: string) => string
 *   - language: 'id' | 'en'
 *   - changeLanguage: (lang) => void
 */
```

#### `useChatSocket.ts`
```typescript
/**
 * Hook untuk Socket.IO chat
 * Returns:
 *   - socket: Socket
 *   - messages: Message[]
 *   - sendMessage: (message) => void
 *   - joinRoom: (room) => void
 *   - leaveRoom: (room) => void
 */
```

---

## Utils

### Utility Functions (`utils/`)

#### `apiConfig.ts`
```typescript
// API base URL & endpoints configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    // ...
  },
  production: {
    workOrders: '/production/work-orders',
    // ...
  }
}
```

#### `formatters.ts`
```typescript
// Date, number, currency formatters
export const formatDate = (date: string | Date) => string
export const formatNumber = (num: number) => string
export const formatCurrency = (amount: number) => string
export const formatPercentage = (value: number) => string
```

#### `validators.ts`
```typescript
// Form validation helpers
export const validateEmail = (email: string) => boolean
export const validatePhone = (phone: string) => boolean
export const validateRequired = (value: any) => boolean
```

#### `exportUtils.ts`
```typescript
// Export data to Excel, PDF
export const exportToExcel = (data: any[], filename: string) => void
export const exportToPDF = (data: any[], filename: string) => void
```

---

## Contexts

### Theme Context (`contexts/ThemeContext.tsx`)
```typescript
interface ThemeContextType {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}
```

### Language Context (`contexts/LanguageContext.tsx`)
```typescript
interface LanguageContextType {
  language: 'id' | 'en'
  changeLanguage: (lang: 'id' | 'en') => void
  t: (key: string) => string
}
```

### Permission Context (`contexts/PermissionContext.tsx`)
```typescript
interface PermissionContextType {
  permissions: string[]
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
}
```

---

