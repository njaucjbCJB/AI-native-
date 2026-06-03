import { describe, expect, it } from 'vitest'
import {
  runApprovalRoutingSkill,
  runApproveCurrentStep,
  runArchiveSkill,
  runRiskAnalysisSkill,
} from './agent-activity'
import type { RiskAnalysisResult } from './risk'
import type { RequestInstance } from './request'
import { LocalStorageAdapter, MemoryStorage } from './storage'
import { startWorkflow } from './workflow'

describe('Agent Activity', () => {
  it('records activity when RiskAnalysisSkill runs', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const request = createRequest()

    const result = await runRiskAnalysisSkill(storage, request, {
      id: () => 'activity-1',
      now: () => new Date('2026-06-03T14:00:00.000Z'),
    })

    expect(result.level).toBe('low')
    await expect(storage.getAgentActivities()).resolves.toEqual([
      {
        id: 'activity-1',
        skillName: 'RiskAnalysisSkill',
        inputSummary: 'request request-1',
        outputSummary: 'low risk with 0 matched rule(s)',
        status: 'success',
        createdAt: '2026-06-03T14:00:00.000Z',
      },
    ])
  })

  it('records activity when ApprovalRoutingSkill runs', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const request = createRequest()
    const risk: RiskAnalysisResult = {
      level: 'medium',
      reasons: ['Vendor is not whitelisted.'],
      matchedRuleIds: ['vendor_not_whitelisted'],
    }

    const path = await runApprovalRoutingSkill(storage, request, risk, {
      id: () => 'activity-2',
      now: () => new Date('2026-06-03T14:05:00.000Z'),
    })

    expect(path.map((step) => step.role)).toEqual(['department_manager', 'finance'])
    await expect(storage.getAgentActivities()).resolves.toEqual([
      {
        id: 'activity-2',
        skillName: 'ApprovalRoutingSkill',
        inputSummary: 'request request-1 with medium risk',
        outputSummary: '2 approval step(s)',
        status: 'success',
        createdAt: '2026-06-03T14:05:00.000Z',
      },
    ])
  })

  it('records activity when a workflow approval action runs', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const request = createRequest()
    const workflow = startWorkflow(
      request,
      [
        {
          id: 'department-manager-approval',
          role: 'department_manager',
          name: 'Department Manager Approval',
        },
      ],
      {
        now: () => new Date('2026-06-03T14:10:00.000Z'),
      },
    )

    const approvedWorkflow = await runApproveCurrentStep(
      storage,
      workflow,
      {
        comment: 'Approved.',
      },
      {
        id: () => 'activity-3',
        now: () => new Date('2026-06-03T14:15:00.000Z'),
      },
    )

    expect(approvedWorkflow.status).toBe('approved')
    await expect(storage.getAgentActivities()).resolves.toEqual([
      {
        id: 'activity-3',
        skillName: 'WorkflowExecutionSkill',
        inputSummary: 'request request-1 at department-manager-approval',
        outputSummary: 'approved',
        status: 'success',
        createdAt: '2026-06-03T14:15:00.000Z',
      },
    ])
  })

  it('records activity when ArchiveSkill stores an archive record', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const request = createRequest()
    const workflow = startWorkflow(
      request,
      [
        {
          id: 'department-manager-approval',
          role: 'department_manager',
          name: 'Department Manager Approval',
        },
      ],
      {
        now: () => new Date('2026-06-03T14:10:00.000Z'),
      },
    )
    const approvedWorkflow = await runApproveCurrentStep(
      storage,
      workflow,
      { comment: 'Approved.' },
      {
        id: () => 'activity-3',
        now: () => new Date('2026-06-03T14:15:00.000Z'),
      },
    )

    const archiveRecord = await runArchiveSkill(storage, approvedWorkflow, {
      id: () => 'archive-1',
      activityId: () => 'activity-4',
      now: () => new Date('2026-06-03T14:20:00.000Z'),
    })

    expect(archiveRecord.finalStatus).toBe('approved')
    await expect(storage.getArchiveRecords()).resolves.toEqual([archiveRecord])
    await expect(storage.getAgentActivities()).resolves.toEqual([
      {
        id: 'activity-3',
        skillName: 'WorkflowExecutionSkill',
        inputSummary: 'request request-1 at department-manager-approval',
        outputSummary: 'approved',
        status: 'success',
        createdAt: '2026-06-03T14:15:00.000Z',
      },
      {
        id: 'activity-4',
        skillName: 'ArchiveSkill',
        inputSummary: 'request request-1 with approved status',
        outputSummary: 'archive archive-1 stored',
        status: 'success',
        createdAt: '2026-06-03T14:20:00.000Z',
      },
    ])
  })
})

function createRequest(): RequestInstance {
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
    },
    createdAt: '2026-06-03T10:00:00.000Z',
    updatedAt: '2026-06-03T10:00:00.000Z',
  }
}
