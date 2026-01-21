import React, { useState } from 'react'
import { Download, Users, UserCheck, List } from 'lucide-react'
import { DateRangeSelector } from './DateRangeSelector'
import { SalesFilterSelector } from './SalesFilterSelector'
import { SalesSummaryCards } from './SalesSummaryCards'
import { SalesTransactionsTable } from './SalesTransactionsTable'
import { formatCurrency } from '../../utils/formatters'
import { format, subDays } from 'date-fns'

// Define types locally since the types file might not exist
interface SalesReportFilters {
  startDate: Date;
  endDate: Date;
  rangeType: string;
  selectedCustomers: string[];
  selectedSalesReps: string[];
  paymentStatus: string;
  orderStatus: string;
}

interface ReportData {
  summary: any;
  transactions: any[];
  customerBreakdown: any[];
  salesRepBreakdown: any[];
  productBreakdown: any[];
}

type ViewMode = 'customer' | 'salesrep' | 'transactions' | 'products'

// Mock useSalesReports hook since it might not exist
const useSalesReports = (filters: SalesReportFilters) => {
  // This is a mock implementation - you should replace with actual hook
  const [reportData] = useState<ReportData>({
    summary: {
      totalRevenue: 15000,
      totalOrders: 45,
      averageOrderValue: 333.33,
      totalCustomers: 28
    },
    transactions: [
      {
        orderDisplayId: 'ORD-001',
        orderDate: new Date().toISOString(),
        customerName: 'John Doe',
        salesRepName: 'Jane Smith',
        totalAmount: 450.00,
        paymentStatus: 'paid',
        orderStatus: 'completed'
      },
      {
        orderDisplayId: 'ORD-002',
        orderDate: subDays(new Date(), 1).toISOString(),
        customerName: 'Alice Johnson',
        salesRepName: 'Bob Wilson',
        totalAmount: 325.50,
        paymentStatus: 'pending',
        orderStatus: 'processing'
      }
    ],
    customerBreakdown: [
      {
        customerId: '1',
        customerName: 'John Doe',
        customerDisplayId: 'CUST-001',
        orderCount: 5,
        totalRevenue: 2250.00,
        averageOrderValue: 450.00,
        lastOrderDate: new Date().toISOString()
      },
      {
        customerId: '2',
        customerName: 'Alice Johnson',
        customerDisplayId: 'CUST-002',
        orderCount: 3,
        totalRevenue: 976.50,
        averageOrderValue: 325.50,
        lastOrderDate: subDays(new Date(), 1).toISOString()
      }
    ],
    salesRepBreakdown: [
      {
        salesRepId: '1',
        salesRepName: 'Jane Smith',
        employeeId: 'EMP-001',
        orderCount: 25,
        totalRevenue: 10000.00,
        averageOrderValue: 400.00,
        uniqueCustomers: 15
      },
      {
        salesRepId: '2',
        salesRepName: 'Bob Wilson',
        employeeId: 'EMP-002',
        orderCount: 20,
        totalRevenue: 5000.00,
        averageOrderValue: 250.00,
        uniqueCustomers: 13
      }
    ],
    productBreakdown: [
      {
        productId: '1',
        productName: 'Product A',
        quantitySold: 150,
        totalRevenue: 7500.00,
        orderCount: 30
      },
      {
        productId: '2',
        productName: 'Product B',
        quantitySold: 100,
        totalRevenue: 5000.00,
        orderCount: 20
      }
    ]
  });

  return {
    reportData,
    loading: false,
    error: null,
    refetch: () => console.log('Refetching data...')
  };
};

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

      {/* Date Range Selector - Simplified since component might not exist */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="flex space-x-2">
              {['7days', '30days', '90days', 'custom'].map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    const newFilters = { ...filters, rangeType: range };
                    if (range === '7days') {
                      newFilters.startDate = subDays(new Date(), 7);
                    } else if (range === '30days') {
                      newFilters.startDate = subDays(new Date(), 30);
                    } else if (range === '90days') {
                      newFilters.startDate = subDays(new Date(), 90);
                    }
                    setFilters(newFilters);
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    filters.rangeType === range
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range === '7days' ? '7 Days' : 
                   range === '30days' ? '30 Days' : 
                   range === '90days' ? '90 Days' : 'Custom'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={format(filters.startDate, 'yyyy-MM-dd')}
              onChange={(e) => setFilters({...filters, startDate: new Date(e.target.value)})}
              className="border border-gray-300 rounded px-3 py-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={format(filters.endDate, 'yyyy-MM-dd')}
              onChange={(e) => setFilters({...filters, endDate: new Date(e.target.value)})}
              className="border border-gray-300 rounded px-3 py-1"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards - Simplified since component might not exist */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(reportData.summary.totalRevenue)}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {reportData.summary.totalOrders}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(reportData.summary.averageOrderValue)}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">
                {reportData.summary.totalCustomers}
              </p>
            </div>
          </div>
        </div>
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

      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500">Loading sales report...</div>
        </div>
      ) : (
        <>
          {viewMode === 'transactions' && reportData && (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4">Order ID</th>
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Customer</th>
                    <th className="text-left py-3 px-4">Sales Rep</th>
                    <th className="text-right py-3 px-4">Total Amount</th>
                    <th className="text-left py-3 px-4">Payment Status</th>
                    <th className="text-left py-3 px-4">Order Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.transactions.map((transaction: any) => (
                    <tr key={transaction.orderDisplayId} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{transaction.orderDisplayId}</td>
                      <td className="py-3 px-4">
                        {format(new Date(transaction.orderDate), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="py-3 px-4">{transaction.customerName}</td>
                      <td className="py-3 px-4">{transaction.salesRepName}</td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(transaction.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.paymentStatus === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {transaction.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.orderStatus === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {transaction.orderStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  {reportData.customerBreakdown.map((customer: any) => (
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
                  {reportData.salesRepBreakdown.map((rep: any) => (
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
                  {reportData.productBreakdown.map((product: any) => (
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
        </>
      )}
    </div>
  )
}