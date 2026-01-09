import { supabase } from './supabase'

export const withCompanyFilter = (companyId: string | null) => {
  if (!companyId) {
    console.warn('companyQueries: No company_id provided for filtering')
  }
  return companyId
}

export const createCompanyQuery = (
  tableName: string,
  companyId: string | null,
  selectFields: string = '*'
) => {
  let query = supabase.from(tableName).select(selectFields)

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  return query
}

export const insertWithCompany = async (
  tableName: string,
  data: any,
  companyId: string | null
) => {
  if (!companyId) {
    throw new Error('Cannot insert record without company_id')
  }

  const dataWithCompany = {
    ...data,
    company_id: companyId
  }

  return supabase.from(tableName).insert(dataWithCompany)
}

export const updateWithCompany = async (
  tableName: string,
  data: any,
  matchCondition: { column: string; value: any },
  companyId: string | null
) => {
  if (!companyId) {
    throw new Error('Cannot update record without company_id')
  }

  return supabase
    .from(tableName)
    .update(data)
    .eq(matchCondition.column, matchCondition.value)
    .eq('company_id', companyId)
}
