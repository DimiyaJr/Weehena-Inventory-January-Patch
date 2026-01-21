import React, { useState, useRef } from 'react'
import { 
  Package, 
  DollarSign, 
  AlertTriangle, 
  TrendingDown,
  BarChart3,
  PieChart,
  Download
} from 'lucide-react'
import { useInventoryReports } from '../../hooks/useInventoryReports'
import { ReportFilters } from '../../types/reportTypes'
import { DateRangeSelector } from './DateRangeSelector'
import { ReportCard } from './ReportCard'
import { StockLevelChart } from './StockLevelChart'
import { CategoryDistributionChart } from './CategoryDistributionChart'
import { InventoryValueChart } from './InventoryValueChart'
import { LowStockAlertChart } from './LowStockAlertChart'
import { InventoryTrendChart } from './InventoryTrendChart'
import { SalesByPricingTierChart } from './SalesByPricingTierChart'
import { formatCurrency } from '../../utils/formatters'
import { WEIGHT_UNIT } from '../../utils/units'
import { subDays } from 'date-fns'

export const InventoryReportsTab: React.FC = () => {
  // Initialize filters with last 30 days
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    rangeType: '30days',
    selectedCategories: [],
    selectedPricingTiers: []
  })

  // Canvas refs for PDF export
  const canvasRefs = useRef({
    stockLevelChart: null as HTMLCanvasElement | null,
    categoryDistributionChart: null as HTMLCanvasElement | null,
    inventoryValueChart: null as HTMLCanvasElement | null,
    lowStockAlertChart: null as HTMLCanvasElement | null,
    inventoryTrendChart: null as HTMLCanvasElement | null,
    salesByPricingTierChart: null as HTMLCanvasElement | null
  })

  // Fetch report data
  const { reportData, loading, error, refetch } = useInventoryReports(filters)

  // State for chart options
  const [valueChartType, setValueChartType] = useState<'quantity' | 'value'>('value')
  const [pricingTier, setPricingTier] = useState<'all' | 'dealer_cash' | 'dealer_credit' | 'hotel_non_vat' | 'hotel_vat' | 'farm_shop'>('all')

  const handleExportPDF = () => {
    // This will be implemented in Step 14
    console.log('Export PDF functionality - to be implemented in Step 14')
  }

  const handleExportCSV = () => {
    if (!reportData) return

    // Export inventory data as CSV
    const headers = ['Product Name', 'Category', 'Current Stock', 'Threshold', 'Status']
    const rows = reportData.stockLevelData.map(item => [
      item.productName,
      item.category,
      item.currentStock.toString(),
      item.threshold.toString(),
      item.status
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory_report_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header with Export Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory Reports</h2>
          <p className="text-sm text-gray-600 mt-1">
            Comprehensive inventory analysis and trends
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            disabled={!reportData}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            disabled={!reportData}
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <DateRangeSelector filters={filters} onFiltersChange={setFilters} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Package className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : reportData?.totalProducts || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : formatCurrency(reportData?.totalValue || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-amber-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : reportData?.lowStockCount || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingDown className="w-8 h-8 text-red-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : reportData?.outOfStockCount || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Level Chart */}
        <ReportCard
          title="Current Stock Levels"
          icon={BarChart3}
          isLoading={loading}
          error={error}
          className="lg:col-span-2"
        >
          {reportData && (
            <StockLevelChart
              products={reportData.stockLevelData}
              showThreshold={true}
              onCanvasReady={(canvas) => {
                canvasRefs.current.stockLevelChart = canvas
              }}
            />
          )}
        </ReportCard>

        {/* Category Distribution */}
        <ReportCard
          title="Category Distribution"
          icon={PieChart}
          isLoading={loading}
          error={error}
        >
          {reportData && (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setValueChartType('quantity')}
                  className={`px-3 py-1 rounded text-sm ${
                    valueChartType === 'quantity'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  By Quantity
                </button>
                <button
                  onClick={() => setValueChartType('value')}
                  className={`px-3 py-1 rounded text-sm ${
                    valueChartType === 'value'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  By Value
                </button>
              </div>
              <CategoryDistributionChart
                categoryData={reportData.categoryBreakdown}
                valueType={valueChartType}
                onCanvasReady={(canvas) => {
                  canvasRefs.current.categoryDistributionChart = canvas
                }}
              />
            </>
          )}
        </ReportCard>

        {/* Low Stock Alert Chart */}
        <ReportCard
          title="Stock Status Distribution"
          icon={AlertTriangle}
          isLoading={loading}
          error={error}
        >
          {reportData && (
            <LowStockAlertChart
              products={reportData.stockLevelData}
              onCanvasReady={(canvas) => {
                canvasRefs.current.lowStockAlertChart = canvas
              }}
            />
          )}
        </ReportCard>

        {/* Inventory Value by Category */}
        <ReportCard
          title="Inventory Value by Category"
          icon={DollarSign}
          isLoading={loading}
          error={error}
          className="lg:col-span-2"
        >
          {reportData && (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { value: 'all', label: 'All Tiers' },
                  { value: 'dealer_cash', label: 'Dealer Cash' },
                  { value: 'dealer_credit', label: 'Dealer Credit' },
                  { value: 'hotel_non_vat', label: 'Hotel Non-VAT' },
                  { value: 'hotel_vat', label: 'Hotel VAT' },
                  { value: 'farm_shop', label: 'Farm Shop' }
                ].map((tier) => (
                  <button
                    key={tier.value}
                    onClick={() => setPricingTier(tier.value as any)}
                    className={`px-3 py-1 rounded text-sm ${
                      pricingTier === tier.value
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
              <InventoryValueChart
                categoryData={reportData.categoryBreakdown}
                pricingTier={pricingTier}
                onCanvasReady={(canvas) => {
                  canvasRefs.current.inventoryValueChart = canvas
                }}
              />
            </>
          )}
        </ReportCard>

        {/* Pricing Tier Analysis */}
        <ReportCard
          title="Revenue by Pricing Tier"
          icon={BarChart3}
          isLoading={loading}
          error={error}
          className="lg:col-span-2"
        >
          {reportData && (
            <SalesByPricingTierChart
              pricingData={reportData.pricingAnalysis}
              onCanvasReady={(canvas) => {
                canvasRefs.current.salesByPricingTierChart = canvas
              }}
            />
          )}
        </ReportCard>

        {/* Inventory Trend */}
        <ReportCard
          title="Inventory Trend"
          icon={TrendingDown}
          isLoading={loading}
          error={error}
          className="lg:col-span-2"
        >
          <InventoryTrendChart
            startDate={filters.startDate}
            endDate={filters.endDate}
            onCanvasReady={(canvas) => {
              canvasRefs.current.inventoryTrendChart = canvas
            }}
          />
        </ReportCard>
      </div>

      {/* Low Stock Items Table */}
      {reportData && reportData.lowStockCount > 0 && (
        <ReportCard
          title="Low Stock Items Requiring Attention"
          icon={AlertTriangle}
          isLoading={loading}
          error={error}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Product</th>
                  <th className="text-left py-2 px-4">Category</th>
                  <th className="text-left py-2 px-4">Current Stock</th>
                  <th className="text-left py-2 px-4">Threshold</th>
                  <th className="text-left py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.stockLevelData
                  .filter(item => item.status !== 'adequate')
                  .slice(0, 20)
                  .map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4 font-medium">{item.productName}</td>
                      <td className="py-2 px-4">{item.category}</td>
                      <td className="py-2 px-4">{item.currentStock} {WEIGHT_UNIT}</td>
                      <td className="py-2 px-4">{item.threshold} {WEIGHT_UNIT}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === 'critical'
                              ? 'bg-red-100 text-red-800'
                              : item.status === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </ReportCard>
      )}
    </div>
  )
}
