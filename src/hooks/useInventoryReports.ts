import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { 
  InventoryReportData, 
  CategoryInventoryData, 
  PricingTierAnalysis, 
  StockLevelItem,
  ReportFilters 
} from '../types/reportTypes'
import { Product } from '../lib/supabase'

export const useInventoryReports = (filters: ReportFilters) => {
  const [reportData, setReportData] = useState<InventoryReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calculate cache key based on filters
  const getCacheKey = () => {
    const dateKey = `${filters.startDate.toISOString()}_${filters.endDate.toISOString()}`
    const catKey = filters.selectedCategories.join(',')
    const tierKey = filters.selectedPricingTiers.join(',')
    return `inventory_reports_${dateKey}_${catKey}_${tierKey}`
  }

  // Fetch products with categories
  const fetchInventoryData = useCallback(async () => {
    try {
      // Build query
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          category_id,
          quantity,
          threshold,
          price_dealer_cash,
          price_dealer_credit,
          price_hotel_non_vat,
          price_hotel_vat,
          price_farm_shop,
          unit_type,
          weight_per_pack_kg,
          grams_per_unit,
          categories (
            category_id,
            category_name,
            category_code
          )
        `)

      // Apply category filter if specified
      if (filters.selectedCategories.length > 0) {
        query = query.in('category_id', filters.selectedCategories)
      }

      const { data: products, error: productsError } = await query

      if (productsError) throw productsError
      if (!products) throw new Error('No products found')

      return products as any[]
    } catch (err) {
      console.error('Error fetching inventory data:', err)
      throw err
    }
  }, [filters])

  // Calculate metrics from products
  const calculateMetrics = useCallback((products: any[]): InventoryReportData => {
    // Initialize data structures
    const categoryMap = new Map<string, CategoryInventoryData>()
    const pricingTierMap = new Map<string, PricingTierAnalysis>()
    const stockLevelItems: StockLevelItem[] = []
    
    let totalProducts = 0
    let totalValue = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    // Process each product
    products.forEach((product) => {
      totalProducts++

      // Calculate stock status
      const stockPercentage = product.threshold > 0 
        ? (product.quantity / product.threshold) * 100 
        : 100
      
      let status: 'critical' | 'warning' | 'low' | 'adequate' = 'adequate'
      if (product.quantity <= 0) {
        outOfStockCount++
        status = 'critical'
      } else if (stockPercentage < 25) {
        lowStockCount++
        status = 'critical'
      } else if (stockPercentage < 50) {
        lowStockCount++
        status = 'warning'
      } else if (stockPercentage < 100) {
        status = 'low'
      }

      // Add to stock level items
      stockLevelItems.push({
        productId: product.id,
        productName: product.name,
        currentStock: product.quantity,
        threshold: product.threshold,
        status,
        category: product.categories?.category_name || 'Uncategorized',
        categoryId: product.category_id || ''
      })

      // Calculate values by pricing tier
      const tiers = [
        { key: 'price_dealer_cash', name: 'Dealer Cash', price: product.price_dealer_cash },
        { key: 'price_dealer_credit', name: 'Dealer Credit', price: product.price_dealer_credit },
        { key: 'price_hotel_non_vat', name: 'Hotel Non-VAT', price: product.price_hotel_non_vat },
        { key: 'price_hotel_vat', name: 'Hotel VAT', price: product.price_hotel_vat },
        { key: 'price_farm_shop', name: 'Farm Shop', price: product.price_farm_shop }
      ]

      tiers.forEach(tier => {
        const value = product.quantity * tier.price
        totalValue += value / tiers.length // Average value across tiers

        // Update pricing tier map
        if (!pricingTierMap.has(tier.key)) {
          pricingTierMap.set(tier.key, {
            tierName: tier.name as any,
            tierKey: tier.key as any,
            totalRevenue: 0,
            productCount: 0,
            averagePrice: 0
          })
        }
        const tierData = pricingTierMap.get(tier.key)!
        tierData.totalRevenue += value
        tierData.productCount++
        tierData.averagePrice = tierData.totalRevenue / tierData.productCount
      })

      // Update category breakdown
      const categoryId = product.category_id || 'uncategorized'
      const categoryName = product.categories?.category_name || 'Uncategorized'
      
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          categoryId,
          categoryName,
          productCount: 0,
          totalQuantity: 0,
          valueDealerCash: 0,
          valueDealerCredit: 0,
          valueHotelNonVat: 0,
          valueHotelVat: 0,
          valueFarmShop: 0
        })
      }

      const catData = categoryMap.get(categoryId)!
      catData.productCount++
      catData.totalQuantity += product.quantity
      catData.valueDealerCash += product.quantity * product.price_dealer_cash
      catData.valueDealerCredit += product.quantity * product.price_dealer_credit
      catData.valueHotelNonVat += product.quantity * product.price_hotel_non_vat
      catData.valueHotelVat += product.quantity * product.price_hotel_vat
      catData.valueFarmShop += product.quantity * product.price_farm_shop
    })

    // Sort stock level items by status severity
    stockLevelItems.sort((a, b) => {
      const statusOrder = { critical: 0, warning: 1, low: 2, adequate: 3 }
      return statusOrder[a.status] - statusOrder[b.status]
    })

    return {
      totalProducts,
      totalValue,
      lowStockCount,
      outOfStockCount,
      categoryBreakdown: Array.from(categoryMap.values()),
      pricingAnalysis: Array.from(pricingTierMap.values()),
      stockLevelData: stockLevelItems
    }
  }, [])

  // Main fetch function
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Check cache first
      const cacheKey = getCacheKey()
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached)
        const age = Date.now() - timestamp
        if (age < 5 * 60 * 1000) { // 5 minutes cache
          setReportData(cachedData)
          setLoading(false)
          return
        }
      }

      // Fetch fresh data
      const products = await fetchInventoryData()
      const metrics = calculateMetrics(products)

      // Cache the results
      localStorage.setItem(cacheKey, JSON.stringify({
        data: metrics,
        timestamp: Date.now()
      }))

      setReportData(metrics)
    } catch (err: any) {
      console.error('useInventoryReports error:', err)
      setError(err.message || 'Failed to fetch inventory data')
      
      // Try to use cached data on error
      const cacheKey = getCacheKey()
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data: cachedData } = JSON.parse(cached)
        setReportData(cachedData)
      }
    } finally {
      setLoading(false)
    }
  }, [filters, fetchInventoryData, calculateMetrics])

  // Fetch data when filters change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    reportData,
    loading,
    error,
    refetch: fetchData
  }
}
