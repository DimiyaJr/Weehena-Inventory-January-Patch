// Import base types from supabase
import { Product, Category } from '../lib/supabase'

// Main report data interface
export interface InventoryReportData {
  totalProducts: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
  categoryBreakdown: CategoryInventoryData[]
  pricingAnalysis: PricingTierAnalysis[]
  stockLevelData: StockLevelItem[]
}

// Category breakdown data
export interface CategoryInventoryData {
  categoryId: string
  categoryName: string
  productCount: number
  totalQuantity: number
  valueDealerCash: number
  valueDealerCredit: number
  valueHotelNonVat: number
  valueHotelVat: number
  valueFarmShop: number
}

// Pricing tier analysis
export interface PricingTierAnalysis {
  tierName: 'Dealer Cash' | 'Dealer Credit' | 'Hotel Non-VAT' | 'Hotel VAT' | 'Farm Shop'
  tierKey: 'price_dealer_cash' | 'price_dealer_credit' | 'price_hotel_non_vat' | 'price_hotel_vat' | 'price_farm_shop'
  totalRevenue: number
  productCount: number
  averagePrice: number
}

// Stock level item
export interface StockLevelItem {
  productId: string
  productName: string
  currentStock: number
  threshold: number
  status: 'critical' | 'warning' | 'low' | 'adequate'
  category: string
  categoryId: string
}

// Inventory trend data for charts
export interface InventoryTrendData {
  date: string
  totalStock: number
  totalValue: number
  lowStockItems: number
  outOfStockItems: number
  categoryCounts: { [categoryName: string]: number }
}

// Date range filter type
export type DateRangeFilter = '7days' | '30days' | '90days' | 'custom'

// Report filters
export interface ReportFilters {
  startDate: Date
  endDate: Date
  rangeType: DateRangeFilter
  selectedCategories: string[] // category IDs
  selectedPricingTiers: string[] // pricing tier keys
}

// Export this type as well for chart canvas references
export interface ChartCanvasRefs {
  stockLevelChart: HTMLCanvasElement | null
  categoryDistributionChart: HTMLCanvasElement | null
  inventoryValueChart: HTMLCanvasElement | null
  lowStockAlertChart: HTMLCanvasElement | null
  inventoryTrendChart: HTMLCanvasElement | null
  salesByPricingTierChart: HTMLCanvasElement | null
}
