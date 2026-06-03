import type { ArchiveRecord } from './archive'
import type { RequestInstance } from './request'
import { routeApproval, type ApprovalStep } from './approval-routing'
import { analyzeProcurementRisk, type RiskAnalysisResult } from './risk'
import {
  approveCurrentStep,
  rejectCurrentStep,
  type WorkflowInstance,
} from './workflow'

export type AgentActivityStatus = 'success' | 'failed'

export type AgentActivity = {
  id: string
  skillName: string
  inputSummary: string
  outputSummary: string
  status: AgentActivityStatus
  createdAt: string
}

type AgentActivityStorage = {
  saveAgentActivity(activity: AgentActivity): Promise<void>
  saveArchiveRecord?(archiveRecord: ArchiveRecord): Promise<void>
}

type AgentActivityOptions = {
  id?: () => string
  now?: () => Date
}

type RiskAnalysisSkillOptions = AgentActivityOptions & {
  previousRequests?: RequestInstance[]
}

type ArchiveSkillOptions = AgentActivityOptions & {
  activityId?: () => string
}

export async function runRiskAnalysisSkill(
  storage: AgentActivityStorage,
  request: RequestInstance,
  options: RiskAnalysisSkillOptions = {},
): Promise<RiskAnalysisResult> {
  const result = analyzeProcurementRisk(request, {
    previousRequests: options.previousRequests,
  })

  await storage.saveAgentActivity({
    id: getId(options),
    skillName: 'RiskAnalysisSkill',
    inputSummary: `request ${request.id}`,
    outputSummary: `${result.level} risk with ${result.matchedRuleIds.length} matched rule(s)`,
    status: 'success',
    createdAt: getTimestamp(options),
  })

  return result
}

export async function runApprovalRoutingSkill(
  storage: AgentActivityStorage,
  request: RequestInstance,
  risk: RiskAnalysisResult,
  options: AgentActivityOptions = {},
): Promise<ApprovalStep[]> {
  const path = routeApproval(request, risk)

  await storage.saveAgentActivity({
    id: getId(options),
    skillName: 'ApprovalRoutingSkill',
    inputSummary: `request ${request.id} with ${risk.level} risk`,
    outputSummary: `${path.length} approval step(s)`,
    status: 'success',
    createdAt: getTimestamp(options),
  })

  return path
}

export async function runApproveCurrentStep(
  storage: AgentActivityStorage,
  workflow: WorkflowInstance,
  action: { comment?: string },
  options: AgentActivityOptions = {},
): Promise<WorkflowInstance> {
  const currentStepId = workflow.currentStep?.id ?? 'none'
  const nextWorkflow = approveCurrentStep(workflow, {
    comment: action.comment,
    now: options.now,
  })

  await storage.saveAgentActivity({
    id: getId(options),
    skillName: 'WorkflowExecutionSkill',
    inputSummary: `request ${workflow.requestId} at ${currentStepId}`,
    outputSummary: nextWorkflow.status,
    status: 'success',
    createdAt: getTimestamp(options),
  })

  return nextWorkflow
}

export async function runRejectCurrentStep(
  storage: AgentActivityStorage,
  workflow: WorkflowInstance,
  action: { comment?: string },
  options: AgentActivityOptions = {},
): Promise<WorkflowInstance> {
  const currentStepId = workflow.currentStep?.id ?? 'none'
  const nextWorkflow = rejectCurrentStep(workflow, {
    comment: action.comment,
    now: options.now,
  })

  await storage.saveAgentActivity({
    id: getId(options),
    skillName: 'WorkflowExecutionSkill',
    inputSummary: `request ${workflow.requestId} at ${currentStepId}`,
    outputSummary: nextWorkflow.status,
    status: 'success',
    createdAt: getTimestamp(options),
  })

  return nextWorkflow
}

export async function runArchiveSkill(
  storage: AgentActivityStorage,
  workflow: WorkflowInstance,
  options: ArchiveSkillOptions = {},
): Promise<ArchiveRecord> {
  if (workflow.status !== 'approved' && workflow.status !== 'rejected') {
    throw new Error('Only approved or rejected workflows can be archived.')
  }

  if (!storage.saveArchiveRecord) {
    throw new Error('Archive storage is required to run ArchiveSkill.')
  }

  const timestamp = getTimestamp(options)
  const archiveRecord: ArchiveRecord = {
    id: getId(options),
    requestId: workflow.requestId,
    finalStatus: workflow.status,
    archivedAt: timestamp,
  }

  await storage.saveArchiveRecord(archiveRecord)
  await storage.saveAgentActivity({
    id: (options.activityId ?? (() => crypto.randomUUID()))(),
    skillName: 'ArchiveSkill',
    inputSummary: `request ${workflow.requestId} with ${workflow.status} status`,
    outputSummary: `archive ${archiveRecord.id} stored`,
    status: 'success',
    createdAt: timestamp,
  })

  return archiveRecord
}

function getId(options: AgentActivityOptions): string {
  return (options.id ?? (() => crypto.randomUUID()))()
}

function getTimestamp(options: AgentActivityOptions): string {
  return (options.now ?? (() => new Date()))().toISOString()
}
