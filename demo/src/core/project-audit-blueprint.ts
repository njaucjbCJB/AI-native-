export type BlueprintLifecycle = 'draft' | 'deployed'

export type JsonSchema = {
  type: 'object' | 'array' | 'string' | 'number'
  title?: string
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  enum?: string[]
  format?: 'date'
  minimum?: number
  maximum?: number
}

export type EntityDefinition = {
  id: string
  name: string
  fields: Array<{
    id: string
    name: string
    type: 'string' | 'number' | 'date' | 'array' | 'object'
  }>
}

export type PrefillRule = {
  source: string
  target: string
}

export type RoleDefinition = {
  id:
    | 'audit_administrator'
    | 'project_owner'
    | 'supervising_vp'
    | 'ai_ceo'
    | 'global_viewer'
  name: string
}

export type VisibilityRule = {
  roleId: RoleDefinition['id']
  scope: 'all' | 'owned_projects' | 'supervised_projects' | 'ai_ceo_queue'
  access: 'manage' | 'read' | 'approve'
}

export type FieldAccessRule = {
  roleId: RoleDefinition['id']
  states: string[]
  fields: string[]
  access: 'hidden' | 'read' | 'edit'
}

export type WorkflowState = {
  id: string
  name: string
  type: 'form' | 'approval' | 'terminal'
  roleId?: RoleDefinition['id']
  transitions: Array<{
    action: string
    target: string
    commentRequired?: boolean
  }>
}

export type ProjectAuditBlueprint = {
  schemaVersion: '2.0'
  id: 'project-audit'
  lifecycle: BlueprintLifecycle
  version: number | null
  metadata: {
    name: string
    description: string
    scenario: 'project_audit'
  }
  entities: EntityDefinition[]
  formSchema: JsonSchema & {
    type: 'object'
    properties: Record<string, JsonSchema>
  }
  prefillRules: PrefillRule[]
  roles: RoleDefinition[]
  visibilityRules: VisibilityRule[]
  fieldAccessRules: FieldAccessRule[]
  workflow: {
    initialState: string
    states: WorkflowState[]
  }
  changeAuditRules: {
    appendOnly: true
    reasonRequiredFields: string[]
  }
}

export type ProjectAuditBlueprintGenerationResult =
  | {
      status: 'generated'
      blueprint: ProjectAuditBlueprint
    }
  | {
      status: 'unsupported'
      message: string
    }

const PROJECT_AUDIT_TERMS = ['项目审计', '项目评审', 'project audit']

function isProjectAuditDescription(description: string): boolean {
  const normalizedDescription = description.trim().toLowerCase()

  return PROJECT_AUDIT_TERMS.some((term) => normalizedDescription.includes(term))
}

export function generateProjectAuditBlueprint(
  description: string,
): ProjectAuditBlueprintGenerationResult {
  if (!isProjectAuditDescription(description)) {
    return {
      status: 'unsupported',
      message: '当前版本仅支持生成项目审计业务蓝图。',
    }
  }

  return {
    status: 'generated',
    blueprint: {
      schemaVersion: '2.0',
      id: 'project-audit',
      lifecycle: 'draft',
      version: null,
      metadata: {
        name: '项目审计',
        description: description.trim(),
        scenario: 'project_audit',
      },
      entities: [
        {
          id: 'project',
          name: '项目',
          fields: [
            { id: 'projectCode', name: '项目编号', type: 'string' },
            { id: 'projectName', name: '项目名称', type: 'string' },
            { id: 'projectOwner', name: '项目负责人', type: 'string' },
            { id: 'supervisingVp', name: '分管项目 VP', type: 'string' },
            { id: 'department', name: '所属部门', type: 'string' },
            { id: 'approvedBudget', name: '批准预算', type: 'number' },
            { id: 'milestones', name: '里程碑', type: 'array' },
          ],
        },
        {
          id: 'project_audit_instance',
          name: '项目审计实例',
          fields: [
            { id: 'projectSnapshot', name: '项目快照', type: 'object' },
            { id: 'milestoneAssessments', name: '里程碑评估', type: 'array' },
            {
              id: 'strategicObjectiveAssessments',
              name: '战略目标评估',
              type: 'array',
            },
            { id: 'executionPerformance', name: '执行表现', type: 'object' },
            { id: 'risksAndIssues', name: '风险和问题', type: 'string' },
            { id: 'correctiveActionPlan', name: '整改计划', type: 'string' },
            { id: 'ownerSummary', name: '项目负责人总结', type: 'string' },
          ],
        },
      ],
      formSchema: {
        type: 'object',
        title: '项目审计表单',
        required: [
          'projectSnapshot',
          'milestoneAssessments',
          'strategicObjectiveAssessments',
          'executionPerformance',
          'ownerSummary',
        ],
        properties: {
          projectSnapshot: {
            type: 'object',
            title: '项目基本信息',
            required: [
              'projectCode',
              'projectName',
              'projectOwner',
              'supervisingVp',
            ],
            properties: {
              projectCode: { type: 'string', title: '项目编号' },
              projectName: { type: 'string', title: '项目名称' },
              projectOwner: { type: 'string', title: '项目负责人' },
              supervisingVp: { type: 'string', title: '分管项目 VP' },
              department: { type: 'string', title: '所属部门' },
              plannedStartDate: {
                type: 'string',
                title: '计划开始日期',
                format: 'date',
              },
              plannedEndDate: {
                type: 'string',
                title: '计划结束日期',
                format: 'date',
              },
            },
          },
          milestoneAssessments: {
            type: 'array',
            title: '里程碑完成情况',
            items: {
              type: 'object',
              required: ['name', 'plannedDate', 'status', 'completionPercentage'],
              properties: {
                name: { type: 'string', title: '里程碑名称' },
                plannedDate: {
                  type: 'string',
                  title: '计划完成日期',
                  format: 'date',
                },
                status: {
                  type: 'string',
                  title: '完成状态',
                  enum: ['not_started', 'in_progress', 'completed', 'delayed'],
                },
                completionPercentage: {
                  type: 'number',
                  title: '完成比例',
                  minimum: 0,
                  maximum: 100,
                },
                actualSituation: { type: 'string', title: '实际情况说明' },
              },
            },
          },
          strategicObjectiveAssessments: {
            type: 'array',
            title: '战略目标完成进度',
            items: {
              type: 'object',
              required: ['objective', 'weight', 'completionPercentage'],
              properties: {
                objective: { type: 'string', title: '战略目标' },
                weight: {
                  type: 'number',
                  title: '权重',
                  minimum: 0,
                  maximum: 100,
                },
                completionPercentage: {
                  type: 'number',
                  title: '完成比例',
                  minimum: 0,
                  maximum: 100,
                },
                actualSituation: { type: 'string', title: '完成情况说明' },
              },
            },
          },
          executionPerformance: {
            type: 'object',
            title: '执行表现',
            required: ['approvedBudget', 'actualCost', 'estimatedCostAtCompletion'],
            properties: {
              approvedBudget: { type: 'number', title: '批准预算', minimum: 0 },
              actualCost: { type: 'number', title: '实际成本', minimum: 0 },
              estimatedCostAtCompletion: {
                type: 'number',
                title: '预计完工成本',
                minimum: 0,
              },
              budgetVariance: { type: 'number', title: '预算偏差' },
              varianceExplanation: { type: 'string', title: '偏差说明' },
            },
          },
          risksAndIssues: {
            type: 'string',
            title: '风险和问题',
          },
          correctiveActionPlan: {
            type: 'string',
            title: '整改计划',
          },
          ownerSummary: {
            type: 'string',
            title: '项目负责人总结',
          },
        },
      },
      prefillRules: [
        {
          source: 'projectSnapshot.projectCode',
          target: 'projectSnapshot.projectCode',
        },
        {
          source: 'projectSnapshot.projectName',
          target: 'projectSnapshot.projectName',
        },
        {
          source: 'projectSnapshot.projectOwner',
          target: 'projectSnapshot.projectOwner',
        },
        {
          source: 'projectSnapshot.supervisingVp',
          target: 'projectSnapshot.supervisingVp',
        },
        {
          source: 'projectSnapshot.approvedBudget',
          target: 'executionPerformance.approvedBudget',
        },
        {
          source: 'projectSnapshot.milestones',
          target: 'milestoneAssessments',
        },
      ],
      roles: [
        { id: 'audit_administrator', name: '审计管理员' },
        { id: 'project_owner', name: '项目负责人' },
        { id: 'supervising_vp', name: '分管项目 VP' },
        { id: 'ai_ceo', name: 'AI CEO' },
        { id: 'global_viewer', name: '全局查看者' },
      ],
      visibilityRules: [
        { roleId: 'audit_administrator', scope: 'all', access: 'manage' },
        { roleId: 'project_owner', scope: 'owned_projects', access: 'manage' },
        {
          roleId: 'supervising_vp',
          scope: 'supervised_projects',
          access: 'approve',
        },
        { roleId: 'ai_ceo', scope: 'ai_ceo_queue', access: 'approve' },
        { roleId: 'global_viewer', scope: 'all', access: 'read' },
      ],
      fieldAccessRules: [
        {
          roleId: 'project_owner',
          states: ['draft', 'rework'],
          fields: ['*'],
          access: 'edit',
        },
        {
          roleId: 'project_owner',
          states: ['owner_self_approval', 'vp_approval', 'ai_ceo_approval', 'approved'],
          fields: ['*'],
          access: 'read',
        },
        {
          roleId: 'supervising_vp',
          states: ['vp_approval'],
          fields: ['*'],
          access: 'read',
        },
        {
          roleId: 'ai_ceo',
          states: ['ai_ceo_approval'],
          fields: ['*'],
          access: 'read',
        },
        {
          roleId: 'global_viewer',
          states: ['*'],
          fields: ['*'],
          access: 'read',
        },
      ],
      workflow: {
        initialState: 'draft',
        states: [
          {
            id: 'draft',
            name: '待填写',
            type: 'form',
            roleId: 'project_owner',
            transitions: [{ action: 'submit', target: 'owner_self_approval' }],
          },
          {
            id: 'owner_self_approval',
            name: '待项目负责人自审批',
            type: 'approval',
            roleId: 'project_owner',
            transitions: [
              { action: 'approve', target: 'vp_approval' },
              { action: 'withdraw', target: 'draft' },
            ],
          },
          {
            id: 'vp_approval',
            name: '待分管项目 VP 审批',
            type: 'approval',
            roleId: 'supervising_vp',
            transitions: [
              { action: 'approve', target: 'ai_ceo_approval' },
              { action: 'reject', target: 'rework', commentRequired: true },
              { action: 'withdraw', target: 'draft' },
            ],
          },
          {
            id: 'ai_ceo_approval',
            name: '待 AI CEO 审批',
            type: 'approval',
            roleId: 'ai_ceo',
            transitions: [
              { action: 'approve', target: 'approved' },
              { action: 'reject', target: 'rework', commentRequired: true },
            ],
          },
          {
            id: 'rework',
            name: '退回修改',
            type: 'form',
            roleId: 'project_owner',
            transitions: [{ action: 'resubmit', target: 'owner_self_approval' }],
          },
          {
            id: 'approved',
            name: '已通过',
            type: 'terminal',
            transitions: [],
          },
        ],
      },
      changeAuditRules: {
        appendOnly: true,
        reasonRequiredFields: [
          'projectSnapshot.projectCode',
          'projectSnapshot.projectOwner',
          'projectSnapshot.supervisingVp',
          'executionPerformance.approvedBudget',
          'strategicObjectiveAssessments',
        ],
      },
    },
  }
}
