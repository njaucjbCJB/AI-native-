import type { Blueprint } from './blueprint'

export type ConsoleViewId =
  | 'blueprints'
  | 'project-registry'
  | 'audit-cycles'
  | 'data-model'
  | 'form-schema'
  | 'workflow'
  | 'agent-skills'
  | 'runtime'
  | 'reports'
  | 'architecture'

export type ConsoleView = {
  id: ConsoleViewId
  title: string
  description: string
  items: string[]
}

export function getFrameworkConsoleViews(blueprint: Blueprint): ConsoleView[] {
  return [
    {
      id: 'blueprints',
      title: 'Blueprints',
      description: 'Business blueprint contract currently driving this demo.',
      items: [
        `${blueprint.name} v${blueprint.version}`,
        blueprint.description,
        `Archive policy: ${blueprint.archivePolicy.retentionLabel}`,
      ],
    },
    {
      id: 'project-registry',
      title: '项目台账',
      description: '维护当前正式项目资料，供后续审计实例复制项目快照。',
      items: ['查看项目', '新增项目', '编辑项目'],
    },
    {
      id: 'audit-cycles',
      title: '审计周期',
      description: '创建草稿审计周期，并从项目台账选择本期审计范围。',
      items: ['创建草稿周期', '选择多个项目', '查看审计范围'],
    },
    {
      id: 'data-model',
      title: 'Data Model',
      description: 'Runtime entities persisted through the StorageAdapter boundary.',
      items: [
        'Blueprint',
        'RequestInstance',
        'WorkflowInstance',
        'AgentActivity',
        'ArchiveRecord',
        'ReportSnapshot',
      ],
    },
    {
      id: 'form-schema',
      title: 'Form Schema',
      description: 'Fields generated from the active Blueprint form schema.',
      items: blueprint.formSchema.map((field) => `${field.label}: ${field.type}`),
    },
    {
      id: 'workflow',
      title: 'Workflow',
      description: blueprint.workflow.name,
      items: [
        ...blueprint.workflow.nodes.map((node) => `${node.name}: ${node.role}`),
        ...blueprint.riskRules.map((rule) => `${rule.name}: ${rule.severity}`),
      ],
    },
    {
      id: 'agent-skills',
      title: 'Agent & Skills',
      description: 'First-version skill layer and replacement status.',
      items: [
        'RiskAnalysisSkill: mock now, production replaceable',
        'ApprovalRoutingSkill: mock now, production replaceable',
        'WorkflowExecutionSkill: mock now, production replaceable',
        'ArchiveSkill: mock now, production replaceable',
        'ReportGenerationSkill: mock now, production replaceable',
      ],
    },
    {
      id: 'runtime',
      title: 'Runtime',
      description: 'Submit and operate procurement requests through the runtime path.',
      items: ['Request form', 'Approval status', 'Agent Activity'],
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'Management metrics and AI CEO summary generated from runtime data.',
      items: blueprint.reports.map((report) => report.name),
    },
    {
      id: 'architecture',
      title: 'Architecture',
      description: 'Replacement route from first-version mock boundaries to production systems.',
      items: [
        'LocalStorageAdapter -> database adapter',
        'Mock AgentRuntime -> enterprise AI gateway',
        'In-memory workflow logic -> production workflow engine',
        'Static report summary -> governed analytics service',
        'Demo procurement blueprint -> multi-domain blueprint catalog',
      ],
    },
  ]
}
