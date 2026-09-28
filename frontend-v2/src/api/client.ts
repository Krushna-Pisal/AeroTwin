import { mockEnvironment } from '@/mocks/data'

export async function fetchWithMockFallback<T>(url: string, options?: RequestInit, mockData?: any): Promise<T> {
  try {
    const response = await fetch(url, options)
    if (!response.ok) {
      if (mockData) {
        console.warn(`[Mock Fallback] API failed (${response.status}) for ${url}. Using mock data.`)
        return mockData as T
      }
      throw new Error(`API error: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    if (mockData) {
      console.warn(`[Mock Fallback] Network error for ${url}. Using mock data.`, error)
      return mockData as T
    }
    throw error
  }
}

export const apiEndpoints = {
  getEnvironment: (stationId: string) => 
    fetchWithMockFallback(`/api/environment/${stationId}`, undefined, mockEnvironment),
  
  postCitizenReport: (data: any) => 
    fetchWithMockFallback('/api/complaint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, { success: true, ticket_id: 'TICKET-' + Math.floor(Math.random()*1000) })
}
