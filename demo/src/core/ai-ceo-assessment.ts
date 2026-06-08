import type { ProjectAuditInstance } from './audit-cycle'
import type { AuditChangeRecord } from './audit-form'
import type { ApprovalRecord } from './audit-workflow'

export type AiCeoRiskLevel = 'low' | 'medium' | 'high'

export type AiCeoRecommendation = 'approve' | 'review' | 'reject'

export type AiCeoAssessment = {
  id: string
  instanceId: string
  generatedAt: string
  riskLevel: AiCeoRiskLevel
  keyFindings: string[]
  recommendation: AiCeoRecommendation
  rationale: string
}

type AiCeoAssessmentStorage = {
  getAuditChangeRecords(instanceId?: string): Promise<AuditChangeRecord[]>
  getApprovalRecords(instanceId?: string): Promise<ApprovalRecord[]>
  getProjectAuditInstances(): Promise<ProjectAuditInstance[]>
  saveAiCeoAssessment(assessment: AiCeoAssessment): Promise<void>
}

type CreateAiCeoAssessmentOptions = {
  id?: () => string
  now?: () => Date
}

export async function createAiCeoAssessment(
  storage: AiCeoAssessmentStorage,
  instanceId: string,
  options: CreateAiCeoAssessmentOptions = {},
): Promise<AiCeoAssessment> {
  const instances = await storage.getProjectAuditInstances()
  const instance = instances.find((candidate) => candidate.id === instanceId)

  if (!instance) {
    throw new Error(`Project audit instance ${instanceId} was not found.`)
  }

  if (instance.status !== 'ai_ceo_approval') {
    throw new Error('AI CEO assessment can only be generated during AI CEO approval.')
  }

  const [changeRecords, approvalRecords] = await Promise.all([
    storage.getAuditChangeRecords(instance.id),
    storage.getApprovalRecords(instance.id),
  ])
  const assessment = {
    ...generateAiCeoAssessment(instance, changeRecords, approvalRecords),
    id: (options.id ?? (() => crypto.randomUUID()))(),
    instanceId: instance.id,
    generatedAt: (options.now ?? (() => new Date()))().toISOString(),
  }

  await storage.saveAiCeoAssessment(assessment)

  return assessment
}

export function generateAiCeoAssessment(
  instance: ProjectAuditInstance,
  changeRecords: AuditChangeRecord[],
  approvalRecords: ApprovalRecord[],
): Omit<AiCeoAssessment, 'id' | 'instanceId' | 'generatedAt'> {
  const findings: string[] = []
  const delayedMilestones = instance.formData.milestoneAssessments.filter(
    (milestone) => milestone.status === 'delayed',
  )
  const averageStrategicProgress =
    instance.formData.strategicObjectiveAssessments.reduce(
      (sum, objective) => sum + objective.completionPercentage,
      0,
    ) / Math.max(1, instance.formData.strategicObjectiveAssessments.length)
  const { approvedBudget, actualCost, estimatedCostAtCompletion, budgetVariance } =
    instance.formData.executionPerformance

  if (delayedMilestones.length > 0) {
    findings.push('存在延期里程碑')
  }

  if (averageStrategicProgress < 50) {
    findings.push('战略目标完成进度低于 50%')
  }

  if (actualCost > approvedBudget || estimatedCostAtCompletion > approvedBudget) {
    findings.push('成本预计超过批准预算')
  }

  if (budgetVariance > 0) {
    findings.push('存在正向预算偏差风险')
  }

  if (instance.formData.risksAndIssues.trim()) {
    findings.push('项目负责人申报了风险和问题')
  }

  if (changeRecords.length > 0) {
    findings.push(`存在 ${changeRecords.length} 条字段变更记录`)
  }

  if (approvalRecords.some((record) => record.decision === 'rejected')) {
    findings.push('历史审批中存在驳回记录')
  }

  const riskLevel = determineRiskLevel(findings, averageStrategicProgress)
  const recommendation = determineRecommendation(riskLevel)

  return {
    riskLevel,
    keyFindings: findings.length ? findings : ['未发现重大异常'],
    recommendation,
    rationale:
      recommendation === 'approve'
        ? '项目执行证据整体稳定，可以进入最终批准。'
        : recommendation === 'review'
          ? '项目存在需要关注的偏差，建议 AI CEO 结合完整证据审慎确认。'
          : '项目存在高风险信号，建议退回项目负责人补充说明或整改。',
  }
}

function determineRiskLevel(
  findings: string[],
  averageStrategicProgress: number,
): AiCeoRiskLevel {
  if (
    findings.includes('存在延期里程碑') ||
    findings.includes('成本预计超过批准预算') ||
    findings.includes('历史审批中存在驳回记录') ||
    averageStrategicProgress < 50
  ) {
    return 'high'
  }

  return findings.length > 0 ? 'medium' : 'low'
}

function determineRecommendation(riskLevel: AiCeoRiskLevel): AiCeoRecommendation {
  if (riskLevel === 'high') {
    return 'reject'
  }

  return riskLevel === 'medium' ? 'review' : 'approve'
}
