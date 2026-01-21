import React from 'react'
import { LucideIcon } from 'lucide-react'

interface ReportCardProps {
  title: string
  children: React.ReactNode
  icon?: LucideIcon
  isLoading?: boolean
  error?: string | null
  className?: string
}

export const ReportCard: React.FC<ReportCardProps> = ({
  title,
  children,
  icon: Icon,
  isLoading,
  error,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center mb-4">
        {Icon && <Icon className="w-5 h-5 text-red-600 mr-2" />}
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        children
      )}
    </div>
  )
}
