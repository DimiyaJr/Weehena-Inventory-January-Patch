import { ChartOptions } from 'chart.js'

// Color palette - using earth tones, no purple/violet
export const CHART_COLORS = {
  primary: '#DC2626', // red-600
  primaryLight: '#EF4444', // red-500
  secondary: '#F97316', // orange-500
  accent: '#3B82F6', // blue-500
  success: '#10B981', // green-500
  warning: '#F59E0B', // amber-500
  danger: '#DC2626', // red-600
  gray: '#6B7280', // gray-500
  
  // Category colors (5 distinct colors)
  categories: [
    '#DC2626', // red
    '#F97316', // orange
    '#F59E0B', // amber
    '#10B981', // green
    '#3B82F6', // blue
  ],
  
  // Pricing tier colors
  pricingTiers: {
    dealer_cash: '#DC2626', // red
    dealer_credit: '#F97316', // orange
    hotel_non_vat: '#F59E0B', // amber
    hotel_vat: '#10B981', // green
    farm_shop: '#3B82F6', // blue
  }
}

// Default chart options
export const defaultChartOptions: ChartOptions<any> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        font: {
          family: 'system-ui, -apple-system, sans-serif',
          size: 12
        },
        padding: 10,
        usePointStyle: true
      }
    },
    tooltip: {
      backgroundColor: '#ffffff',
      titleColor: '#1F2937',
      bodyColor: '#4B5563',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      padding: 12,
      boxPadding: 6,
      usePointStyle: true,
      callbacks: {}
    }
  },
  animation: {
    duration: 750,
    easing: 'easeInOutQuart' as const
  }
}

// Bar chart specific options
export const barChartOptions: ChartOptions<'bar'> = {
  ...defaultChartOptions,
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        font: {
          size: 11
        }
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: '#E5E7EB'
      },
      ticks: {
        font: {
          size: 11
        }
      }
    }
  }
}

// Horizontal bar chart options
export const horizontalBarOptions: ChartOptions<'bar'> = {
  ...barChartOptions,
  indexAxis: 'y' as const
}

// Pie/Doughnut chart options
export const pieChartOptions: ChartOptions<'pie'> = {
  ...defaultChartOptions,
  plugins: {
    ...defaultChartOptions.plugins,
    legend: {
      position: 'right' as const,
      labels: {
        font: {
          family: 'system-ui, -apple-system, sans-serif',
          size: 12
        },
        padding: 10,
        usePointStyle: true
      }
    }
  }
}

// Line chart options
export const lineChartOptions: ChartOptions<'line'> = {
  ...defaultChartOptions,
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        font: {
          size: 11
        }
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: '#E5E7EB'
      },
      ticks: {
        font: {
          size: 11
        }
      }
    }
  },
  elements: {
    line: {
      tension: 0.4 // Smooth curves
    },
    point: {
      radius: 4,
      hitRadius: 10,
      hoverRadius: 6
    }
  }
}
