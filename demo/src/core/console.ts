import type { Blueprint } from './blueprint'

export type ConsoleViewId =
  | 'blueprints'
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
