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
import { PricingTierAnalysis } from '../../types/reportTypes'
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

interface SalesByPricingTierChartProps {
  pricingData: PricingTierAnalysis[]
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
}

export const SalesByPricingTierChart: React.FC<SalesByPricingTierChartProps> = React.memo(({
  pricingData,
  onCanvasReady
}) => {
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (chartRef.current && onCanvasReady) {
      onCanvasReady(chartRef.current.canvas)
    }
  }, [chartRef.current, onCanvasReady])

  const getColorForTier = (tierKey: string) => {
    switch (tierKey) {
      case 'price_dealer_cash':
        return CHART_COLORS.pricingTiers.dealer_cash
      case 'price_dealer_credit':
        return CHART_COLORS.pricingTiers.dealer_credit
      case 'price_hotel_non_vat':
        return CHART_COLORS.pricingTiers.hotel_non_vat
      case 'price_hotel_vat':
        return CHART_COLORS.pricingTiers.hotel_vat
      case 'price_farm_shop':
        return CHART_COLORS.pricingTiers.farm_shop
      default:
        return CHART_COLORS.gray
    }
  }

  const data = {
    labels: pricingData.map(p => p.tierName),
    datasets: [
      {
        label: 'Total Revenue',
        data: pricingData.map(p => p.totalRevenue),
        backgroundColor: pricingData.map(p => getColorForTier(p.tierKey)),
        borderColor: pricingData.map(p => getColorForTier(p.tierKey)),
        borderWidth: 1
      }
    ]
  }

  const options = {
    ...barChartOptions,
    scales: {
      ...barChartOptions.scales,
      y: {
        ...barChartOptions.scales?.y,
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
            const tier = pricingData[context.dataIndex]
            return [
              `Revenue: ${formatCurrency(context.parsed.y)}`,
              `Products: ${tier.productCount}`,
              `Avg Price: ${formatCurrency(tier.averagePrice)}`
            ]
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

SalesByPricingTierChart.displayName = 'SalesByPricingTierChart'
