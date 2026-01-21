import React, { useState } from 'react'
import { Download, Users, UserCheck, List } from 'lucide-react'
import { useSalesReports } from '../../hooks/useSalesReports'
import { SalesReportFilters } from '../../types/salesReportTypes'
import { DateRangeSelector } from './DateRangeSelector'
import { SalesFilterSelector } from './SalesFilterSelector'
import { SalesSummaryCards } from './SalesSummaryCards'
import { SalesTransactionsTable } from './SalesTransactionsTable'
import { formatCurrency } from '../../utils/formatters'
import { format } from 'date-fns'
import { subDays } from 'date-fns'

type ViewMode = 'customer' | 'salesrep' | 'transactions' | 'products'

export const SalesReportsTab: React.FC = () => {
  // Initialize filters with last 30 days
  const [filters, setFilters] = useState<SalesReportFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    rangeType: '30days',
    selectedCustomers: [],
    selectedSalesReps: [],
    paymentStatus: 'all',
    orderStatus: 'all'
  })

  const [viewMode, setViewMode] = useState<ViewMode>('transactions')

  // Fetch report data
  const { reportData, loading, error, refetch } = useSalesReports(filters)

  const handleExportCSV = (reportType: ViewMode) => {
    if (!reportData) return

    let csvContent = ''
    let filename = ''

    switch (reportType) {
      case 'customer':
        csvContent = [
          ['Customer Name', 'Customer ID', 'Total Orders', 'Total Revenue', 'Average Order Value', 'Last Order Date'].join(','),
          ...reportData.customerBreakdown.map(row => [
            row.customerName,
            row.customerDisplayId,
            row.orderCount,
            row.totalRevenue.toFixed(2),
            row.averageOrderValue.toFixed(2),
            format(new Date(row.lastOrderDate), 'yyyy-MM-dd')
          ].join(','))
        ].join('\n')
        filename = `sales_report_customer_${format(filters.startDate, 'yyyy-MM-dd')}_to_${format(filters.endDate, 'yyyy-MM-dd')}.csv`
        break

      case 'salesrep':
        csvContent = [
          ['Sales Rep Name', 'Employee ID', 'Total Orders', 'Total Revenue', 'Average Order Value', 'Unique Customers'].join(','),
          ...reportData.salesRepBreakdown.map(row => [
            row.salesRepName,
            row.employeeId || '',
            row.orderCount,
            row.totalRevenue.toFixed(2),
            row.averageOrderValue.toFixed(2),
            row.uniqueCustomers
          ].join(','))
        ].join('\n')
        filename = `sales_report_salesrep_${format(filters.startDate, 'yyyy-MM-dd')}_to_${format(filters.endDate, 'yyyy-MM-dd')}.csv`
        break

      case 'transactions':
        csvContent = [
          ['Order ID', 'Date', 'Customer', 'Sales Rep', 'Total Amount', 'Payment Status', 'Order Status'].join(','),
          ...reportData.transactions.map(row => [
            row.orderDisplayId,
            format(new Date(row.orderDate), 'yyyy-MM-dd HH:mm'),
            row.customerName,
            row.salesRepName,
            row.totalAmount.toFixed(2),
            row.paymentStatus,
            row.orderStatus
          ].join(','))
        ].join('\n')
        filename = `sales_transactions_${format(filters.startDate, 'yyyy-MM-dd')}_to_${format(filters.endDate, 'yyyy-MM-dd')}.csv`
        break

      case 'products':
        csvContent = [
          ['Product Name', 'Quantity Sold', 'Total Revenue', 'Order Count'].join(','),
          ...reportData.productBreakdown.map(row => [
            row.productName,
            row.quantitySold,
            row.totalRevenue.toFixed(2),
            row.orderCount
          ].join(','))
        ].join('\n')
        filename = `product_sales_${format(filters.startDate, 'yyyy-MM-dd')}_to_${format(filters.endDate, 'yyyy-MM-dd')}.csv`
        break
    }

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFiltersUpdate = (newFilters: Partial<SalesReportFilters>) => {
    setFilters({ ...filters, ...newFilters })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Report</h2>
          <p className="text-sm text-gray-600 mt-1">
            Comprehensive sales analysis and performance metrics
          </p>
        </div>
        <div className="relative">
          <button
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            onClick={() => {
              const dropdown = document.getElementById('export-dropdown')
              dropdown?.classList.toggle('hidden')
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          <div
            id="export-dropdown"
            className="hidden absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
          >
            <button
              onClick={() => handleExportCSV('customer')}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Customer Report (CSV)
            </button>
            <button
              onClick={() => handleExportCSV('salesrep')}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Sales Rep Report (CSV)
            </button>
            <button
              onClick={() => handleExportCSV('transactions')}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Transactions (CSV)
            </button>
            <button
              onClick={() => handleExportCSV('products')}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Product Sales (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <DateRangeSelector 
        filters={filters} 
        onFiltersChange={setFilters}
      />

      {/* Advanced Filters */}
      <SalesFilterSelector 
        filters={filters} 
        onFiltersChange={setFilters}
      />

      {/* Summary Cards */}
      {reportData && (
        <SalesSummaryCards 
          summary={reportData.summary} 
          loading={loading}
        />
      )}

      {/* View Mode Toggle */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setViewMode('transactions')}
          className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'transactions'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <List className="w-4 h-4 mr-2" />
          Transactions
        </button>
        <button
          onClick={() => setViewMode('customer')}
          className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'customer'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Users className="w-4 h-4 mr-2" />
          By Customer
        </button>
        <button
          onClick={() => setViewMode('salesrep')}
          className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'salesrep'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <UserCheck className="w-4 h-4 mr-2" />
          By Sales Rep
        </button>
        <button
          onClick={() => setViewMode('products')}
          className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'products'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          By Product
        </button>
      </div>

      {/* Content Based on View Mode */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {viewMode === 'transactions' && reportData && (
        <SalesTransactionsTable 
          transactions={reportData.transactions} 
          loading={loading}
        />
      )}

      {viewMode === 'customer' && reportData && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4">Customer Name</th>
                <th className="text-left py-3 px-4">Customer ID</th>
                <th className="text-right py-3 px-4">Total Orders</th>
                <th className="text-right py-3 px-4">Total Revenue</th>
                <th className="text-right py-3 px-4">Avg Order Value</th>
                <th className="text-left py-3 px-4">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {reportData.customerBreakdown.map((customer) => (
                <tr key={customer.customerId} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{customer.customerName}</td>
                  <td className="py-3 px-4">{customer.customerDisplayId}</td>
                  <td className="py-3 px-4 text-right">{customer.orderCount}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(customer.totalRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatCurrency(customer.averageOrderValue)}
                  </td>
                  <td className="py-3 px-4">
                    {format(new Date(customer.lastOrderDate), 'MMM dd, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'salesrep' && reportData && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4">Sales Rep Name</th>
                <th className="text-left py-3 px-4">Employee ID</th>
                <th className="text-right py-3 px-4">Total Orders</th>
                <th className="text-right py-3 px-4">Total Revenue</th>
                <th className="text-right py-3 px-4">Avg Order Value</th>
                <th className="text-right py-3 px-4">Unique Customers</th>
              </tr>
            </thead>
            <tbody>
              {reportData.salesRepBreakdown.map((rep) => (
                <tr key={rep.salesRepId} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{rep.salesRepName}</td>
                  <td className="py-3 px-4">{rep.employeeId || '-'}</td>
                  <td className="py-3 px-4 text-right">{rep.orderCount}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(rep.totalRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatCurrency(rep.averageOrderValue)}
                  </td>
                  <td className="py-3 px-4 text-right">{rep.uniqueCustomers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'products' && reportData && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4">Product Name</th>
                <th className="text-right py-3 px-4">Quantity Sold</th>
                <th className="text-right py-3 px-4">Total Revenue</th>
                <th className="text-right py-3 px-4">Order Count</th>
              </tr>
            </thead>
            <tbody>
              {reportData.productBreakdown.map((product) => (
                <tr key={product.productId} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{product.productName}</td>
                  <td className="py-3 px-4 text-right">{product.quantitySold}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(product.totalRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right">{product.orderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
