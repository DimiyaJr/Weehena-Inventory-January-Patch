import React, { useRef, useEffect } from 'react'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import { pieChartOptions, CHART_COLORS } from '../../config/chartConfig'
import { StockLevelItem } from '../../types/reportTypes'

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend)

interface LowStockAlertChartProps {
  products: StockLevelItem[]
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
}

export const LowStockAlertChart: React.FC<LowStockAlertChartProps> = React.memo(({
  products,
  onCanvasReady
}) => {
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (chartRef.current && onCanvasReady) {
      onCanvasReady(chartRef.current.canvas)
    }
  }, [chartRef.current, onCanvasReady])

  // Count products by status
  const statusCounts = {
    critical: products.filter(p => p.status === 'critical').length,
    warning: products.filter(p => p.status === 'warning').length,
    low: products.filter(p => p.status === 'low').length,
    adequate: products.filter(p => p.status === 'adequate').length
  }

  const data = {
    labels: ['Critical', 'Warning', 'Low', 'Adequate'],
    datasets: [
      {
        label: 'Product Count',
        data: [
          statusCounts.critical,
          statusCounts.warning,
          statusCounts.low,
          statusCounts.adequate
        ],
        backgroundColor: [
          CHART_COLORS.danger,
          CHART_COLORS.warning,
          CHART_COLORS.secondary,
          CHART_COLORS.success
        ],
        borderColor: '#ffffff',
        borderWidth: 2
      }
    ]
  }

  const options = {
    ...pieChartOptions,
    plugins: {
      ...pieChartOptions.plugins,
      tooltip: {
        ...pieChartOptions.plugins?.tooltip,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
            return `${context.label}: ${value} products (${percentage}%)`
          }
        }
      }
    }
  }

  return (
    <div className="h-[350px]">
      <Doughnut ref={chartRef} data={data} options={options} />
      
      {/* Legend with additional info */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-600 mr-2"></div>
          <span>Critical: {statusCounts.critical}</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
          <span>Warning: {statusCounts.warning}</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
          <span>Low: {statusCounts.low}</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
          <span>Adequate: {statusCounts.adequate}</span>
        </div>
      </div>
    </div>
  )
})

LowStockAlertChart.displayName = 'LowStockAlertChart'
