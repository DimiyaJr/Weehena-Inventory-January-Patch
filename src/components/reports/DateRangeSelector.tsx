import React, { useState } from 'react'
import { Calendar } from 'lucide-react'
import { DateRangeFilter, ReportFilters } from '../../types/reportTypes'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'

interface DateRangeSelectorProps {
  filters: ReportFilters
  onFiltersChange: (filters: ReportFilters) => void
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  filters,
  onFiltersChange
}) => {
  const [showCustomRange, setShowCustomRange] = useState(filters.rangeType === 'custom')

  // Quick filter options
  const quickFilters: { value: DateRangeFilter; label: string }[] = [
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' }
  ]

  // Generate last 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i)
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
      start: startOfMonth(date),
      end: endOfMonth(date)
    }
  })

  const handleQuickFilter = (rangeType: DateRangeFilter) => {
    const endDate = new Date()
    let startDate = new Date()

    switch (rangeType) {
      case '7days':
        startDate = subDays(endDate, 7)
        break
      case '30days':
        startDate = subDays(endDate, 30)
        break
      case '90days':
        startDate = subDays(endDate, 90)
        break
    }

    onFiltersChange({
      ...filters,
      rangeType,
      startDate,
      endDate
    })
    setShowCustomRange(false)
  }

  const handleMonthSelect = (monthOption: typeof monthOptions[0]) => {
    onFiltersChange({
      ...filters,
      rangeType: 'custom',
      startDate: monthOption.start,
      endDate: monthOption.end
    })
    setShowCustomRange(false)
  }

  const handleCustomRange = () => {
    setShowCustomRange(true)
    onFiltersChange({
      ...filters,
      rangeType: 'custom'
    })
  }

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const date = new Date(value)
    if (isNaN(date.getTime())) return

    const newFilters = {
      ...filters,
      [field]: date
    }

    // Validation
    if (field === 'endDate' && date > new Date()) {
      return // Don't allow future dates
    }
    if (field === 'startDate' && date > filters.endDate) {
      return // Start date can't be after end date
    }
    if (field === 'endDate' && date < filters.startDate) {
      return // End date can't be before start date
    }

    onFiltersChange(newFilters)
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center space-x-2">
        <Calendar className="w-5 h-5 text-gray-600" />
        <h3 className="font-semibold text-gray-900">Date Range</h3>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        {quickFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => handleQuickFilter(filter.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.rangeType === filter.value && !showCustomRange
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
        <button
          onClick={handleCustomRange}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showCustomRange
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Custom Range
        </button>
      </div>

      {/* Month Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Month
        </label>
        <select
          onChange={(e) => {
            const selected = monthOptions.find(m => m.value === e.target.value)
            if (selected) handleMonthSelect(selected)
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option value="">Select a month...</option>
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Date Range Inputs */}
      {showCustomRange && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={format(filters.startDate, 'yyyy-MM-dd')}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
              max={format(filters.endDate, 'yyyy-MM-dd')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={format(filters.endDate, 'yyyy-MM-dd')}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              min={format(filters.startDate, 'yyyy-MM-dd')}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Selected Range Display */}
      <div className="text-sm text-gray-600 pt-2 border-t">
        Selected: {format(filters.startDate, 'MMM dd, yyyy')} - {format(filters.endDate, 'MMM dd, yyyy')}
      </div>
    </div>
  )
}
