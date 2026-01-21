import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { SalesTransaction } from '../../types/salesReportTypes'
import { formatCurrency } from '../../utils/formatters'
import { format } from 'date-fns'
import { WEIGHT_UNIT } from '../../utils/units'

interface Props {
  transactions: SalesTransaction[]
  loading: boolean
}

export const SalesTransactionsTable: React.FC<Props> = ({ transactions, loading }) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  const toggleRow = (orderId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId)
    } else {
      newExpanded.add(orderId)
    }
    setExpandedRows(newExpanded)
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'fully_paid':
        return 'bg-green-100 text-green-800'
      case 'partially_paid':
        return 'bg-amber-100 text-amber-800'
      case 'unpaid':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatPaymentStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  // Pagination
  const totalPages = Math.ceil(transactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTransactions = transactions.slice(startIndex, endIndex)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">Loading transactions...</div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">No transactions found</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-4 w-10"></th>
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
            {currentTransactions.map((transaction) => (
              <React.Fragment key={transaction.orderId}>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleRow(transaction.orderId)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {expandedRows.has(transaction.orderId) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4 font-medium">{transaction.orderDisplayId}</td>
                  <td className="py-3 px-4">
                    {format(new Date(transaction.orderDate), 'MMM dd, yyyy')}
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium">{transaction.customerName}</div>
                      <div className="text-xs text-gray-500">{transaction.customerDisplayId}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">{transaction.salesRepName}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(transaction.totalAmount)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(transaction.paymentStatus)}`}>
                      {formatPaymentStatus(transaction.paymentStatus)}
                    </span>
                  </td>
                  <td className="py-3 px-4">{transaction.orderStatus}</td>
                </tr>
                
                {expandedRows.has(transaction.orderId) && (
                  <tr>
                    <td colSpan={8} className="py-2 px-4 bg-gray-50">
                      <div className="ml-8">
                        <h4 className="font-semibold text-sm mb-2">Order Items:</h4>
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 text-sm">Product</th>
                              <th className="text-right py-2 text-sm">Quantity</th>
                              <th className="text-right py-2 text-sm">Price</th>
                              <th className="text-right py-2 text-sm">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transaction.items.map((item, idx) => (
                              <tr key={idx} className="border-b last:border-b-0">
                                <td className="py-2 text-sm">{item.productName}</td>
                                <td className="py-2 text-sm text-right">
                                  {item.quantity} {WEIGHT_UNIT}
                                </td>
                                <td className="py-2 text-sm text-right">
                                  {formatCurrency(item.price)}
                                </td>
                                <td className="py-2 text-sm text-right font-medium">
                                  {formatCurrency(item.subtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center px-4 py-3 border-t">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, transactions.length)} of {transactions.length} transactions
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-3 py-1">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
