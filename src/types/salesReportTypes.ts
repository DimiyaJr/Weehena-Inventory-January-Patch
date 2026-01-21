// Sales Report Type Definitions
export interface SalesReportFilters {
  startDate: Date
  endDate: Date
  rangeType: DateRangeFilter
  selectedCustomers: string[] // customer IDs
  selectedSalesReps: string[] // user IDs
  paymentStatus: 'all' | 'fully_paid' | 'partially_paid' | 'unpaid'
  orderStatus: 'all' | 'completed' | 'delivered'
}

export interface SalesTransaction {
  orderId: string
  orderDisplayId: string
  orderDate: string
  customerId: string
  customerName: string
  customerDisplayId: string
  salesRepId: string | null
  salesRepName: string
  totalAmount: number
  paymentStatus: string
  orderStatus: string
  items: SalesTransactionItem[]
}

export interface SalesTransactionItem {
  productId: string
  productName: string
  quantity: number
  price: number
  subtotal: number
}

export interface CustomerSalesData {
  customerId: string
  customerName: string
  customerDisplayId: string
  orderCount: number
  totalRevenue: number
  averageOrderValue: number
  lastOrderDate: string
}

export interface SalesRepSalesData {
  salesRepId: string
  salesRepName: string
  employeeId: string | null
  orderCount: number
  totalRevenue: number
  averageOrderValue: number
  uniqueCustomers: number
}

export interface SalesReportData {
  summary: SalesSummary
  customerBreakdown: CustomerSalesData[]
  salesRepBreakdown: SalesRepSalesData[]
  transactions: SalesTransaction[]
  productBreakdown: ProductSalesBreakdown[]
  dailySales: DailySalesData[]
}

export interface SalesSummary {
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
  uniqueCustomers: number
  activeSalesReps: number
}

export interface ProductSalesBreakdown {
  productId: string
  productName: string
  quantitySold: number
  totalRevenue: number
  orderCount: number
}

export interface DailySalesData {
  date: string
  revenue: number
  orderCount: number
}

// Import from reportTypes.ts
export type { DateRangeFilter } from './reportTypes'
