import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase'; // ADD this import
import { validateUserPassword, getUserPasswordRequirements } from '../utils/passwordPolicy';
import WeehenaLogo from '../assets/images/Weehena Logo(Ai) copy copy copy.png';

export const ResetPasswordPage: React.FC = () => {
  const { user, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handlePasswordChange = (field: 'currentPassword' | 'newPassword' | 'confirmPassword', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    
    // Validate new password in real-time
    if (field === 'newPassword') {
      const validation = validateUserPassword(value);
      setValidationErrors(validation.errors);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate new password
      const validation = validateUserPassword(formData.newPassword);
      if (!validation.isValid) {
        setError(validation.errors.join('. '));
        setLoading(false);
        return;
      }

      // Check if passwords match
      if (formData.newPassword !== formData.confirmPassword) {
        setError('New password and confirm password do not match');
        setLoading(false);
        return;
      }

      // Reset password
      if (!user?.id) {
        throw new Error('User not logged in');
      }

      await resetPassword(user.id, formData.currentPassword, formData.newPassword);

      // 6. Refresh User Session After Password Reset
      // 6.1 Update ResetPasswordPage.tsx
      // Force refresh session to get updated user data
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Fetch fresh user data
        const { data: freshUserData } = await supabase
          .from('users')
          .select('is_temporary_password')
          .eq('id', user.id)
          .single();
        
        console.log('Password reset complete. Fresh data:', freshUserData);
      }

      // Success - redirect to inventory
      navigate('/inventory');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const requirements = getUserPasswordRequirements();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src={WeehenaLogo} alt="Weehena Farm Logo" className="h-16 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
          <p className="mt-2 text-gray-600">Please set a new password for your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 font-medium mb-2">
              <Lock className="w-4 h-4 inline mr-1" />
              You are using a temporary password
            </p>
            <p className="text-xs text-yellow-700">
              Please create a strong password that you can remember
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">
                {error}
              </div>
            )}

            {/* Current/Temporary Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? "text" : "password"}
                  value={formData.currentPassword}
                  onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-700 mb-2">Password Requirements:</p>
              <ul className="space-y-1">
                {requirements.map((req, index) => {
                  const isMet = validationErrors.length === 0 || !validationErrors.some(err => err.toLowerCase().includes(req.toLowerCase().split(' ')[0]));
                  return (
                    <li key={index} className="flex items-start text-xs">
                      <CheckCircle className={`w-3 h-3 mr-1 mt-0.5 flex-shrink-0 ${isMet && formData.newPassword ? 'text-green-500' : 'text-gray-400'}`} />
                      <span className={isMet && formData.newPassword ? 'text-green-700' : 'text-gray-600'}>
                        {req}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading || validationErrors.length > 0}
              className="w-full py-3 px-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};