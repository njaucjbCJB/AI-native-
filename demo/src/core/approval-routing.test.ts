import { describe, expect, it } from 'vitest'
import { routeApproval } from './approval-routing'
import type { RequestInstance } from './request'
import type { RiskAnalysisResult } from './risk'

describe('ApprovalRoutingSkill', () => {
  it('routes a low-risk request under 10000 to department manager approval only', () => {
    const request = createRequest({ amount: 3200 })
    const risk: RiskAnalysisResult = {
      level: 'low',
      reasons: [],
      matchedRuleIds: [],
    }

    const path = routeApproval(request, risk)

    expect(path).toEqual([
      {
        id: 'department-manager-approval',
        role: 'department_manager',
        name: 'Department Manager Approval',
      },
    ])
  })

  it('routes a request with amount at least 10000 to department manager and finance approvals', () => {
    const request = createRequest({ amount: 10000 })
    const risk: RiskAnalysisResult = {
      level: 'low',
      reasons: [],
      matchedRuleIds: [],
    }

    const path = routeApproval(request, risk)

    expect(path.map((step) => step.role)).toEqual(['department_manager', 'finance'])
  })

  it('routes a medium-risk request to department manager and finance approvals', () => {
    const request = createRequest({ amount: 2500 })
    const risk: RiskAnalysisResult = {
      level: 'medium',
      reasons: ['Vendor is not whitelisted.'],
      matchedRuleIds: ['vendor_not_whitelisted'],
    }

    const path = routeApproval(request, risk)

    expect(path.map((step) => step.role)).toEqual(['department_manager', 'finance'])
  })

  it('routes a high-risk request to department manager, finance, and CEO approvals', () => {
    const request = createRequest({ amount: 12500 })
    const risk: RiskAnalysisResult = {
      level: 'high',
      reasons: ['Amount is at least 10000.', 'Vendor is not whitelisted.'],
      matchedRuleIds: ['high_amount', 'vendor_not_whitelisted'],
    }

    const path = routeApproval(request, risk)

    expect(path).toEqual([
      {
        id: 'department-manager-approval',
        role: 'department_manager',
        name: 'Department Manager Approval',
      },
      {
        id: 'finance-approval',
        role: 'finance',
        name: 'Finance Approval',
      },
      {
        id: 'ceo-confirmation',
        role: 'ceo',
        name: 'CEO Confirmation',
      },
    ])
  })
})

function createRequest(data: Partial<RequestInstance['data']>): RequestInstance {
  return {
    id: 'request-1',
    blueprintId: 'procurement-approval',
    status: 'submitted',
    data: {
      itemName: 'MacBook Pro',
      department: 'Engineering',
      amount: 3200,
      vendor: 'Apple',
      reason: 'Replace an aging laptop for product engineering work.',
      ...data,
    },
    createdAt: '2026-06-03T10:00:00.000Z',
    updatedAt: '2026-06-03T10:00:00.000Z',
  }
}
