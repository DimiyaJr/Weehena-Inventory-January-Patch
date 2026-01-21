import React, { useRef, useEffect } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { horizontalBarOptions, CHART_COLORS } from '../../config/chartConfig'
import { StockLevelItem } from '../../types/reportTypes'
import { formatCurrency } from '../../utils/formatters'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface StockLevelChartProps {
  products: StockLevelItem[]
  title?: string
  showThreshold?: boolean
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
}

export const StockLevelChart: React.FC<StockLevelChartProps> = React.memo(({
  products,
  title = 'Stock Levels',
  showThreshold = true,
  onCanvasReady
}) => {
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (chartRef.current && onCanvasReady) {
      onCanvasReady(chartRef.current.canvas)
    }
  }, [chartRef.current, onCanvasReady])

  // Take top 20 products for visibility
  const topProducts = products.slice(0, 20)

  const data = {
    labels: topProducts.map(p => p.productName),
    datasets: [
      {
        label: 'Current Stock',
        data: topProducts.map(p => p.currentStock),
        backgroundColor: topProducts.map(p => {
          if (p.status === 'critical') return CHART_COLORS.danger
          if (p.status === 'warning') return CHART_COLORS.warning
          if (p.status === 'low') return CHART_COLORS.secondary
          return CHART_COLORS.success
        }),
        borderColor: topProducts.map(p => {
          if (p.status === 'critical') return CHART_COLORS.danger
          if (p.status === 'warning') return CHART_COLORS.warning
          if (p.status === 'low') return CHART_COLORS.secondary
          return CHART_COLORS.success
        }),
        borderWidth: 1
      },
      ...(showThreshold ? [{
        label: 'Threshold',
        data: topProducts.map(p => p.threshold),
        backgroundColor: 'rgba(107, 114, 128, 0.2)',
        borderColor: CHART_COLORS.gray,
        borderWidth: 2,
        borderDash: [5, 5]
      }] : [])
    ]
  }

  const options = {
    ...horizontalBarOptions,
    plugins: {
      ...horizontalBarOptions.plugins,
      tooltip: {
        ...horizontalBarOptions.plugins?.tooltip,
        callbacks: {
          label: (context: any) => {
            const product = topProducts[context.dataIndex]
            const value = context.parsed.x
            const percentage = product.threshold > 0 
              ? ((product.currentStock / product.threshold) * 100).toFixed(1)
              : '0'
            return `${context.dataset.label}: ${value} (${percentage}% of threshold)`
          }
        }
      }
    }
  }

  return (
    <div className="h-[500px]">
      <Bar ref={chartRef} data={data} options={options} />
    </div>
  )
})

StockLevelChart.displayName = 'StockLevelChart'
