import type { ApprovalStep } from './approval-routing'
import { runApprovalRoutingSkill, runRiskAnalysisSkill, type AgentActivity } from './agent-activity'
import type { Blueprint } from './blueprint'
import { submitRequestFromActiveBlueprint, type RequestData, type RequestInstance } from './request'
import type { RiskAnalysisResult } from './risk'
import { startWorkflow, type WorkflowInstance } from './workflow'

type RuntimeStorage = {
  getActiveBlueprint: () => Promise<Blueprint | null>
  getRequestInstances: () => Promise<RequestInstance[]>
  saveRequestInstance: (request: RequestInstance) => Promise<void>
  saveAgentActivity: (activity: AgentActivity) => Promise<void>
  saveWorkflowInstance: (workflow: WorkflowInstance) => Promise<void>
}

type RuntimeOptions = {
  requestId?: () => string
  requestNow?: () => Date
  workflowNow?: () => Date
  activityId?: () => string
  activityNow?: () => Date
}

export type RuntimeSubmissionResult = {
  request: RequestInstance
  risk: RiskAnalysisResult
  approvalPath: ApprovalStep[]
  workflow: WorkflowInstance
}

export async function submitRuntimeRequest(
  storage: RuntimeStorage,
  data: RequestData,
  options: RuntimeOptions = {},
): Promise<RuntimeSubmissionResult> {
  const previousRequests = await storage.getRequestInstances()
  const request = await submitRequestFromActiveBlueprint(storage, data, {
    id: options.requestId,
    now: options.requestNow,
  })
  const risk = await runRiskAnalysisSkill(storage, request, {
    id: options.activityId,
    now: options.activityNow,
    previousRequests,
  })
  const approvalPath = await runApprovalRoutingSkill(storage, request, risk, {
    id: options.activityId,
    now: options.activityNow,
  })
  const workflow = startWorkflow(request, approvalPath, {
    now: options.workflowNow,
  })

  await storage.saveWorkflowInstance(workflow)

  return {
    request,
    risk,
    approvalPath,
    workflow,
  }
}
