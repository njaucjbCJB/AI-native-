import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { approveCurrentStep, rejectCurrentStep, type WorkflowInstance } from './core/workflow'
import { generateBlueprintFromRequirement, type Blueprint, type FormField } from './core/blueprint'
import { LocalStorageAdapter } from './core/storage'
import { submitRuntimeRequest, type RuntimeSubmissionResult } from './core/runtime'
import type { ApprovalRole } from './core/approval-routing'
import type { RequestData, RequestInstance } from './core/request'
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
  const [latestResult, setLatestResult] = useState<RuntimeSubmissionResult | null>(null)
  const [selectedRole, setSelectedRole] = useState<ApprovalRole>('department_manager')
  const [message, setMessage] = useState('Runtime ready')

  useEffect(() => {
    async function initializeRuntime() {
      const defaultBlueprint = generateBlueprintFromRequirement(DEFAULT_REQUIREMENT)

      await storage.saveBlueprint(defaultBlueprint)
      await storage.setActiveBlueprint(defaultBlueprint.id)
      setBlueprint(defaultBlueprint)
      setRequests(await storage.getRequestInstances())
      setWorkflows(await storage.getWorkflowInstances())
    }

    void initializeRuntime()
  }, [storage])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const result = await submitRuntimeRequest(storage, formData)

      setLatestResult(result)
      setRequests(await storage.getRequestInstances())
      setWorkflows(await storage.getWorkflowInstances())
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
        ? approveCurrentStep(workflow, { comment: `${ROLE_LABELS[selectedRole]} approved.` })
        : rejectCurrentStep(workflow, { comment: `${ROLE_LABELS[selectedRole]} rejected.` })

    await storage.saveWorkflowInstance(nextWorkflow)
    setWorkflows(await storage.getWorkflowInstances())
    setMessage(`${ROLE_LABELS[selectedRole]} ${decision === 'approve' ? 'approved' : 'rejected'} ${workflow.requestId}`)
  }

  function updateField(field: FormField, value: string) {
    setFormData((current) => ({
      ...current,
      [field.key]: field.type === 'number' ? Number(value) : value,
    }))
  }

  return (
    <main className="runtime-shell">
      <header className="runtime-header">
        <div>
          <p className="eyebrow">AI Enterprise Operating Framework Console</p>
          <h1>采购审批 Runtime</h1>
        </div>
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
      </header>

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
      </section>
    </main>
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

export default App
