import { describe, expect, it } from 'vitest'
import {
  generateProcurementReport,
  generateReportFromRuntimeStorage,
  runReportGenerationSkill,
} from './report'
import type { RequestInstance } from './request'
import type { RiskAnalysisResult } from './risk'
import { LocalStorageAdapter, MemoryStorage } from './storage'
import type { WorkflowInstance } from './workflow'

describe('ReportGenerationSkill', () => {
  it('generates procurement metrics and an AI CEO summary from runtime data', () => {
    const approvedRequest = createRequest('request-approved', 12000)
    const submittedRequest = createRequest('request-submitted', 800)
    const workflows: WorkflowInstance[] = [
      {
        requestId: approvedRequest.id,
        status: 'approved',
        approvalPath: [],
        currentStepIndex: 1,
        currentStep: null,
        approvalRecords: [
          {
            stepId: 'department-manager-approval',
            role: 'department_manager',
            decision: 'approved',
            comment: 'Approved.',
            decidedAt: '2026-06-03T12:00:00.000Z',
          },
        ],
        archivedAt: '2026-06-03T12:00:00.000Z',
        updatedAt: '2026-06-03T12:00:00.000Z',
      },
    ]
    const riskResults: Record<string, RiskAnalysisResult> = {
      [approvedRequest.id]: {
        level: 'high',
        reasons: ['Amount is at least 10000.', 'Vendor is not whitelisted.'],
        matchedRuleIds: ['high_amount', 'vendor_not_whitelisted'],
      },
      [submittedRequest.id]: {
        level: 'low',
        reasons: [],
        matchedRuleIds: [],
      },
    }

    const report = generateProcurementReport(
      {
        requests: [approvedRequest, submittedRequest],
        workflows,
        riskResults,
      },
      {
        id: () => 'report-1',
        now: () => new Date('2026-06-03T15:00:00.000Z'),
      },
    )

    expect(report).toEqual({
      id: 'report-1',
      totalAmount: 12800,
      requestCountByStatus: {
        submitted: 1,
        approved: 1,
      },
      highRiskRequestCount: 1,
      averageApprovalCycleTimeHours: 2,
      summary:
        'AI CEO summary: 2 procurement request(s), total amount 12800, 1 high-risk request(s).',
      generatedAt: '2026-06-03T15:00:00.000Z',
    })
  })

  it('stores report snapshots and records activity when ReportGenerationSkill runs', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const request = createRequest('request-approved', 12000)

    const report = await runReportGenerationSkill(
      storage,
      {
        requests: [request],
        workflows: [],
        riskResults: {
          [request.id]: {
            level: 'high',
            reasons: ['Amount is at least 10000.', 'Vendor is not whitelisted.'],
            matchedRuleIds: ['high_amount', 'vendor_not_whitelisted'],
          },
        },
      },
      {
        id: () => 'report-2',
        activityId: () => 'activity-report-1',
        now: () => new Date('2026-06-03T16:00:00.000Z'),
      },
    )

    await expect(storage.getReportSnapshots()).resolves.toEqual([report])
    await expect(storage.getAgentActivities()).resolves.toEqual([
      {
        id: 'activity-report-1',
        skillName: 'ReportGenerationSkill',
        inputSummary: '1 request(s), 0 workflow instance(s)',
        outputSummary: 'total amount 12000, 1 high-risk request(s)',
        status: 'success',
        createdAt: '2026-06-03T16:00:00.000Z',
      },
    ])
  })

  it('generates a report snapshot from persisted runtime data', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const highRiskRequest = createRequest('request-high-risk', 12000)
    const lowRiskRequest = createRequest('request-low-risk', 800)

    await storage.saveRequestInstance(highRiskRequest)
    await storage.saveRequestInstance(lowRiskRequest)
    await storage.saveWorkflowInstance({
      requestId: highRiskRequest.id,
      status: 'approved',
      approvalPath: [],
      currentStepIndex: 1,
      currentStep: null,
      approvalRecords: [],
      archivedAt: '2026-06-03T12:00:00.000Z',
      updatedAt: '2026-06-03T12:00:00.000Z',
    })

    const report = await generateReportFromRuntimeStorage(storage, {
      id: () => 'report-runtime-1',
      activityId: () => 'activity-report-runtime-1',
      now: () => new Date('2026-06-03T17:00:00.000Z'),
    })

    expect(report.totalAmount).toBe(12800)
    expect(report.requestCountByStatus).toEqual({
      approved: 1,
      submitted: 1,
    })
    expect(report.highRiskRequestCount).toBe(1)
    expect(report.averageApprovalCycleTimeHours).toBe(2)
    expect(report.summary).toBe(
      'AI CEO summary: 2 procurement request(s), total amount 12800, 1 high-risk request(s).',
    )
    await expect(storage.getReportSnapshots()).resolves.toEqual([report])
  })
})

function createRequest(id: string, amount: number): RequestInstance {
  return {
    id,
    blueprintId: 'procurement-approval',
    status: 'submitted',
    data: {
      itemName: 'MacBook Pro',
      department: 'Engineering',
      amount,
      vendor: 'Apple',
      reason: 'Replace an aging laptop for product engineering work.',
    },
    createdAt: '2026-06-03T10:00:00.000Z',
    updatedAt: '2026-06-03T10:00:00.000Z',
  }
}
