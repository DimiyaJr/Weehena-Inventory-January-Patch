import React, { useRef, useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { lineChartOptions, CHART_COLORS } from '../../config/chartConfig'
import { supabase } from '../../lib/supabase'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { formatCurrency } from '../../utils/formatters'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface InventoryTrendChartProps {
  startDate: Date
  endDate: Date
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
}

interface TrendDataPoint {
  date: string
  totalStock: number
  totalValue: number
  lowStockCount: number
}

export const InventoryTrendChart: React.FC<InventoryTrendChartProps> = React.memo(({
  startDate,
  endDate,
  onCanvasReady
}) => {
  const chartRef = useRef<any>(null)
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState<'stock' | 'value' | 'lowStock'>('stock')

  useEffect(() => {
    if (chartRef.current && onCanvasReady) {
      onCanvasReady(chartRef.current.canvas)
    }
  }, [chartRef.current, onCanvasReady])

  useEffect(() => {
    fetchTrendData()
  }, [startDate, endDate])

  const fetchTrendData = async () => {
    setLoading(true)
    try {
      // Generate all dates in range
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate })
      
      // Fetch inventory snapshots or calculate from current data
      // Note: This is simplified - in production you'd have historical snapshots
      const { data: products, error } = await supabase
        .from('products')
        .select('quantity, threshold, price_dealer_cash')

      if (error) throw error

      // Create trend data (simplified - same values for all dates)
      // In production, you'd fetch historical snapshots
      const trend: TrendDataPoint[] = dateRange.map(date => {
        const totalStock = products?.reduce((sum, p) => sum + p.quantity, 0) || 0
        const totalValue = products?.reduce((sum, p) => sum + (p.quantity * p.price_dealer_cash), 0) || 0
        const lowStockCount = products?.filter(p => p.quantity < p.threshold).length || 0

        return {
          date: format(date, 'MMM dd'),
          totalStock,
          totalValue,
          lowStockCount
        }
      })

      setTrendData(trend)
    } catch (error) {
      console.error('Error fetching trend data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDatasetByMetric = () => {
    switch (selectedMetric) {
      case 'stock':
        return {
          label: 'Total Stock',
          data: trendData.map(d => d.totalStock),
          borderColor: CHART_COLORS.primary,
          backgroundColor: `${CHART_COLORS.primary}20`
        }
      case 'value':
        return {
          label: 'Total Value',
          data: trendData.map(d => d.totalValue),
          borderColor: CHART_COLORS.success,
          backgroundColor: `${CHART_COLORS.success}20`
        }
      case 'lowStock':
        return {
          label: 'Low Stock Items',
          data: trendData.map(d => d.lowStockCount),
          borderColor: CHART_COLORS.warning,
          backgroundColor: `${CHART_COLORS.warning}20`
        }
    }
  }

  const data = {
    labels: trendData.map(d => d.date),
    datasets: [
      {
        ...getDatasetByMetric(),
        fill: true,
        tension: 0.4
      }
    ]
  }

  const options = {
    ...lineChartOptions,
    plugins: {
      ...lineChartOptions.plugins,
      tooltip: {
        ...lineChartOptions.plugins?.tooltip,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y
            if (selectedMetric === 'value') {
              return `${context.dataset.label}: ${formatCurrency(value)}`
            }
            return `${context.dataset.label}: ${value}`
          }
        }
      }
    }
  }

  if (loading) {
    return <div className="h-[400px] flex items-center justify-center">Loading trend data...</div>
  }

  return (
    <div>
      {/* Metric Selector */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setSelectedMetric('stock')}
          className={`px-3 py-1 rounded text-sm ${
            selectedMetric === 'stock'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Total Stock
        </button>
        <button
          onClick={() => setSelectedMetric('value')}
          className={`px-3 py-1 rounded text-sm ${
            selectedMetric === 'value'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Total Value
        </button>
        <button
          onClick={() => setSelectedMetric('lowStock')}
          className={`px-3 py-1 rounded text-sm ${
            selectedMetric === 'lowStock'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Low Stock Items
        </button>
      </div>

      {/* Chart */}
      <div className="h-[400px]">
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  )
})

InventoryTrendChart.displayName = 'InventoryTrendChart'
