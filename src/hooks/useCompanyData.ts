import { useAuth } from './useAuth'

export const useCompanyData = () => {
  const { user } = useAuth()

  const getCompanyFilter = () => {
    // Multi-company support removed - return null for now
    return null
  }

  const addCompanyId = (data: any) => {
    // Multi-company support removed - return data as-is
    return data
  }

  const validateCompanyAccess = (): boolean => {
    // Multi-company support removed - always return true
    return true
  }

  const requireCompanyAccess = () => {
    // Multi-company support removed - no validation needed
  }

  return {
    companyId: null,
    hasCompanyAccess: true,
    getCompanyFilter,
    addCompanyId,
    validateCompanyAccess,
    requireCompanyAccess
  }
}
