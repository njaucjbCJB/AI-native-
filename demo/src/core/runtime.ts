import { routeApproval, type ApprovalStep } from './approval-routing'
import type { Blueprint } from './blueprint'
import { submitRequestFromActiveBlueprint, type RequestData, type RequestInstance } from './request'
import { analyzeProcurementRisk, type RiskAnalysisResult } from './risk'
import { startWorkflow, type WorkflowInstance } from './workflow'

type RuntimeStorage = {
  getActiveBlueprint: () => Promise<Blueprint | null>
  getRequestInstances: () => Promise<RequestInstance[]>
  saveRequestInstance: (request: RequestInstance) => Promise<void>
  saveWorkflowInstance: (workflow: WorkflowInstance) => Promise<void>
}

type RuntimeOptions = {
  requestId?: () => string
  requestNow?: () => Date
  workflowNow?: () => Date
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
  const risk = analyzeProcurementRisk(request, { previousRequests })
  const approvalPath = routeApproval(request, risk)
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
