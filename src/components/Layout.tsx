import React, { useRef, useMemo } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Tag,
  Users, 
  ShoppingCart, 
  BarChart3, 
  LogOut, 
  Menu,
  X,
  Home,
  FileText,
  Shield,
  Clipboard,
  ShoppingBag,
  ClipboardList,
  Car,
  Bell,
  Settings as SettingsIcon,
  MapPin,
  DollarSign,
  Clock, // Added Clock icon
  Key, // ADD import
  HelpCircle // ADD import
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCompanyData } from '../hooks/useCompanyData'
import { supabase } from '../lib/supabase'
import WeehenaLogo from '../assets/images/Weehena Logo(Ai) copy copy copy.png';
import { ChangePasswordModal } from './ChangePasswordModal'; // ADD import
import { ForgotPasswordModal } from './ForgotPasswordModal'; // ADD import

export const Layout: React.FC = () => {
  const { user, logout, isOnline } = useAuth()
  const { companyId } = useCompanyData()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [incompleteOrdersCount, setIncompleteOrdersCount] = React.useState(0)
  const [showNotificationsDropdown, setShowNotificationsDropdown] = React.useState(false)
  const [notificationOrders, setNotificationOrders] = React.useState<any[]>([])
  const [companyName, setCompanyName] = React.useState<string>('')
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false)
  // Add state for modals
  const [showChangePasswordModal, setShowChangePasswordModal] = React.useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = React.useState(false);
  const [resetRequestsCount, setResetRequestsCount] = React.useState(0);

  // Refs for dropdowns
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const notificationDropdownRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  React.useEffect(() => {
    if (companyId) {
      const fetchCompanyName = async () => {
        const { data, error } = await supabase
          .from('companies')
          .select('name')
          .eq('id', companyId)
          .maybeSingle()

        if (error) {
          console.error('Error fetching company name:', error)
        } else if (data) {
          setCompanyName(data.name)
        }
      }

      fetchCompanyName()
    }
  }, [companyId])

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false)
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target as Node)) {
        setShowNotificationsDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Calculate user initials
  const userInitials = useMemo(() => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    }
    return user?.username?.charAt(0).toUpperCase() || 'U'
  }, [user])

  // Wrap close sidebar handler in useCallback
  const handleCloseSidebar = React.useCallback(() => {
    setSidebarOpen(false)
  }, [])

  // Add effect to fetch password reset requests count for Super Admins
  React.useEffect(() => {
    if (user && user.role === 'Super Admin') {
      const fetchResetRequestsCount = async () => {
        const { count, error } = await supabase
          .from('password_reset_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        if (error) {
          console.error('Error fetching reset requests count:', error);
        } else {
          setResetRequestsCount(count || 0);
        }
      };

      fetchResetRequestsCount();

      // Set up Realtime subscription
      const subscription = supabase
        .channel('password_reset_requests')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'password_reset_requests',
            filter: 'status=eq.pending',
          },
          (payload) => {
            console.log('Password reset request change:', payload);
            fetchResetRequestsCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [user]);

  const getNavigation = () => {
    // Define common navigation items
    const commonNav = [
      { name: 'Sales Orders', href: '/sales-orders', icon: FileText },
    ];

    // Define role-specific navigation items
    switch (user?.role) {
      case 'Super Admin':
        return [
          ...commonNav,
          { name: 'Master Inventory', href: '/inventory', icon: ShoppingBag },
          { name: 'Product List', href: '/products', icon: ClipboardList },
          { name: 'Categories', href: '/categories', icon: Tag },
          { name: 'Customers', href: '/customers', icon: Users },
          { name: 'Customer Areas', href: '/customer-areas', icon: MapPin },
          { name: 'Service Customer', href: '/service', icon: ShoppingCart },
          { name: 'On Demand Assignments', href: '/assign-on-demand', icon: Clipboard },
          { name: 'On Demand Orders', href: '/on-demand-orders', icon: Clipboard },
          { name: 'Ongoing On-Demand Orders', href: '/ongoing-on-demand-orders', icon: Clock },
          { name: 'Reports', href: '/reports', icon: BarChart3 },
          { name: 'Manage Users', href: '/user-management', icon: Shield },
          { name: 'Password Reset Requests', href: '/password-reset-requests', icon: Key }, // NEW
          { name: 'Vehicle Management', href: '/vehicle-management', icon: Car },
          { name: 'Security Check Incomplete', href: '/security-incomplete-orders', icon: Shield },
          { name: 'System Settings', href: '/system-settings', icon: SettingsIcon },
        ]
      case 'Admin':
        return [
          ...commonNav,
          { name: 'Master Inventory', href: '/inventory', icon: ShoppingBag },
          { name: 'Product List', href: '/products', icon: ClipboardList },
          { name: 'Categories', href: '/categories', icon: Tag },
          { name: 'Customers', href: '/customers', icon: Users },
          { name: 'Customer Areas', href: '/customer-areas', icon: MapPin },
          { name: 'Service Customer', href: '/service', icon: ShoppingCart },
          { name: 'On Demand Assignments', href: '/assign-on-demand', icon: Clipboard },
          { name: 'On Demand Orders', href: '/on-demand-orders', icon: Clipboard },
          { name: 'Ongoing On-Demand Orders', href: '/ongoing-on-demand-orders', icon: Clock },
          { name: 'Vehicle Management', href: '/vehicle-management', icon: Car },
          { name: 'Reports', href: '/reports', icon: BarChart3 },
          { name: 'Security Check Incomplete', href: '/security-incomplete-orders', icon: Shield },
        ]
      case 'Order Manager':
        return [
          ...commonNav,
          { name: 'Product List', href: '/products', icon: ClipboardList },
          { name: 'Categories', href: '/categories', icon: Tag },
          { name: 'Service Customer', href: '/service', icon: ShoppingCart },
        ]
      case 'Sales Rep':
        return [
          ...commonNav,
          { name: 'My Inventory', href: '/inventory', icon: ShoppingBag },
          { name: 'On Demand Orders', href: '/on-demand-orders', icon: Clipboard },
          { name: 'Ongoing On-Demand Orders', href: '/ongoing-on-demand-orders', icon: Clock }, // NEW NAVIGATION ITEM
        ]
      case 'Security Guard':
        return [
          ...commonNav,
          { name: 'On Demand Assignments', href: '/assign-on-demand', icon: Clipboard },
          { name: 'Reports', href: '/reports', icon: BarChart3 },
        ]
      case 'Finance Admin':
        return [
          { name: 'Sales Orders', href: '/sales-orders', icon: FileText },
          { name: 'Payment Information', href: '/payment-information', icon: DollarSign },
        ]
      default:
        return []
    }
  }

  // Fetch incomplete orders for notification badge
  React.useEffect(() => {
    if (user && (user.role === 'Super Admin' || user.role === 'Admin')) {
      const fetchCount = async () => {
        const { count, error } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Security Check Incomplete')

        if (error) {
          console.error('Error fetching incomplete orders count:', error)
        } else {
          setIncompleteOrdersCount(count || 0)
        }
      }

      fetchCount()

      // Set up Realtime subscription
      const subscription = supabase
        .channel('security_check_incomplete_orders')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: 'status=eq.Security Check Incomplete',
          },
          (payload) => {
            console.log('Realtime change received:', payload)
            fetchCount()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(subscription)
      }
    }
  }, [user])

  const handleNotificationClick = async () => {
    setShowNotificationsDropdown(!showNotificationsDropdown)
    setProfileDropdownOpen(false)
    if (!showNotificationsDropdown && incompleteOrdersCount > 0) {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_display_id,
          customers (name),
          assigned_user:users!orders_assigned_to_fkey (username)
        `)
        .eq('status', 'Security Check Incomplete')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Error fetching notification orders:', error)
      } else {
        setNotificationOrders(data || [])
      }
    }
  }

  const navigation = getNavigation()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-3 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-red-600 text-white relative">
            <div className="flex flex-col items-center">
              <img src={WeehenaLogo} alt="Weehena Farm Logo" className="h-8 w-auto mb-1" />
              <h1 className="text-sm font-bold text-center leading-tight">{companyName || 'Weehena Farm'}</h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleCloseSidebar}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b">
          <div className="flex items-center justify-between px-6 py-4 relative">
            <div className="flex items-center space-x-4">
              <div className="hidden md:block">
                <h2 className="text-xl font-semibold text-gray-900">
                  {navigation.find(item => item.href === location.pathname)?.name || 'Sales Orders'}
                </h2>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Notification Icon and Dropdown */}
              {(user?.role === 'Super Admin' || user?.role === 'Admin') && (
                <div className="relative" ref={notificationDropdownRef}>
                  <button
                    onClick={handleNotificationClick}
                    className="p-3 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
                  >
                    <Bell className="h-6 w-6" />
                    {incompleteOrdersCount > 0 && (
                      <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                        {incompleteOrdersCount}
                      </span>
                    )}
                  </button>
                  {showNotificationsDropdown && (
                    <div className="origin-top-right absolute right-0 mt-2 w-full max-w-xs sm:w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 max-h-[80vh] overflow-y-auto p-4">
                      <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="user-menu">
                        <p className="block px-4 py-2 text-sm text-gray-700 font-semibold">Security Check Incomplete Orders</p>
                        {notificationOrders.length > 0 ? (
                          notificationOrders.map((order) => (
                            <a
                              key={order.id}
                              href={`/sales-orders?orderId=${order.id}`}
                              className="flex justify-between items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={() => setShowNotificationsDropdown(false)}
                            >
                              <span>Order {order.order_display_id} - {order.customers?.name}</span>
                              <span className="text-xs text-gray-500">{order.assigned_user?.username}</span>
                            </a>
                          ))
                        ) : (
                          <p className="px-4 py-2 text-sm text-gray-500">No new incomplete orders.</p>
                        )}
                        <a href="/security-incomplete-orders" className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 border-t mt-1">View All Incomplete Orders</a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Profile Picture Circle and Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => { setProfileDropdownOpen(!profileDropdownOpen); setShowNotificationsDropdown(false); }}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white font-semibold text-sm uppercase focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  aria-label="User menu"
                  aria-haspopup="true"
                >
                  {userInitials}
                </button>

                {profileDropdownOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="user-menu">
                      <div className="block px-4 py-2 text-sm text-gray-700">
                        {user?.first_name} {user?.last_name}
                      </div>
                      <div className="border-t border-gray-100"></div>
                      
                      {/* Change Password */}
                      <button
                        onClick={() => {
                          setShowChangePasswordModal(true);
                          setProfileDropdownOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        role="menuitem"
                      >
                        <Key className="w-4 h-4 inline-block mr-2" />
                        Change Password
                      </button>

                      {/* Forgot Password */}
                      <button
                        onClick={() => {
                          setShowForgotPasswordModal(true);
                          setProfileDropdownOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        role="menuitem"
                      >
                        <HelpCircle className="w-4 h-4 inline-block mr-2" />
                        Forgot Password
                      </button>

                      <div className="border-t border-gray-100"></div>

                      {user?.role === 'Super Admin' && (
                        <>
                          <Link
                            to="/password-reset-requests"
                            onClick={() => { setProfileDropdownOpen(false); handleCloseSidebar(); }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 relative"
                            role="menuitem"
                          >
                            <Key className="w-4 h-4 inline-block mr-2" />
                            Password Reset Requests
                            {resetRequestsCount > 0 && (
                              <span className="absolute right-2 top-1/2 transform -translate-y-1/2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                                {resetRequestsCount}
                              </span>
                            )}
                          </Link>
                          <Link
                            to="/system-settings"
                            onClick={() => { setProfileDropdownOpen(false); handleCloseSidebar(); }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            role="menuitem"
                          >
                            <SettingsIcon className="w-4 h-4 inline-block mr-2" />
                            System Settings
                          </Link>
                          <div className="border-t border-gray-100"></div>
                        </>
                      )}

                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 hover:text-red-700"
                        role="menuitem"
                      >
                        <LogOut className="w-4 h-4 inline-block mr-2" />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-yellow-500 text-white text-center p-2 text-sm font-medium">
            You are currently offline. Some features may not be available, and data might be outdated.
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={handleCloseSidebar}
        />
      )}

      {/* Add modals before the closing </div> tag */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </div>
  )
}