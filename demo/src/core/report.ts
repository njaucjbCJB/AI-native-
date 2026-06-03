import type { AgentActivity } from './agent-activity'
import type { RequestInstance } from './request'
import type { RiskAnalysisResult } from './risk'
import type { WorkflowStatus } from './workflow'
import type { WorkflowInstance } from './workflow'

export type RequestStatusCount = Partial<Record<'submitted' | WorkflowStatus, number>>

export type ReportSnapshot = {
  id: string
  totalAmount: number
  requestCountByStatus: RequestStatusCount
  highRiskRequestCount: number
  averageApprovalCycleTimeHours: number
  summary: string
  generatedAt: string
}

type ProcurementReportInput = {
  requests: RequestInstance[]
  workflows: WorkflowInstance[]
  riskResults: Record<string, RiskAnalysisResult>
}

type ReportOptions = {
  id?: () => string
  now?: () => Date
}

type ReportSkillOptions = ReportOptions & {
  activityId?: () => string
}

type ReportStorage = {
  saveReportSnapshot(report: ReportSnapshot): Promise<void>
  saveAgentActivity(activity: AgentActivity): Promise<void>
}

export function generateProcurementReport(
  input: ProcurementReportInput,
  options: ReportOptions = {},
): ReportSnapshot {
  const totalAmount = input.requests.reduce(
    (sum, request) => sum + Number(request.data.amount ?? 0),
    0,
  )
  const requestCountByStatus = countRequestsByStatus(input.requests, input.workflows)
  const highRiskRequestCount = Object.values(input.riskResults).filter(
    (risk) => risk.level === 'high',
  ).length
  const averageApprovalCycleTimeHours = getAverageApprovalCycleTimeHours(
    input.requests,
    input.workflows,
  )

  return {
    id: (options.id ?? (() => crypto.randomUUID()))(),
    totalAmount,
    requestCountByStatus,
    highRiskRequestCount,
    averageApprovalCycleTimeHours,
    summary: `AI CEO summary: ${input.requests.length} procurement request(s), total amount ${totalAmount}, ${highRiskRequestCount} high-risk request(s).`,
    generatedAt: (options.now ?? (() => new Date()))().toISOString(),
  }
}

export async function runReportGenerationSkill(
  storage: ReportStorage,
  input: ProcurementReportInput,
  options: ReportSkillOptions = {},
): Promise<ReportSnapshot> {
  const report = generateProcurementReport(input, options)

  await storage.saveReportSnapshot(report)
  await storage.saveAgentActivity({
    id: (options.activityId ?? (() => crypto.randomUUID()))(),
    skillName: 'ReportGenerationSkill',
    inputSummary: `${input.requests.length} request(s), ${input.workflows.length} workflow instance(s)`,
    outputSummary: `total amount ${report.totalAmount}, ${report.highRiskRequestCount} high-risk request(s)`,
    status: 'success',
    createdAt: report.generatedAt,
  })

  return report
}

function countRequestsByStatus(
  requests: RequestInstance[],
  workflows: WorkflowInstance[],
): RequestStatusCount {
  const workflowByRequestId = new Map(
    workflows.map((workflow) => [workflow.requestId, workflow]),
  )

  return requests.reduce<RequestStatusCount>((counts, request) => {
    const status = workflowByRequestId.get(request.id)?.status ?? request.status
    counts[status] = (counts[status] ?? 0) + 1

    return counts
  }, {})
}

function getAverageApprovalCycleTimeHours(
  requests: RequestInstance[],
  workflows: WorkflowInstance[],
): number {
  const requestById = new Map(requests.map((request) => [request.id, request]))
  const cycleTimes = workflows
    .filter((workflow) => workflow.archivedAt)
    .map((workflow) => {
      const request = requestById.get(workflow.requestId)

      if (!request || !workflow.archivedAt) {
        return 0
      }

      return (
        (new Date(workflow.archivedAt).getTime() -
          new Date(request.createdAt).getTime()) /
        (1000 * 60 * 60)
      )
    })

  if (cycleTimes.length === 0) {
    return 0
  }

  return cycleTimes.reduce((sum, hours) => sum + hours, 0) / cycleTimes.length
}
