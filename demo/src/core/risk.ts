import type { RequestInstance } from './request'

const WHITELISTED_VENDORS = ['Apple', 'Dell', 'Lenovo', 'Amazon Business']

export type RiskLevel = 'low' | 'medium' | 'high'

export type RiskAnalysisResult = {
  level: RiskLevel
  reasons: string[]
  matchedRuleIds: string[]
}

type RiskAnalysisContext = {
  previousRequests?: RequestInstance[]
}

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000

export function analyzeProcurementRisk(
  request: RequestInstance,
  context: RiskAnalysisContext = {},
): RiskAnalysisResult {
  const matchedRules: Array<{ id: string; reason: string }> = []
  const amount = Number(request.data.amount)

  if (amount >= 10000) {
    matchedRules.push({
      id: 'high_amount',
      reason: 'Amount is at least 10000.',
    })
  }

  if (!WHITELISTED_VENDORS.includes(String(request.data.vendor))) {
    matchedRules.push({
      id: 'vendor_not_whitelisted',
      reason: 'Vendor is not whitelisted.',
    })
  }

  if (String(request.data.reason ?? '').trim().length < 20) {
    matchedRules.push({
      id: 'incomplete_reason',
      reason: 'Purchase reason is incomplete.',
    })
  }

  if (hasSimilarRecentRequest(request, context.previousRequests ?? [])) {
    matchedRules.push({
      id: 'similar_recent_request',
      reason: 'Similar request exists in the last 30 days.',
    })
  }

  return {
    level: getRiskLevel(matchedRules.length),
    reasons: matchedRules.map((rule) => rule.reason),
    matchedRuleIds: matchedRules.map((rule) => rule.id),
  }
}

function getRiskLevel(matchCount: number): RiskLevel {
  if (matchCount === 0) {
    return 'low'
  }

  if (matchCount >= 2) {
    return 'high'
  }

  return 'medium'
}

function hasSimilarRecentRequest(
  request: RequestInstance,
  previousRequests: RequestInstance[],
): boolean {
  const requestCreatedAt = new Date(request.createdAt).getTime()

  return previousRequests.some((previousRequest) => {
    const previousCreatedAt = new Date(previousRequest.createdAt).getTime()
    const ageInMs = requestCreatedAt - previousCreatedAt

    return (
      previousRequest.data.itemName === request.data.itemName &&
      ageInMs >= 0 &&
      ageInMs <= THIRTY_DAYS_IN_MS
    )
  })
}
