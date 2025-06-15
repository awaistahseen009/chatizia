import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from './AuthLayout';

const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { resetPassword } = useAuth();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const { error } = await resetPassword(email);
      
      if (error) {
        setErrors({ general: error.message });
      } else {
        setSuccess(true);
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout
        title="Check Your Email"
        subtitle="We've sent you a password reset link"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-slate-600 mb-6">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Check your email and follow the instructions to reset your password.
          </p>
          <Link
            to="/signin"
            className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to sign in</span>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset Your Password"
      subtitle="Enter your email to receive a reset link"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="text-sm text-red-700">{errors.general}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
              placeholder="Enter your email"
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
        </button>

        <div className="text-center">
          <Link
            to="/signin"
            className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to sign in</span>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default ForgotPasswordForm;