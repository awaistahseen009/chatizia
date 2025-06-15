import React, { useState } from 'react';
import { 
  CreditCard, 
  Download, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Zap,
  Crown,
  Star
} from 'lucide-react';

const Billing: React.FC = () => {
  const [currentPlan, setCurrentPlan] = useState('pro');
  const [billingCycle, setBillingCycle] = useState('monthly');

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: { monthly: 0, yearly: 0 },
      features: [
        '1 chatbot',
        '100 messages/month',
        '5 documents',
        'Basic customization',
        'Email support'
      ],
      limits: {
        chatbots: 1,
        messages: 100,
        documents: 5
      },
      popular: false,
      color: 'slate'
    },
    {
      id: 'starter',
      name: 'Starter',
      price: { monthly: 29, yearly: 290 },
      features: [
        '3 chatbots',
        '2,000 messages/month',
        '50 documents',
        'Full customization',
        'Analytics dashboard',
        'Priority support'
      ],
      limits: {
        chatbots: 3,
        messages: 2000,
        documents: 50
      },
      popular: false,
      color: 'blue'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: { monthly: 99, yearly: 990 },
      features: [
        '10 chatbots',
        '10,000 messages/month',
        '500 documents',
        'Voice responses',
        'API access',
        'White-label options',
        '24/7 support'
      ],
      limits: {
        chatbots: 10,
        messages: 10000,
        documents: 500
      },
      popular: true,
      color: 'emerald'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: { monthly: 299, yearly: 2990 },
      features: [
        'Unlimited chatbots',
        '100,000+ messages/month',
        'Unlimited documents',
        'Custom integrations',
        'Dedicated support',
        'SLA guarantee',
        'Custom deployment'
      ],
      limits: {
        chatbots: 'Unlimited',
        messages: 100000,
        documents: 'Unlimited'
      },
      popular: false,
      color: 'purple'
    }
  ];

  const currentPlanData = plans.find(plan => plan.id === currentPlan);
  const monthlyUsage = {
    messages: 3420,
    chatbots: 3,
    documents: 28
  };

  const invoices = [
    {
      id: 'INV-001',
      date: '2024-01-01',
      amount: 99,
      status: 'paid',
      plan: 'Pro Plan',
      period: 'Jan 2024'
    },
    {
      id: 'INV-002',
      date: '2023-12-01',
      amount: 99,
      status: 'paid',
      plan: 'Pro Plan',
      period: 'Dec 2023'
    },
    {
      id: 'INV-003',
      date: '2023-11-01',
      amount: 99,
      status: 'paid',
      plan: 'Pro Plan',
      period: 'Nov 2023'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Billing & Subscription</h1>
          <p className="text-slate-600 mt-1">Manage your subscription and billing information</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          <Download className="w-4 h-4" />
          <span>Download Invoice</span>
        </button>
      </div>

      {/* Current Plan */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Current Plan</h2>
          <div className="flex items-center space-x-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            <span className="font-medium text-slate-800">{currentPlanData?.name} Plan</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600">Messages This Month</span>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-end space-x-2">
              <span className="text-2xl font-bold text-slate-800">{monthlyUsage.messages.toLocaleString()}</span>
              <span className="text-slate-500">/ {typeof currentPlanData?.limits.messages === 'number' ? currentPlanData.limits.messages.toLocaleString() : currentPlanData?.limits.messages}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min((monthlyUsage.messages / (currentPlanData?.limits.messages as number)) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600">Active Chatbots</span>
              <Zap className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-end space-x-2">
              <span className="text-2xl font-bold text-slate-800">{monthlyUsage.chatbots}</span>
              <span className="text-slate-500">/ {currentPlanData?.limits.chatbots}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(monthlyUsage.chatbots / (currentPlanData?.limits.chatbots as number)) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600">Documents</span>
              <Star className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex items-end space-x-2">
              <span className="text-2xl font-bold text-slate-800">{monthlyUsage.documents}</span>
              <span className="text-slate-500">/ {currentPlanData?.limits.documents}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${(monthlyUsage.documents / (currentPlanData?.limits.documents as number)) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div>
            <p className="font-medium text-blue-800">Next billing date: February 1, 2024</p>
            <p className="text-sm text-blue-600">Your subscription will renew automatically</p>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Manage Subscription
          </button>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Available Plans</h2>
          <div className="flex items-center space-x-2 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors relative ${
                billingCycle === 'yearly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              Yearly
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1 rounded-full">
                -20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const colorClasses = {
              slate: 'border-slate-200',
              blue: 'border-blue-200 bg-blue-50',
              emerald: 'border-emerald-200 bg-emerald-50',
              purple: 'border-purple-200 bg-purple-50'
            };

            return (
              <div
                key={plan.id}
                className={`relative border-2 rounded-lg p-6 transition-all hover:shadow-lg ${
                  plan.popular ? 'ring-2 ring-emerald-500' : ''
                } ${colorClasses[plan.color as keyof typeof colorClasses]}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-slate-800">
                      ${plan.price[billingCycle as keyof typeof plan.price]}
                    </span>
                    <span className="text-slate-600">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-2 rounded-lg font-medium transition-colors ${
                    currentPlan === plan.id
                      ? 'bg-slate-200 text-slate-600 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-800 text-white hover:bg-slate-900'
                  }`}
                  disabled={currentPlan === plan.id}
                >
                  {currentPlan === plan.id ? 'Current Plan' : 'Upgrade'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">Billing History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{invoice.id}</div>
                      <div className="text-sm text-slate-600">{invoice.plan}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {new Date(invoice.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                    ${invoice.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Paid
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button className="text-blue-600 hover:text-blue-800 transition-colors">
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Billing;