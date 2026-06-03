import type { WorkflowStatus } from './workflow'

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
