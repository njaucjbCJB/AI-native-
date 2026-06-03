import { describe, expect, it } from 'vitest'
import { analyzeProcurementRisk } from './risk'
import type { RequestInstance } from './request'

describe('RiskAnalysisSkill', () => {
  it('returns low risk when a procurement request matches no risk rules', () => {
    const request = createRequest({
      amount: 3200,
      vendor: 'Apple',
      reason: 'Replace an aging laptop for product engineering work.',
    })

    const result = analyzeProcurementRisk(request)

    expect(result).toEqual({
      level: 'low',
      reasons: [],
      matchedRuleIds: [],
    })
  })

  it('returns medium risk when the amount is at least 10000', () => {
    const request = createRequest({
      amount: 10000,
      vendor: 'Dell',
      reason: 'Buy approved monitors for the finance team workspace.',
    })

    const result = analyzeProcurementRisk(request)

    expect(result).toEqual({
      level: 'medium',
      reasons: ['Amount is at least 10000.'],
      matchedRuleIds: ['high_amount'],
    })
  })

  it('returns medium risk when the vendor is not whitelisted', () => {
    const request = createRequest({
      amount: 900,
      vendor: 'Unknown Vendor',
      reason: 'Buy standard accessories for the operations onboarding kit.',
    })

    const result = analyzeProcurementRisk(request)

    expect(result).toEqual({
      level: 'medium',
      reasons: ['Vendor is not whitelisted.'],
      matchedRuleIds: ['vendor_not_whitelisted'],
    })
  })

  it('returns medium risk when the purchase reason is incomplete', () => {
    const request = createRequest({
      amount: 800,
      vendor: 'Lenovo',
      reason: 'Need it.',
    })

    const result = analyzeProcurementRisk(request)

    expect(result).toEqual({
      level: 'medium',
      reasons: ['Purchase reason is incomplete.'],
      matchedRuleIds: ['incomplete_reason'],
    })
  })

  it('returns medium risk when a similar request exists in the last 30 days', () => {
    const request = createRequest({
      itemName: 'MacBook Pro',
      amount: 3200,
      vendor: 'Apple',
      reason: 'Replace an aging laptop for product engineering work.',
    })
    const recentSimilarRequest = createRequest({
      itemName: 'MacBook Pro',
      amount: 3000,
      vendor: 'Apple',
      reason: 'Provide a laptop for a new engineering teammate.',
    })

    const result = analyzeProcurementRisk(request, {
      previousRequests: [recentSimilarRequest],
    })

    expect(result).toEqual({
      level: 'medium',
      reasons: ['Similar request exists in the last 30 days.'],
      matchedRuleIds: ['similar_recent_request'],
    })
  })

  it('returns high risk when two or more risk rules match', () => {
    const request = createRequest({
      amount: 12500,
      vendor: 'Unknown Vendor',
      reason: 'Buy specialized lab equipment for engineering validation work.',
    })

    const result = analyzeProcurementRisk(request)

    expect(result).toEqual({
      level: 'high',
      reasons: ['Amount is at least 10000.', 'Vendor is not whitelisted.'],
      matchedRuleIds: ['high_amount', 'vendor_not_whitelisted'],
    })
  })
})

function createRequest(data: RequestInstance['data']): RequestInstance {
  return {
    id: 'request-1',
    blueprintId: 'procurement-approval',
    status: 'submitted',
    data: {
      itemName: 'MacBook Pro',
      department: 'Engineering',
      ...data,
    },
    createdAt: '2026-06-03T10:00:00.000Z',
    updatedAt: '2026-06-03T10:00:00.000Z',
  }
}
