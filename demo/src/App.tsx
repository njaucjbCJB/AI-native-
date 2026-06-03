import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { runApproveCurrentStep, runRejectCurrentStep, type AgentActivity } from './core/agent-activity'
import type { WorkflowInstance } from './core/workflow'
import { generateBlueprintFromRequirement, type Blueprint, type FormField } from './core/blueprint'
import { LocalStorageAdapter } from './core/storage'
import { submitRuntimeRequest, type RuntimeSubmissionResult } from './core/runtime'
import type { ApprovalRole } from './core/approval-routing'
import type { RequestData, RequestInstance } from './core/request'
import { generateReportFromRuntimeStorage, type ReportSnapshot } from './core/report'
import { getFrameworkConsoleViews, type ConsoleView, type ConsoleViewId } from './core/console'
import './App.css'

const DEFAULT_REQUIREMENT = 'I need a procurement approval workflow.'

const ROLE_LABELS: Record<ApprovalRole, string> = {
  department_manager: '部门经理',
  finance: '财务',
  ceo: 'CEO',
}

const INITIAL_FORM_DATA: RequestData = {
  itemName: 'Security audit',
  department: 'Engineering',
  amount: 12000,
  vendor: 'Unknown Vendor',
  neededBy: '2026-07-01',
  reason: 'Run a security audit before the next enterprise customer launch.',
}

function App() {
  const storage = useMemo(() => new LocalStorageAdapter(), [])
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null)
  const [formData, setFormData] = useState<RequestData>(INITIAL_FORM_DATA)
  const [requests, setRequests] = useState<RequestInstance[]>([])
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([])
  const [agentActivities, setAgentActivities] = useState<AgentActivity[]>([])
  const [reports, setReports] = useState<ReportSnapshot[]>([])
  const [latestResult, setLatestResult] = useState<RuntimeSubmissionResult | null>(null)
  const [selectedRole, setSelectedRole] = useState<ApprovalRole>('department_manager')
  const [activeView, setActiveView] = useState<ConsoleViewId>('runtime')
  const [message, setMessage] = useState('Runtime ready')
  const consoleViews = useMemo(
    () => (blueprint ? getFrameworkConsoleViews(blueprint) : []),
    [blueprint],
  )
  const activeConsoleView = consoleViews.find((view) => view.id === activeView)

  useEffect(() => {
    async function initializeRuntime() {
      const defaultBlueprint = generateBlueprintFromRequirement(DEFAULT_REQUIREMENT)

      await storage.saveBlueprint(defaultBlueprint)
      await storage.setActiveBlueprint(defaultBlueprint.id)
      setBlueprint(defaultBlueprint)
      await refreshRuntimeState()
    }

    void initializeRuntime()
  }, [storage])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const result = await submitRuntimeRequest(storage, formData)

      setLatestResult(result)
      await generateReportFromRuntimeStorage(storage)
      await refreshRuntimeState()
      setMessage(`Submitted ${result.request.id}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submit failed')
    }
  }

  async function handleDecision(decision: 'approve' | 'reject') {
    const workflow = workflows.find((candidate) => candidate.currentStep?.role === selectedRole)

    if (!workflow) {
      setMessage(`${ROLE_LABELS[selectedRole]} has no current approval task`)
      return
    }

    const nextWorkflow =
      decision === 'approve'
        ? await runApproveCurrentStep(storage, workflow, { comment: `${ROLE_LABELS[selectedRole]} approved.` })
        : await runRejectCurrentStep(storage, workflow, { comment: `${ROLE_LABELS[selectedRole]} rejected.` })

    await storage.saveWorkflowInstance(nextWorkflow)
    await generateReportFromRuntimeStorage(storage)
    await refreshRuntimeState()
    setMessage(`${ROLE_LABELS[selectedRole]} ${decision === 'approve' ? 'approved' : 'rejected'} ${workflow.requestId}`)
  }

  async function refreshRuntimeState() {
    const [nextRequests, nextWorkflows, nextAgentActivities, nextReports] = await Promise.all([
      storage.getRequestInstances(),
      storage.getWorkflowInstances(),
      storage.getAgentActivities(),
      storage.getReportSnapshots(),
    ])

    setRequests(nextRequests)
    setWorkflows(nextWorkflows)
    setAgentActivities(nextAgentActivities)
    setReports(nextReports)
  }

  function updateField(field: FormField, value: string) {
    setFormData((current) => ({
      ...current,
      [field.key]: field.type === 'number' ? Number(value) : value,
    }))
  }

  function renderActiveView() {
    if (!blueprint || !activeConsoleView) {
      return (
        <section className="panel">
          <div className="panel-heading">
            <h2>Loading console</h2>
            <span>Blueprint required</span>
          </div>
        </section>
      )
    }

    if (activeView === 'runtime') {
      return renderRuntimeView()
    }

    if (activeView === 'reports') {
      return <ReportsPanel report={reports.at(-1) ?? null} />
    }

    if (activeView === 'form-schema') {
      return <FormSchemaView blueprint={blueprint} view={activeConsoleView} />
    }

    if (activeView === 'workflow') {
      return <WorkflowView blueprint={blueprint} view={activeConsoleView} />
    }

    return <ConsoleViewPanel view={activeConsoleView} />
  }

  function renderRuntimeView() {
    return (
      <section className="runtime-grid">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <h2>采购申请</h2>
            <span>{blueprint?.name ?? 'Loading Blueprint'}</span>
          </div>

          {blueprint?.formSchema.map((field) => (
            <label className="field" key={field.key}>
              <span>
                {field.label}
                {field.required ? <strong>*</strong> : null}
              </span>
              {renderField(field, formData[field.key], updateField)}
            </label>
          ))}

          <button className="primary-action" type="submit">
            提交申请
          </button>
          <p className="status-message">{message}</p>
        </form>

        <section className="panel">
          <div className="panel-heading">
            <h2>审批状态</h2>
            <span>{requests.length} requests</span>
          </div>
          <div className="summary-row">
            <Metric label="Risk" value={latestResult?.risk.level ?? '-'} />
            <Metric label="Path" value={latestResult?.approvalPath.length ?? 0} />
            <Metric label="Current Role" value={ROLE_LABELS[selectedRole]} />
          </div>
          <div className="decision-bar">
            <button type="button" onClick={() => void handleDecision('approve')}>
              批准
            </button>
            <button type="button" onClick={() => void handleDecision('reject')}>
              拒绝
            </button>
          </div>
          <div className="request-list">
            {requests.map((request) => {
              const workflow = workflows.find((item) => item.requestId === request.id)

              return (
                <article className="request-item" key={request.id}>
                  <div>
                    <strong>{String(request.data.itemName)}</strong>
                    <span>{String(request.data.vendor)} · {Number(request.data.amount)}</span>
                  </div>
                  <div>
                    <strong>{workflow?.status ?? request.status}</strong>
                    <span>{workflow?.currentStep ? ROLE_LABELS[workflow.currentStep.role] : '已结束'}</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="panel path-panel">
          <div className="panel-heading">
            <h2>运行链路</h2>
            <span>Blueprint driven</span>
          </div>
          <ol>
            {(latestResult?.approvalPath ?? []).map((step) => (
              <li key={step.id}>
                <strong>{step.name}</strong>
                <span>{ROLE_LABELS[step.role]}</span>
              </li>
            ))}
          </ol>
          {latestResult ? (
            <p className="risk-reasons">
              {latestResult.risk.reasons.length
                ? latestResult.risk.reasons.join(' / ')
                : 'No risk rules matched.'}
            </p>
          ) : (
            <p className="risk-reasons">提交申请后会显示风险原因和审批路径。</p>
          )}
        </section>

        <ActivityPanel activities={agentActivities} />
      </section>
    )
  }

  return (
    <main className="console-shell">
      <aside className="console-sidebar">
        <div>
          <p className="eyebrow">AI Enterprise Operating Framework</p>
          <h1>控制台</h1>
        </div>
        <nav aria-label="Console views">
          {consoleViews.map((view) => (
            <button
              className={activeView === view.id ? 'active' : ''}
              key={view.id}
              onClick={() => setActiveView(view.id)}
              type="button"
            >
              {view.title}
            </button>
          ))}
        </nav>
      </aside>

      <section className="console-main">
      <header className="runtime-header">
        <div>
          <p className="eyebrow">AI Enterprise Operating Framework Console</p>
          <h1>{activeConsoleView?.title ?? 'Runtime'}</h1>
        </div>
        {activeView === 'runtime' ? (
          <div className="role-switcher" aria-label="Role switcher">
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <button
                className={selectedRole === role ? 'active' : ''}
                key={role}
                onClick={() => setSelectedRole(role as ApprovalRole)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </header>

        {renderActiveView()}
      </section>
    </main>
  )
}

function ConsoleViewPanel({ view }: { view: ConsoleView }) {
  return (
    <section className="panel console-view-panel">
      <div className="panel-heading">
        <h2>{view.title}</h2>
        <span>{view.id}</span>
      </div>
      <p className="view-description">{view.description}</p>
      <div className="view-list">
        {view.items.map((item) => (
          <article key={item}>
            <strong>{item.split(':')[0]}</strong>
            <span>{item.includes(':') ? item.split(':').slice(1).join(':').trim() : item}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function FormSchemaView({ blueprint, view }: { blueprint: Blueprint; view: ConsoleView }) {
  return (
    <section className="panel console-view-panel">
      <div className="panel-heading">
        <h2>{view.title}</h2>
        <span>{blueprint.formSchema.length} fields</span>
      </div>
      <p className="view-description">{view.description}</p>
      <div className="schema-grid">
        {blueprint.formSchema.map((field) => (
          <article key={field.key}>
            <strong>{field.label}</strong>
            <span>{field.key}</span>
            <span>{field.type}</span>
            <span>{field.required ? 'required' : 'optional'}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function WorkflowView({ blueprint, view }: { blueprint: Blueprint; view: ConsoleView }) {
  return (
    <section className="panel console-view-panel">
      <div className="panel-heading">
        <h2>{view.title}</h2>
        <span>{blueprint.workflow.nodes.length} nodes</span>
      </div>
      <p className="view-description">{view.description}</p>
      <div className="workflow-grid">
        {blueprint.workflow.nodes.map((node) => (
          <article key={node.id}>
            <strong>{node.name}</strong>
            <span>{ROLE_LABELS[node.role]}</span>
            <p>{node.condition}</p>
          </article>
        ))}
      </div>
      <div className="risk-rule-grid">
        {blueprint.riskRules.map((rule) => (
          <article key={rule.id}>
            <strong>{rule.name}</strong>
            <span>{rule.severity}</span>
            <p>{rule.condition}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ActivityPanel({ activities }: { activities: AgentActivity[] }) {
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <h2>Agent Activity</h2>
        <span>{activities.length} records</span>
      </div>
      <div className="activity-list">
        {activities.length ? (
          activities.slice().reverse().map((activity) => (
            <article className="activity-item" key={activity.id}>
              <div className="activity-title">
                <strong>{activity.skillName}</strong>
                <span className={activity.status}>{activity.status}</span>
              </div>
              <dl>
                <div>
                  <dt>Input</dt>
                  <dd>{activity.inputSummary}</dd>
                </div>
                <div>
                  <dt>Output</dt>
                  <dd>{activity.outputSummary}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{formatActivityTime(activity.createdAt)}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <p className="empty-state">提交或推进申请后，这里会显示底层 Skill 调用记录。</p>
        )}
      </div>
    </section>
  )
}

function ReportsPanel({ report }: { report: ReportSnapshot | null }) {
  return (
    <section className="panel reports-panel">
      <div className="panel-heading">
        <h2>Reports</h2>
        <span>AI CEO summary</span>
      </div>
      <div className="summary-row report-metrics">
        <Metric label="Total Amount" value={formatMoney(report?.totalAmount ?? 0)} />
        <Metric label="High Risk" value={report?.highRiskRequestCount ?? 0} />
        <Metric
          label="Avg Cycle"
          value={`${formatNumber(report?.averageApprovalCycleTimeHours ?? 0)}h`}
        />
      </div>
      <div className="status-distribution">
        {Object.entries(report?.requestCountByStatus ?? { submitted: 0 }).map(([status, count]) => (
          <div key={status}>
            <span>{status}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <p className="ceo-summary">
        {report?.summary ?? '提交采购申请后，系统会生成面向管理层的 AI CEO 摘要。'}
      </p>
    </section>
  )
}

function renderField(
  field: FormField,
  value: RequestData[string],
  updateField: (field: FormField, value: string) => void,
) {
  if (field.type === 'select') {
    return (
      <select value={String(value ?? '')} onChange={(event) => updateField(field, event.target.value)}>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        required={field.required}
        value={String(value ?? '')}
        onChange={(event) => updateField(field, event.target.value)}
      />
    )
  }

  return (
    <input
      required={field.required}
      type={field.type}
      value={String(value ?? '')}
      onChange={(event) => updateField(field, event.target.value)}
    />
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(value)
}

export default App
