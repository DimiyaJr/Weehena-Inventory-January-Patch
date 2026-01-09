import React, { useEffect, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AuthRedirector } from './components/AuthRedirector'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'

// Lazy-loaded components
const Layout = React.lazy(() => import('./components/Layout').then(module => ({ default: module.Layout })))
const Login = React.lazy(() => import('./components/Login').then(module => ({ default: module.Login })))
const Signup = React.lazy(() => import('./components/Signup').then(module => ({ default: module.Signup })))
// Dashboard component removed
const Inventory = React.lazy(() => import('./components/Inventory').then(module => ({ default: module.Inventory })))
const ProductList = React.lazy(() => import('./components/ProductList').then(module => ({ default: module.ProductList })))
const Categories = React.lazy(() => import('./components/Categories').then(module => ({ default: module.Categories })))
const Customers = React.lazy(() => import('./components/Customers').then(module => ({ default: module.Customers })))
const ServiceCustomer = React.lazy(() => import('./components/ServiceCustomer').then(module => ({ default: module.ServiceCustomer })))
const SalesOrders = React.lazy(() => import('./components/SalesOrders').then(module => ({ default: module.SalesOrders })))
const Reports = React.lazy(() => import('./components/Reports').then(module => ({ default: module.Reports })))
const UserManagement = React.lazy(() => import('./components/UserManagement').then(module => ({ default: module.UserManagement })))
const AssignOnDemandProducts = React.lazy(() => import('./components/AssignOnDemandProducts').then(module => ({ default: module.AssignOnDemandProducts })))
const OnDemandOrders = React.lazy(() => import('./components/OnDemandOrders').then(module => ({ default: module.OnDemandOrders })))
const OngoingOnDemandOrders = React.lazy(() => import('./components/OngoingOnDemandOrders').then(module => ({ default: module.OngoingOnDemandOrders }))) // NEW IMPORT
const OnDemandReports = React.lazy(() => import('./components/OnDemandReports').then(module => ({ default: module.OnDemandReports })))
const SecurityCheckIncompleteOrders = React.lazy(() => import('./components/SecurityCheckIncompleteOrders').then(module => ({ default: module.SecurityCheckIncompleteOrders })))
const VehicleManagement = React.lazy(() => import('./components/VehicleManagement').then(module => ({ default: module.VehicleManagement })))
const SystemSettings = React.lazy(() => import('./components/SystemSettings').then(module => ({ default: module.SystemSettings })))
const CustomerAreas = React.lazy(() => import('./components/CustomerAreas').then(module => ({ default: module.CustomerAreas })))
const PaymentInformation = React.lazy(() => import('./components/PaymentInformation').then(module => ({ default: module.PaymentInformation })))
const SalesRepInventory = React.lazy(() => import('./components/SalesRepInventory').then(module => ({ default: module.SalesRepInventory }))) // NEW IMPORT

function App() {
  const { user, loading, connectionError } = useAuth()

  // Debug user object and loading state changes
  useEffect(() => {
    console.log('App.tsx: State changed - user:', user, 'loading:', loading, 'connectionError:', connectionError)
  }, [user, loading, connectionError])

  console.log('App.tsx: Rendering with user:', user, 'loading:', loading)

  // Show loading state while authentication is being determined
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
          <p className="text-sm text-gray-500 mt-2">Connecting to server...</p>
        </div>
      </div>
    )
  }

  // Show connection error if there's an issue with the database
  if (connectionError && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">{connectionError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const redirectIfGuard = (component: JSX.Element) => {
    return user?.role === 'Security Guard'
      ? <Navigate to="/sales-orders" replace />
      : component
  }

  return (
    <Router>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading application...</p>
          </div>
        </div>
      }>
        <Routes>
          {/* Root route - redirect based on authentication */}
          <Route 
            path="/" 
            element={
              user ? (
                user.role === 'Security Guard' ? (
                  <Navigate to="/sales-orders" replace />
                ) : (
                  user.role === 'Finance Admin' ? (
                    <Navigate to="/payment-information" replace /> // Redirect Finance Admin to new section
                  ) : <Navigate to="/sales-orders" replace /> // Updated from /dashboard to /sales-orders
                )
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          {/* Public Routes */}
          <Route
            path="/login"
            element={user ? (
              user.role === 'Security Guard' ? (
                <Navigate to="/sales-orders" replace />
              ) : (
                user.role === 'Finance Admin' ? (
                  <Navigate to="/payment-information" replace />
                ) : <Navigate to="/sales-orders" replace /> // Updated from /dashboard to /sales-orders
              )
            ) : <Login />}
          />
          <Route
            path="/signup"
            element={user ? (
              user.role === 'Security Guard' ? (
                <Navigate to="/sales-orders" replace />
              ) : (
                user.role === 'Finance Admin' ? (
                  <Navigate to="/payment-information" replace />
                ) : <Navigate to="/sales-orders" replace /> // Updated from /dashboard to /sales-orders
              )
            ) : <Signup />}
          />

          {/* Protected Routes with Layout */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard route removed */}
            <Route
              path="inventory"
              element={
                <ErrorBoundary>
                  {/* Modified: Show SalesRepInventory for Sales Reps, regular Inventory for others */}
                  {user?.role === 'Sales Rep' ? <SalesRepInventory /> : <Inventory />}
                </ErrorBoundary>
              }
            />
            <Route
              path="products"
              element={
                <ErrorBoundary>
                  {redirectIfGuard(<ProductList />)}
                </ErrorBoundary>
              }
            />
            <Route
              path="categories"
              element={
                <ErrorBoundary>
                  {redirectIfGuard(<Categories />)}
                </ErrorBoundary>
              }
            />
            <Route
              path="customers"
              element={
                <ErrorBoundary>
                  {redirectIfGuard(<Customers />)}
                </ErrorBoundary>
              }
            />
            <Route
              path="service"
              element={
                <ErrorBoundary>
                  {redirectIfGuard(<ServiceCustomer />)}
                </ErrorBoundary>
              }
            />
            <Route
              path="reports"
              element={
                <ErrorBoundary>
                  <Reports />
                </ErrorBoundary>
              }
            />
            <Route 
              path="sales-orders" 
              element={
                <ErrorBoundary>
                  <SalesOrders />
                </ErrorBoundary>
              } 
            />
            <Route
              path="user-management"
              element={
                <ErrorBoundary>
                  {redirectIfGuard(<UserManagement />)}
                </ErrorBoundary>
              }
            />
            <Route
              path="assign-on-demand"
              element={
                <ErrorBoundary>
                  <AssignOnDemandProducts />
                </ErrorBoundary>
              }
            />
            <Route
              path="on-demand-orders"
              element={
                <ErrorBoundary>
                  {user?.role === 'Admin' || user?.role === 'Super Admin' ? <OnDemandOrders /> : redirectIfGuard(<OnDemandOrders />)}
                </ErrorBoundary>
              }
            />
            <Route
              path="ongoing-on-demand-orders" // NEW ROUTE
              element={
                <ErrorBoundary>
                  {user?.role === 'Sales Rep' || user?.role === 'Admin' || user?.role === 'Super Admin' ? <OngoingOnDemandOrders /> : <Navigate to="/sales-orders" replace />}
                </ErrorBoundary>
              }
            />
            <Route
              path="on-demand-reports"
              element={
                <ErrorBoundary>
                  {redirectIfGuard(<OnDemandReports />)}
                </ErrorBoundary>
              }
            />
            <Route
              path="security-incomplete-orders"
              element={
                <ErrorBoundary>
                  {redirectIfGuard(<SecurityCheckIncompleteOrders />)}
                </ErrorBoundary>
              }
            />
            <Route
              path="vehicle-management"
              element={
                <ErrorBoundary>
                  {redirectIfGuard(<VehicleManagement />)}
                </ErrorBoundary>
              }
            />
            <Route
              path="system-settings"
              element={
                <ErrorBoundary>
                  {user?.role === 'Super Admin' ? <SystemSettings /> : <Navigate to="/sales-orders" replace />}
                </ErrorBoundary>
              }
            />
            <Route
              path="customer-areas" // New route path
              element={
                <ErrorBoundary>
                  {user?.role === 'Super Admin' || user?.role === 'Admin' ? <CustomerAreas /> : <Navigate to="/sales-orders" replace />}
                </ErrorBoundary>
              }
            />
            <Route
              path="payment-information" // New route path
              element={
                <ErrorBoundary>
                  {user?.role === 'Finance Admin' ? <PaymentInformation /> : <Navigate to="/sales-orders" replace />}
                </ErrorBoundary>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App