import { describe, expect, it } from 'vitest'
import type { ApprovalStep } from './approval-routing'
import type { RequestInstance } from './request'
import { approveCurrentStep, rejectCurrentStep, startWorkflow } from './workflow'

describe('WorkflowRuntime', () => {
  it('starts a workflow at the first approval step', () => {
    const request = createRequest()
    const approvalPath: ApprovalStep[] = [
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
    ]

    const instance = startWorkflow(request, approvalPath, {
      now: () => new Date('2026-06-03T12:00:00.000Z'),
    })

    expect(instance).toEqual({
      requestId: request.id,
      status: 'in_review',
      approvalPath,
      currentStepIndex: 0,
      currentStep: approvalPath[0],
      approvalRecords: [],
      archivedAt: null,
      updatedAt: '2026-06-03T12:00:00.000Z',
    })
  })

  it('moves to the next approval step after the current approver approves', () => {
    const request = createRequest()
    const approvalPath: ApprovalStep[] = [
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
    ]
    const instance = startWorkflow(request, approvalPath, {
      now: () => new Date('2026-06-03T12:00:00.000Z'),
    })

    const nextInstance = approveCurrentStep(instance, {
      comment: 'Approved for finance review.',
      now: () => new Date('2026-06-03T13:00:00.000Z'),
    })

    expect(nextInstance).toEqual({
      requestId: request.id,
      status: 'in_review',
      approvalPath,
      currentStepIndex: 1,
      currentStep: approvalPath[1],
      approvalRecords: [
        {
          stepId: 'department-manager-approval',
          role: 'department_manager',
          decision: 'approved',
          comment: 'Approved for finance review.',
          decidedAt: '2026-06-03T13:00:00.000Z',
        },
      ],
      archivedAt: null,
      updatedAt: '2026-06-03T13:00:00.000Z',
    })
  })

  it('approves and archives the workflow after the final approval step', () => {
    const request = createRequest()
    const approvalPath: ApprovalStep[] = [
      {
        id: 'department-manager-approval',
        role: 'department_manager',
        name: 'Department Manager Approval',
      },
    ]
    const instance = startWorkflow(request, approvalPath, {
      now: () => new Date('2026-06-03T12:00:00.000Z'),
    })

    const approvedInstance = approveCurrentStep(instance, {
      comment: 'Approved.',
      now: () => new Date('2026-06-03T13:00:00.000Z'),
    })

    expect(approvedInstance.status).toBe('approved')
    expect(approvedInstance.currentStep).toBeNull()
    expect(approvedInstance.archivedAt).toBe('2026-06-03T13:00:00.000Z')
  })

  it('rejects and archives the workflow when the current approver rejects', () => {
    const request = createRequest()
    const approvalPath: ApprovalStep[] = [
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
    ]
    const instance = startWorkflow(request, approvalPath, {
      now: () => new Date('2026-06-03T12:00:00.000Z'),
    })

    const rejectedInstance = rejectCurrentStep(instance, {
      comment: 'Budget is not approved.',
      now: () => new Date('2026-06-03T13:00:00.000Z'),
    })

    expect(rejectedInstance.status).toBe('rejected')
    expect(rejectedInstance.currentStep).toBeNull()
    expect(rejectedInstance.archivedAt).toBe('2026-06-03T13:00:00.000Z')
    expect(rejectedInstance.approvalRecords).toEqual([
      {
        stepId: 'department-manager-approval',
        role: 'department_manager',
        decision: 'rejected',
        comment: 'Budget is not approved.',
        decidedAt: '2026-06-03T13:00:00.000Z',
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
      amount: 10000,
      vendor: 'Apple',
      reason: 'Replace an aging laptop for product engineering work.',
    },
    createdAt: '2026-06-03T10:00:00.000Z',
    updatedAt: '2026-06-03T10:00:00.000Z',
  }
}
