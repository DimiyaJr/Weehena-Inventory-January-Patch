import React from 'react'
import { DollarSign, ShoppingCart, TrendingUp, Users, UserCheck } from 'lucide-react'
import { SalesSummary } from '../../types/salesReportTypes'
import { formatCurrency } from '../../utils/formatters'

interface Props {
  summary: SalesSummary
  loading: boolean
}

export const SalesSummaryCards: React.FC<Props> = ({ summary, loading }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Revenue */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <DollarSign className="w-8 h-8 text-green-600 mr-3" />
          <div>
            <p className="text-sm font-medium text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '...' : formatCurrency(summary?.totalRevenue || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Total Orders */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <ShoppingCart className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <p className="text-sm font-medium text-gray-600">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '...' : summary?.totalOrders || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Average Order Value */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <TrendingUp className="w-8 h-8 text-amber-600 mr-3" />
          <div>
            <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '...' : formatCurrency(summary?.averageOrderValue || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Unique Customers */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <Users className="w-8 h-8 text-red-600 mr-3" />
          <div>
            <p className="text-sm font-medium text-gray-600">Unique Customers</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '...' : summary?.uniqueCustomers || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Active Sales Reps */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <UserCheck className="w-8 h-8 text-cyan-600 mr-3" />
          <div>
            <p className="text-sm font-medium text-gray-600">Active Sales Reps</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '...' : summary?.activeSalesReps || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
