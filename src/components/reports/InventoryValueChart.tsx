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
import { barChartOptions, CHART_COLORS } from '../../config/chartConfig'
import { CategoryInventoryData } from '../../types/reportTypes'
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

interface InventoryValueChartProps {
  categoryData: CategoryInventoryData[]
  pricingTier: 'dealer_cash' | 'dealer_credit' | 'hotel_non_vat' | 'hotel_vat' | 'farm_shop' | 'all'
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
}

export const InventoryValueChart: React.FC<InventoryValueChartProps> = React.memo(({
  categoryData,
  pricingTier,
  onCanvasReady
}) => {
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (chartRef.current && onCanvasReady) {
      onCanvasReady(chartRef.current.canvas)
    }
  }, [chartRef.current, onCanvasReady])

  // Get value based on pricing tier
  const getValue = (cat: CategoryInventoryData) => {
    switch (pricingTier) {
      case 'dealer_cash':
        return cat.valueDealerCash
      case 'dealer_credit':
        return cat.valueDealerCredit
      case 'hotel_non_vat':
        return cat.valueHotelNonVat
      case 'hotel_vat':
        return cat.valueHotelVat
      case 'farm_shop':
        return cat.valueFarmShop
      case 'all':
        // Average across all tiers
        return (
          cat.valueDealerCash +
          cat.valueDealerCredit +
          cat.valueHotelNonVat +
          cat.valueHotelVat +
          cat.valueFarmShop
        ) / 5
      default:
        return 0
    }
  }

  // If showing all tiers, create stacked bar chart
  const isStacked = pricingTier === 'all'

  const data = isStacked ? {
    labels: categoryData.map(c => c.categoryName),
    datasets: [
      {
        label: 'Dealer Cash',
        data: categoryData.map(c => c.valueDealerCash),
        backgroundColor: CHART_COLORS.pricingTiers.dealer_cash,
        borderColor: CHART_COLORS.pricingTiers.dealer_cash,
        borderWidth: 1
      },
      {
        label: 'Dealer Credit',
        data: categoryData.map(c => c.valueDealerCredit),
        backgroundColor: CHART_COLORS.pricingTiers.dealer_credit,
        borderColor: CHART_COLORS.pricingTiers.dealer_credit,
        borderWidth: 1
      },
      {
        label: 'Hotel Non-VAT',
        data: categoryData.map(c => c.valueHotelNonVat),
        backgroundColor: CHART_COLORS.pricingTiers.hotel_non_vat,
        borderColor: CHART_COLORS.pricingTiers.hotel_non_vat,
        borderWidth: 1
      },
      {
        label: 'Hotel VAT',
        data: categoryData.map(c => c.valueHotelVat),
        backgroundColor: CHART_COLORS.pricingTiers.hotel_vat,
        borderColor: CHART_COLORS.pricingTiers.hotel_vat,
        borderWidth: 1
      },
      {
        label: 'Farm Shop',
        data: categoryData.map(c => c.valueFarmShop),
        backgroundColor: CHART_COLORS.pricingTiers.farm_shop,
        borderColor: CHART_COLORS.pricingTiers.farm_shop,
        borderWidth: 1
      }
    ]
  } : {
    labels: categoryData.map(c => c.categoryName),
    datasets: [
      {
        label: 'Inventory Value',
        data: categoryData.map(getValue),
        backgroundColor: CHART_COLORS.primary,
        borderColor: CHART_COLORS.primary,
        borderWidth: 1
      }
    ]
  }

  const options = {
    ...barChartOptions,
    scales: {
      ...barChartOptions.scales,
      x: {
        ...barChartOptions.scales?.x,
        stacked: isStacked
      },
      y: {
        ...barChartOptions.scales?.y,
        stacked: isStacked,
        ticks: {
          ...barChartOptions.scales?.y?.ticks,
          callback: (value: any) => formatCurrency(value)
        }
      }
    },
    plugins: {
      ...barChartOptions.plugins,
      tooltip: {
        ...barChartOptions.plugins?.tooltip,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
          }
        }
      }
    }
  }

  return (
    <div className="h-[400px]">
      <Bar ref={chartRef} data={data} options={options} />
    </div>
  )
})

InventoryValueChart.displayName = 'InventoryValueChart'
