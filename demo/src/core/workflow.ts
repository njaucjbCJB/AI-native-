import type { ApprovalStep } from './approval-routing'
import type { RequestInstance } from './request'

export type WorkflowStatus = 'in_review' | 'approved' | 'rejected'

export type ApprovalDecision = 'approved' | 'rejected'

export type ApprovalRecord = {
  stepId: string
  role: ApprovalStep['role']
  decision: ApprovalDecision
  comment: string
  decidedAt: string
}

export type WorkflowInstance = {
  requestId: string
  status: WorkflowStatus
  approvalPath: ApprovalStep[]
  currentStepIndex: number
  currentStep: ApprovalStep | null
  approvalRecords: ApprovalRecord[]
  archivedAt: string | null
  updatedAt: string
}

type ClockOptions = {
  now?: () => Date
}

type ApprovalActionOptions = ClockOptions & {
  comment?: string
}

export function startWorkflow(
  request: RequestInstance,
  approvalPath: ApprovalStep[],
  options: ClockOptions = {},
): WorkflowInstance {
  const timestamp = getTimestamp(options)

  return {
    requestId: request.id,
    status: 'in_review',
    approvalPath,
    currentStepIndex: 0,
    currentStep: approvalPath[0] ?? null,
    approvalRecords: [],
    archivedAt: null,
    updatedAt: timestamp,
  }
}

export function approveCurrentStep(
  instance: WorkflowInstance,
  options: ApprovalActionOptions = {},
): WorkflowInstance {
  const timestamp = getTimestamp(options)
  const currentStep = requireCurrentStep(instance)
  const nextStepIndex = instance.currentStepIndex + 1
  const nextStep = instance.approvalPath[nextStepIndex] ?? null
  const isComplete = nextStep === null

  return {
    ...instance,
    status: isComplete ? 'approved' : 'in_review',
    currentStepIndex: nextStepIndex,
    currentStep: nextStep,
    approvalRecords: [
      ...instance.approvalRecords,
      createApprovalRecord(currentStep, 'approved', options.comment ?? '', timestamp),
    ],
    archivedAt: isComplete ? timestamp : instance.archivedAt,
    updatedAt: timestamp,
  }
}

export function rejectCurrentStep(
  instance: WorkflowInstance,
  options: ApprovalActionOptions = {},
): WorkflowInstance {
  const timestamp = getTimestamp(options)
  const currentStep = requireCurrentStep(instance)

  return {
    ...instance,
    status: 'rejected',
    currentStep: null,
    approvalRecords: [
      ...instance.approvalRecords,
      createApprovalRecord(currentStep, 'rejected', options.comment ?? '', timestamp),
    ],
    archivedAt: timestamp,
    updatedAt: timestamp,
  }
}

function createApprovalRecord(
  step: ApprovalStep,
  decision: ApprovalDecision,
  comment: string,
  decidedAt: string,
): ApprovalRecord {
  return {
    stepId: step.id,
    role: step.role,
    decision,
    comment,
    decidedAt,
  }
}

function getTimestamp(options: ClockOptions): string {
  return (options.now ?? (() => new Date()))().toISOString()
}

function requireCurrentStep(instance: WorkflowInstance): ApprovalStep {
  if (!instance.currentStep) {
    throw new Error('Workflow has no current approval step.')
  }

  return instance.currentStep
}
