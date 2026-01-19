import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, CheckCircle, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { validateTemporaryPassword, getTemporaryPasswordRequirements } from '../utils/passwordPolicy';

interface PasswordResetRequest {
  id: string;
  user_id: string;
  requested_by_user_id: string;
  status: string;
  request_message: string | null;
  created_at: string;
  completed_at: string | null;
  completed_by_super_admin_id: string | null;
  user: {
    username: string;
    first_name: string;
    last_name: string;
    employee_id: string | null;
    title: string;
  };
}

export const PasswordResetRequestsManager: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const INTERNAL_USER_MANAGEMENT_TOKEN = import.meta.env.VITE_INTERNAL_USER_MANAGEMENT_TOKEN;

  // Change 2: Add More Logging at Component Start
  console.log('PasswordResetRequestsManager - Component rendered', {
    user,
    userRole: user?.role,
    loading
  });

  // Change 1: Add Debug Logging to PasswordResetRequestsManager.tsx
  useEffect(() => {
    console.log('PasswordResetRequestsManager - useEffect triggered', {
      user,
      userRole: user?.role,
      isSupeAdmin: user?.role === 'Super Admin'
    });
    
    if (user?.role === 'Super Admin') {
      console.log('User is Super Admin, calling fetchRequests...');
      fetchRequests();
    } else {
      console.log('User is NOT Super Admin or user is null');
    }
  }, [user]);

  // Debug effect to log requests state
  useEffect(() => {
    console.log('PasswordResetRequestsManager - Current state:', {
      requests,
      requestsCount: requests.length,
      pendingCount: requests.filter(r => r.status === 'pending').length,
      completedCount: requests.filter(r => r.status === 'completed').length,
      user: user?.role
    });
  }, [requests, user]);

  // Change 4: Update fetchRequests to Use RPC Function
  const fetchRequests = async () => {
    try {
      console.log('Fetching password reset requests...');
      console.log('Current user:', user);
      
      // Use RPC function instead of direct table query
      const { data, error } = await supabase
        .rpc('get_password_reset_requests');

      if (error) {
        console.error('Error fetching requests:', error);
        throw error;
      }

      console.log('Fetched requests via RPC:', data);

      // Manually fetch user data for each request
      if (data && data.length > 0) {
        const requestsWithUsers = await Promise.all(
          data.map(async (request: any) => {
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('username, first_name, last_name, employee_id, title')
              .eq('id', request.user_id)
              .single();

            if (userError) {
              console.error('Error fetching user data for user_id:', request.user_id, userError);
            }

            console.log('User data for request:', request.id, userData);

            return {
              ...request,
              user: userData || {
                username: 'Unknown',
                first_name: 'Unknown',
                last_name: 'User',
                employee_id: null,
                title: 'Mr'
              }
            };
          })
        );

        console.log('Final requests with users:', requestsWithUsers);
        setRequests(requestsWithUsers);
      } else {
        console.log('No requests found');
        setRequests([]);
      }
    } catch (err) {
      console.error('Error in fetchRequests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSetTemporaryPassword = async (requestId: string, userId: string) => {
    setError('');
    setProcessing(true);

    try {
      // Validate temporary password
      const validation = validateTemporaryPassword(tempPassword);
      if (!validation.isValid) {
        setError(validation.errors.join('. '));
        setProcessing(false);
        return;
      }

      if (!INTERNAL_USER_MANAGEMENT_TOKEN) {
        throw new Error('Internal user management token is not configured.');
      }

      // Call Edge Function to update user's password
      const response = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'update',
          userId: userId,
          userData: {
            password: tempPassword,
          },
        },
        headers: {
          'X-Internal-Function-Token': INTERNAL_USER_MANAGEMENT_TOKEN,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Edge function error');
      }
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to set temporary password');
      }

      // Update password reset request status
      const { error: updateError } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by_super_admin_id: user?.id,
          new_temporary_password: tempPassword
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Refresh requests
      await fetchRequests();
      setSelectedRequest(null);
      setTempPassword('');
      setShowPassword(false);
    } catch (err: any) {
      console.error('Error setting temporary password:', err);
      setError(err.message || 'Failed to set temporary password');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (user?.role !== 'Super Admin') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only Super Admins can manage password reset requests.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading password reset requests...</div>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const completedRequests = requests.filter(r => r.status === 'completed');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Password Reset Requests</h1>
        <p className="text-gray-600 mt-1">Manage user password reset requests</p>
      </div>

      {/* Pending Requests */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Pending Requests ({pendingRequests.length})
        </h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No pending password reset requests
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {pendingRequests.map((request) => (
                <div key={request.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          <Clock className="w-3 h-3 mr-1" />
                          {request.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(request.created_at).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {request.user.title} {request.user.first_name} {request.user.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Username: {request.user.username}
                        {request.user.employee_id && ` | Employee ID: ${request.user.employee_id}`}
                      </p>
                      {request.request_message && (
                        <p className="text-sm text-gray-700 mt-2 italic">
                          "{request.request_message}"
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="ml-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Set Temporary Password
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Completed Requests */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Completed Requests ({completedRequests.length})
        </h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {completedRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No completed password reset requests
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {completedRequests.map((request) => (
                <div key={request.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {request.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          Completed: {request.completed_at ? new Date(request.completed_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <h3 className="text-base font-medium text-gray-900">
                        {request.user.title} {request.user.first_name} {request.user.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Username: {request.user.username}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Set Temporary Password Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Set Temporary Password</h2>
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setTempPassword('');
                  setError('');
                  setShowPassword(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>User:</strong> {selectedRequest.user.title} {selectedRequest.user.first_name} {selectedRequest.user.last_name}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Username:</strong> {selectedRequest.user.username}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter temporary password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-700 mb-2">Temporary Password Requirements:</p>
              <ul className="space-y-1">
                {getTemporaryPasswordRequirements().map((req, index) => (
                  <li key={index} className="text-xs text-gray-600 flex items-start">
                    <span className="mr-1">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setTempPassword('');
                  setError('');
                  setShowPassword(false);
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSetTemporaryPassword(selectedRequest.id, selectedRequest.user_id)}
                disabled={processing || !tempPassword}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Setting...' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};