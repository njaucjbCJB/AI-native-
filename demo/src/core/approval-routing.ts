import type { RequestInstance } from './request'
import type { RiskAnalysisResult } from './risk'

export type ApprovalRole = 'department_manager' | 'finance' | 'ceo'

export type ApprovalStep = {
  id: string
  role: ApprovalRole
  name: string
}

export function routeApproval(
  request: RequestInstance,
  risk: RiskAnalysisResult,
): ApprovalStep[] {
  const path: ApprovalStep[] = [
    {
      id: 'department-manager-approval',
      role: 'department_manager',
      name: 'Department Manager Approval',
    },
  ]

  if (Number(request.data.amount) >= 10000 || risk.level === 'medium' || risk.level === 'high') {
    path.push({
      id: 'finance-approval',
      role: 'finance',
      name: 'Finance Approval',
    })
  }

  if (risk.level === 'high') {
    path.push({
      id: 'ceo-confirmation',
      role: 'ceo',
      name: 'CEO Confirmation',
    })
  }

  return path
}
