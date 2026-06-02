export type Blueprint = {
  id: string
  name: string
  description: string
  version: number
  formSchema: FormField[]
  workflow: WorkflowDefinition
  riskRules: RiskRule[]
  archivePolicy: ArchivePolicy
  reports: ReportDefinition[]
}

export type FormField = {
  key: string
  label: string
  type: 'text' | 'number' | 'textarea' | 'select' | 'date'
  required: boolean
  options?: string[]
}

export type WorkflowDefinition = {
  id: string
  name: string
  nodes: WorkflowNode[]
}

export type WorkflowNode = {
  id: string
  name: string
  type: 'approval'
  role: 'department_manager' | 'finance' | 'ceo'
  condition: string
}

export type RiskRule = {
  id: string
  name: string
  severity: 'medium' | 'high'
  condition: string
}

export type ArchivePolicy = {
  archiveWhen: 'approved_or_rejected'
  retentionLabel: string
}

export type ReportDefinition = {
  id: string
  name: string
  metricKeys: string[]
}

export function generateBlueprintFromRequirement(requirement: string): Blueprint {
  if (!requirement.toLowerCase().includes('procurement')) {
    throw new Error('Only the procurement approval demo blueprint is supported.')
  }

  return {
    id: 'procurement-approval',
    name: 'Procurement Approval',
    description: 'A demo blueprint for procurement request approval.',
    version: 1,
    formSchema: [
      { key: 'itemName', label: 'Item Name', type: 'text', required: true },
      {
        key: 'department',
        label: 'Department',
        type: 'select',
        required: true,
        options: ['Engineering', 'Sales', 'Operations', 'Finance'],
      },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'vendor', label: 'Vendor', type: 'text', required: true },
      { key: 'neededBy', label: 'Needed By', type: 'date', required: false },
      { key: 'reason', label: 'Purchase Reason', type: 'textarea', required: true },
    ],
    workflow: {
      id: 'procurement-approval-workflow',
      name: 'Procurement Approval Workflow',
      nodes: [
        {
          id: 'department-manager-approval',
          name: 'Department Manager Approval',
          type: 'approval',
          role: 'department_manager',
          condition: 'always',
        },
        {
          id: 'finance-approval',
          name: 'Finance Approval',
          type: 'approval',
          role: 'finance',
          condition: 'amount >= 10000 || riskLevel in ["medium", "high"]',
        },
        {
          id: 'ceo-confirmation',
          name: 'CEO Confirmation',
          type: 'approval',
          role: 'ceo',
          condition: 'riskLevel == "high"',
        },
      ],
    },
    riskRules: [
      {
        id: 'high_amount',
        name: 'High amount',
        severity: 'medium',
        condition: 'amount >= 10000',
      },
      {
        id: 'vendor_not_whitelisted',
        name: 'Vendor is not whitelisted',
        severity: 'high',
        condition: 'vendor not in whitelist',
      },
      {
        id: 'similar_recent_request',
        name: 'Similar recent request exists',
        severity: 'high',
        condition: 'similar request exists in the last 30 days',
      },
      {
        id: 'incomplete_reason',
        name: 'Purchase reason is incomplete',
        severity: 'medium',
        condition: 'reason length < 20',
      },
    ],
    archivePolicy: {
      archiveWhen: 'approved_or_rejected',
      retentionLabel: 'procurement-request',
    },
    reports: [
      {
        id: 'procurement_spend_summary',
        name: 'Procurement Spend Summary',
        metricKeys: ['totalAmount', 'requestCountByStatus'],
      },
      {
        id: 'procurement_risk_summary',
        name: 'Procurement Risk Summary',
        metricKeys: ['highRiskRequestCount', 'averageApprovalCycleTime'],
      },
    ],
  }
}
