import React, { useRef, useEffect } from 'react'
import { Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import { pieChartOptions, CHART_COLORS } from '../../config/chartConfig'
import { CategoryInventoryData } from '../../types/reportTypes'

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend)

interface CategoryDistributionChartProps {
  categoryData: CategoryInventoryData[]
  valueType: 'quantity' | 'value'
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
}

export const CategoryDistributionChart: React.FC<CategoryDistributionChartProps> = React.memo(({
  categoryData,
  valueType,
  onCanvasReady
}) => {
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (chartRef.current && onCanvasReady) {
      onCanvasReady(chartRef.current.canvas)
    }
  }, [chartRef.current, onCanvasReady])

  const getValue = (cat: CategoryInventoryData) => {
    if (valueType === 'quantity') return cat.totalQuantity
    // Average value across all pricing tiers
    return (
      cat.valueDealerCash +
      cat.valueDealerCredit +
      cat.valueHotelNonVat +
      cat.valueHotelVat +
      cat.valueFarmShop
    ) / 5
  }

  const data = {
    labels: categoryData.map(c => c.categoryName),
    datasets: [
      {
        label: valueType === 'quantity' ? 'Total Quantity' : 'Average Value',
        data: categoryData.map(getValue),
        backgroundColor: CHART_COLORS.categories,
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
            const percentage = ((value / total) * 100).toFixed(1)
            return `${context.label}: ${value.toLocaleString()} (${percentage}%)`
          }
        }
      }
    }
  }

  return (
    <div className="h-[400px]">
      <Pie ref={chartRef} data={data} options={options} />
    </div>
  )
})

CategoryDistributionChart.displayName = 'CategoryDistributionChart'
