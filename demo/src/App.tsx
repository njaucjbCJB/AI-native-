import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import type { RJSFSchema } from '@rjsf/utils'
import { runApproveCurrentStep, runRejectCurrentStep, type AgentActivity } from './core/agent-activity'
import type { WorkflowInstance } from './core/workflow'
import type { Blueprint, FormField } from './core/blueprint'
import { LocalStorageAdapter } from './core/storage'
import { submitRuntimeRequest, type RuntimeSubmissionResult } from './core/runtime'
import type { ApprovalRole } from './core/approval-routing'
import type { RequestData, RequestInstance } from './core/request'
import { generateReportFromRuntimeStorage, type ReportSnapshot } from './core/report'
import { getFrameworkConsoleViews, type ConsoleView, type ConsoleViewId } from './core/console'
import { ProjectAuditBlueprintConsole } from './ProjectAuditBlueprintConsole'
import type { Project } from './core/project'
import {
  getFieldAccess,
  getVisibleProjectAuditInstances,
  type ProjectAuditActor,
} from './core/audit-permissions'
import {
  approveProjectOwnerSelfApproval,
  approveAiCeoProjectAuditInstance,
  approveVpProjectAuditInstance,
  rejectAiCeoProjectAuditInstance,
  rejectVpProjectAuditInstance,
  submitProjectAuditInstance,
  withdrawProjectAuditInstance,
  type ApprovalRecord,
} from './core/audit-workflow'
import {
  createAiCeoAssessment,
  type AiCeoAssessment,
} from './core/ai-ceo-assessment'
import {
  addProjectsToStartedAuditCycle,
  closeAuditCycle,
  createDraftAuditCycle,
  removeProjectsFromStartedAuditCycle,
  startAuditCycle,
  updateAuditScope,
  type AuditCycle,
  type ProjectAuditFormData,
  type ProjectAuditInstance,
} from './core/audit-cycle'
import { saveProjectAuditForm, type AuditChangeRecord } from './core/audit-form'
import {
  initializeProjectAuditDemo,
  resetProjectAuditDemoData,
} from './core/demo-scenario'
import type { ProjectAuditBlueprint } from './core/project-audit-blueprint'
import { PROJECT_AUDIT_FORM_UI_SCHEMA } from './projectAuditFormUi'
import './App.css'

const ROLE_LABELS: Record<ApprovalRole, string> = {
  department_manager: '部门经理',
  finance: '财务',
  ceo: 'CEO',
}

const PROJECT_AUDIT_ACTORS: Array<ProjectAuditActor & { label: string }> = [
  { roleId: 'audit_administrator', name: 'Audit Admin', label: '审计管理员' },
  { roleId: 'project_owner', name: 'Alice Chen', label: '负责人 Alice' },
  { roleId: 'supervising_vp', name: 'Victor Zhao', label: 'VP Victor' },
  { roleId: 'ai_ceo', name: 'AI CEO', label: 'AI CEO' },
  { roleId: 'global_viewer', name: 'Observer', label: '全局查看者' },
]

const PROJECT_AUDIT_STATUS_LABELS: Record<ProjectAuditInstance['status'], string> = {
  draft: '待填写',
  owner_self_approval: '待负责人自审批',
  vp_approval: '待分管 VP 审批',
  ai_ceo_approval: '待 AI CEO 审批',
  rework: '退回修改',
  approved: '已通过',
}

const AUDIT_CYCLE_STATUS_LABELS: Record<AuditCycle['status'], string> = {
  draft: '草稿',
  started: '已启动',
  closed: '已关闭',
}

const AI_CEO_RISK_LABELS: Record<AiCeoAssessment['riskLevel'], string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

const AI_CEO_RECOMMENDATION_LABELS: Record<
  AiCeoAssessment['recommendation'],
  string
> = {
  approve: '建议通过',
  review: '建议审慎确认',
  reject: '建议退回',
}

const APPROVAL_RECORD_LABELS: Record<
  ApprovalRecord['roleId'],
  Record<ApprovalRecord['decision'], string>
> = {
  project_owner: {
    approved: '负责人自审批通过',
    rejected: '负责人驳回',
    withdrawn: '负责人撤回',
  },
  supervising_vp: {
    approved: 'VP 通过',
    rejected: 'VP 驳回',
    withdrawn: 'VP 撤回',
  },
  ai_ceo: {
    approved: 'AI CEO 批准',
    rejected: 'AI CEO 驳回',
    withdrawn: 'AI CEO 撤回',
  },
}

const INITIAL_FORM_DATA: RequestData = {
  itemName: 'Security audit',
  department: 'Engineering',
  amount: 12000,
  vendor: 'Unknown Vendor',
  neededBy: '2026-07-01',
  reason: 'Run a security audit before the next enterprise customer launch.',
}

type AppViewId = 'project-audit-blueprint' | ConsoleViewId

function App() {
  const storage = useMemo(() => new LocalStorageAdapter(), [])
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null)
  const [formData, setFormData] = useState<RequestData>(INITIAL_FORM_DATA)
  const [requests, setRequests] = useState<RequestInstance[]>([])
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([])
  const [agentActivities, setAgentActivities] = useState<AgentActivity[]>([])
  const [reports, setReports] = useState<ReportSnapshot[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [auditCycles, setAuditCycles] = useState<AuditCycle[]>([])
  const [projectAuditInstances, setProjectAuditInstances] = useState<ProjectAuditInstance[]>([])
  const [auditChangeRecords, setAuditChangeRecords] = useState<AuditChangeRecord[]>([])
  const [approvalRecords, setApprovalRecords] = useState<ApprovalRecord[]>([])
  const [aiCeoAssessments, setAiCeoAssessments] = useState<AiCeoAssessment[]>([])
  const [latestResult, setLatestResult] = useState<RuntimeSubmissionResult | null>(null)
  const [selectedRole, setSelectedRole] = useState<ApprovalRole>('department_manager')
  const [activeView, setActiveView] = useState<AppViewId>('project-audit-blueprint')
  const [message, setMessage] = useState('Runtime ready')
  const [resetConfirmArmed, setResetConfirmArmed] = useState(false)
  const [demoResetRevision, setDemoResetRevision] = useState(0)
  const consoleViews = useMemo(
    () => (blueprint ? getFrameworkConsoleViews(blueprint) : []),
    [blueprint],
  )
  const activeConsoleView = consoleViews.find((view) => view.id === activeView)

  const refreshRuntimeState = useCallback(async () => {
    const [
      nextRequests,
      nextWorkflows,
      nextAgentActivities,
      nextReports,
      nextProjects,
      nextAuditCycles,
      nextProjectAuditInstances,
      nextAuditChangeRecords,
      nextApprovalRecords,
      nextAiCeoAssessments,
    ] = await Promise.all([
      storage.getRequestInstances(),
      storage.getWorkflowInstances(),
      storage.getAgentActivities(),
      storage.getReportSnapshots(),
      storage.getProjects(),
      storage.getAuditCycles(),
      storage.getProjectAuditInstances(),
      storage.getAuditChangeRecords(),
      storage.getApprovalRecords(),
      storage.getAiCeoAssessments(),
    ])

    setRequests(nextRequests)
    setWorkflows(nextWorkflows)
    setAgentActivities(nextAgentActivities)
    setReports(nextReports)
    setProjects(nextProjects)
    setAuditCycles(nextAuditCycles)
    setProjectAuditInstances(nextProjectAuditInstances)
    setAuditChangeRecords(nextAuditChangeRecords)
    setApprovalRecords(nextApprovalRecords)
    setAiCeoAssessments(nextAiCeoAssessments)
  }, [storage])

  useEffect(() => {
    async function initializeRuntime() {
      await initializeProjectAuditDemo(storage)
      setBlueprint(await storage.getActiveBlueprint())
      await refreshRuntimeState()
    }

    void initializeRuntime()
  }, [refreshRuntimeState, storage])

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

  async function handleSaveProject(project: Project) {
    await storage.saveProject(project)
    await refreshRuntimeState()
    setMessage(`已保存项目 ${project.code}`)
  }

  async function handleCreateAuditCycle(input: {
    name: string
    startDate: string
    endDate: string
  }) {
    const cycle = await createDraftAuditCycle(storage, input)

    await refreshRuntimeState()
    setMessage(`已创建草稿周期 ${cycle.name}`)
  }

  async function handleUpdateAuditScope(cycleId: string, projectIds: string[]) {
    try {
      const cycle = await updateAuditScope(storage, cycleId, projectIds)

      await refreshRuntimeState()
      setMessage(`已更新 ${cycle.name} 的审计范围`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新审计范围失败')
    }
  }

  async function handleAddProjectsToStartedAuditCycle(
    cycleId: string,
    projectIds: string[],
  ) {
    try {
      const result = await addProjectsToStartedAuditCycle(storage, cycleId, projectIds)

      await refreshRuntimeState()
      setMessage(`已追加 ${result.instances.length} 个项目并生成审计实例`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '追加项目失败')
    }
  }

  async function handleRemoveProjectsFromStartedAuditCycle(
    cycleId: string,
    projectIds: string[],
  ) {
    try {
      const cycle = await removeProjectsFromStartedAuditCycle(storage, cycleId, projectIds)

      await refreshRuntimeState()
      setMessage(`已更新 ${cycle.name} 的启动后审计范围`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '移除项目失败')
    }
  }

  async function handleStartAuditCycle(cycleId: string) {
    try {
      const result = await startAuditCycle(storage, cycleId)

      await refreshRuntimeState()
      setMessage(`已启动 ${result.cycle.name}，生成 ${result.instances.length} 条审计实例`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '启动审计周期失败')
    }
  }

  async function handleCloseAuditCycle(cycleId: string) {
    try {
      const cycle = await closeAuditCycle(storage, cycleId)

      await refreshRuntimeState()
      setMessage(`已关闭 ${cycle.name}，不能再追加项目或生成新实例`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '关闭审计周期失败')
    }
  }

  async function handleResetDemoData() {
    if (!resetConfirmArmed) {
      setResetConfirmArmed(true)
      setMessage('再次点击“确认重置”会清空当前演示数据，并恢复初始 Blueprint 和 3 个示例项目。')
      return
    }

    await resetProjectAuditDemoData(storage)
    setBlueprint(await storage.getActiveBlueprint())
    await refreshRuntimeState()
    setResetConfirmArmed(false)
    setDemoResetRevision((revision) => revision + 1)
    setMessage('演示数据已重置：Blueprint 和 3 个示例项目已恢复，周期和实例已清空。')
  }

  async function handleSaveAuditForm(
    instanceId: string,
    formData: ProjectAuditFormData,
    reason: string,
    actor: ProjectAuditActor,
  ) {
    try {
      const changeReasons = reason.trim()
        ? {
            'projectSnapshot.projectCode': reason,
            'projectSnapshot.projectOwner': reason,
            'projectSnapshot.supervisingVp': reason,
            'executionPerformance.approvedBudget': reason,
            strategicObjectiveAssessments: reason,
          }
        : undefined
      const saved = await saveProjectAuditForm(storage, instanceId, formData, {
        actor: actor.name,
        changeReasons,
      })

      await refreshRuntimeState()
      setMessage(`已保存审计实例 ${saved.id}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存审计表单失败')
    }
  }

  async function handleSubmitProjectAuditInstance(
    instanceId: string,
    actor: ProjectAuditActor,
  ) {
    try {
      const submitted = await submitProjectAuditInstance(storage, instanceId, {
        actor: actor.name,
      })

      await refreshRuntimeState()
      setMessage(`已提交 ${submitted.projectSnapshot.projectName}，等待负责人自审批`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交审计实例失败')
    }
  }

  async function handleApproveProjectOwnerSelfApproval(
    instanceId: string,
    actor: ProjectAuditActor,
  ) {
    try {
      const approved = await approveProjectOwnerSelfApproval(storage, instanceId, {
        actor: actor.name,
        comment: '项目负责人确认本次申报内容。',
      })

      await refreshRuntimeState()
      setMessage(`负责人已自审批 ${approved.projectSnapshot.projectName}，进入 VP 审批`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '负责人自审批失败')
    }
  }

  async function handleWithdrawProjectAuditInstance(
    instanceId: string,
    actor: ProjectAuditActor,
  ) {
    try {
      const withdrawn = await withdrawProjectAuditInstance(storage, instanceId, {
        actor: actor.name,
        comment: '项目负责人撤回修改。',
      })

      await refreshRuntimeState()
      setMessage(`已撤回 ${withdrawn.projectSnapshot.projectName}，重新回到可编辑状态`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '撤回审计实例失败')
    }
  }

  async function handleApproveVpProjectAuditInstance(
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) {
    try {
      const approved = await approveVpProjectAuditInstance(storage, instanceId, {
        actor: actor.name,
        comment: comment.trim() || undefined,
      })

      await refreshRuntimeState()
      setMessage(`VP 已通过 ${approved.projectSnapshot.projectName}，进入 AI CEO 审批`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'VP 审批失败')
    }
  }

  async function handleRejectVpProjectAuditInstance(
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) {
    try {
      const rejected = await rejectVpProjectAuditInstance(storage, instanceId, {
        actor: actor.name,
        comment,
      })

      await refreshRuntimeState()
      setMessage(`VP 已驳回 ${rejected.projectSnapshot.projectName}，退回项目负责人修改`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'VP 驳回失败')
    }
  }

  async function handleGenerateAiCeoAssessment(instanceId: string) {
    try {
      const assessment = await createAiCeoAssessment(storage, instanceId)

      await refreshRuntimeState()
      setMessage(`已生成 AI CEO 建议：${AI_CEO_RISK_LABELS[assessment.riskLevel]}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI CEO 建议生成失败')
    }
  }

  async function handleApproveAiCeoProjectAuditInstance(
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) {
    try {
      const approved = await approveAiCeoProjectAuditInstance(storage, instanceId, {
        actor: actor.name,
        comment: comment.trim() || undefined,
      })

      await refreshRuntimeState()
      setMessage(`AI CEO 已最终批准 ${approved.projectSnapshot.projectName}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI CEO 批准失败')
    }
  }

  async function handleRejectAiCeoProjectAuditInstance(
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) {
    try {
      const rejected = await rejectAiCeoProjectAuditInstance(storage, instanceId, {
        actor: actor.name,
        comment,
      })

      await refreshRuntimeState()
      setMessage(`AI CEO 已驳回 ${rejected.projectSnapshot.projectName}，退回项目负责人修改`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI CEO 驳回失败')
    }
  }

  function updateField(field: FormField, value: string) {
    setFormData((current) => ({
      ...current,
      [field.key]: field.type === 'number' ? Number(value) : value,
    }))
  }

  function renderActiveView() {
    if (activeView === 'project-audit-blueprint') {
      return <ProjectAuditBlueprintConsole key={demoResetRevision} storage={storage} />
    }

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

    if (activeView === 'project-registry') {
      return (
        <ProjectRegistryPanel
          message={message}
          onSave={handleSaveProject}
          projects={projects}
        />
      )
    }

    if (activeView === 'audit-cycles') {
      return (
        <AuditCyclesPanel
          auditCycles={auditCycles}
          auditChangeRecords={auditChangeRecords}
          aiCeoAssessments={aiCeoAssessments}
          approvalRecords={approvalRecords}
          message={message}
          onCreate={handleCreateAuditCycle}
          onAddProjectsToStartedCycle={handleAddProjectsToStartedAuditCycle}
          onApproveOwnerSelfApproval={handleApproveProjectOwnerSelfApproval}
          onApproveAiCeo={handleApproveAiCeoProjectAuditInstance}
          onApproveVp={handleApproveVpProjectAuditInstance}
          onClose={handleCloseAuditCycle}
          onGenerateAiCeoAssessment={handleGenerateAiCeoAssessment}
          onRejectAiCeo={handleRejectAiCeoProjectAuditInstance}
          onRejectVp={handleRejectVpProjectAuditInstance}
          onRemoveProjectsFromStartedCycle={handleRemoveProjectsFromStartedAuditCycle}
          onSubmitProjectAuditInstance={handleSubmitProjectAuditInstance}
          onSaveAuditForm={handleSaveAuditForm}
          onStart={handleStartAuditCycle}
          onUpdateScope={handleUpdateAuditScope}
          onWithdrawProjectAuditInstance={handleWithdrawProjectAuditInstance}
          projectAuditInstances={projectAuditInstances}
          projects={projects}
          storage={storage}
        />
      )
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
          <button
            className={activeView === 'project-audit-blueprint' ? 'active' : ''}
            onClick={() => setActiveView('project-audit-blueprint')}
            type="button"
          >
            项目审计蓝图
          </button>
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
          <h1>
            {activeView === 'project-audit-blueprint'
              ? '项目审计自动配置'
              : (activeConsoleView?.title ?? 'Runtime')}
          </h1>
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
        <button
          className={resetConfirmArmed ? 'danger-action' : ''}
          onClick={() => void handleResetDemoData()}
          type="button"
        >
          {resetConfirmArmed ? '确认重置' : '重置演示数据'}
        </button>
      </header>

        {renderActiveView()}
      </section>
    </main>
  )
}

type ProjectFormState = Omit<Project, 'approvedBudget' | 'currentCost' | 'milestones'> & {
  approvedBudget: string
  currentCost: string
  milestonesText: string
}

const EMPTY_PROJECT_FORM: ProjectFormState = {
  id: '',
  code: '',
  name: '',
  owner: '',
  supervisingVp: '',
  department: '',
  plannedStartDate: '',
  plannedEndDate: '',
  strategicObjective: '',
  approvedBudget: '',
  currentCost: '',
  milestonesText: '',
}

function ProjectRegistryPanel({
  projects,
  message,
  onSave,
}: {
  projects: Project[]
  message: string
  onSave: (project: Project) => Promise<void>
}) {
  const [form, setForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM)

  function updateForm(key: keyof ProjectFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function editProject(project: Project) {
    setForm({
      ...project,
      approvedBudget: String(project.approvedBudget),
      currentCost: String(project.currentCost),
      milestonesText: project.milestones
        .map((milestone) => `${milestone.name} | ${milestone.plannedCompletionDate}`)
        .join('\n'),
    })
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const projectId = form.id || crypto.randomUUID()
    const milestones = form.milestonesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [name, plannedCompletionDate = ''] = line.split('|').map((value) => value.trim())

        return {
          id: `${projectId}-milestone-${index + 1}`,
          name,
          plannedCompletionDate,
        }
      })

    await onSave({
      id: projectId,
      code: form.code,
      name: form.name,
      owner: form.owner,
      supervisingVp: form.supervisingVp,
      department: form.department,
      plannedStartDate: form.plannedStartDate,
      plannedEndDate: form.plannedEndDate,
      strategicObjective: form.strategicObjective,
      approvedBudget: Number(form.approvedBudget),
      currentCost: Number(form.currentCost),
      milestones,
    })
    setForm(EMPTY_PROJECT_FORM)
  }

  return (
    <section className="admin-grid">
      <form className="panel admin-form" onSubmit={(event) => void submitProject(event)}>
        <div className="panel-heading">
          <h2>{form.id ? '编辑项目' : '新增项目'}</h2>
          <span>Project Registry</span>
        </div>
        <div className="form-grid">
          <TextField label="项目编号" required value={form.code} onChange={(value) => updateForm('code', value)} />
          <TextField label="项目名称" required value={form.name} onChange={(value) => updateForm('name', value)} />
          <TextField label="项目负责人" required value={form.owner} onChange={(value) => updateForm('owner', value)} />
          <TextField label="分管项目 VP" required value={form.supervisingVp} onChange={(value) => updateForm('supervisingVp', value)} />
          <TextField label="所属部门" required value={form.department} onChange={(value) => updateForm('department', value)} />
          <TextField label="计划开始日期" required type="date" value={form.plannedStartDate} onChange={(value) => updateForm('plannedStartDate', value)} />
          <TextField label="计划结束日期" required type="date" value={form.plannedEndDate} onChange={(value) => updateForm('plannedEndDate', value)} />
          <TextField label="批准预算" required type="number" value={form.approvedBudget} onChange={(value) => updateForm('approvedBudget', value)} />
          <TextField label="当前成本" required type="number" value={form.currentCost} onChange={(value) => updateForm('currentCost', value)} />
        </div>
        <label className="field">
          <span>战略目标<strong>*</strong></span>
          <textarea required value={form.strategicObjective} onChange={(event) => updateForm('strategicObjective', event.target.value)} />
        </label>
        <label className="field">
          <span>里程碑（每行：名称 | 计划完成日期）<strong>*</strong></span>
          <textarea
            placeholder="Pilot launch | 2026-09-30"
            required
            value={form.milestonesText}
            onChange={(event) => updateForm('milestonesText', event.target.value)}
          />
        </label>
        <div className="form-actions">
          <button className="primary-action" type="submit">{form.id ? '保存修改' : '新增项目'}</button>
          {form.id ? (
            <button type="button" onClick={() => setForm(EMPTY_PROJECT_FORM)}>取消编辑</button>
          ) : null}
        </div>
        <p className="status-message">{message}</p>
      </form>

      <section className="panel">
        <div className="panel-heading">
          <h2>当前项目</h2>
          <span>{projects.length} 个项目</span>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-heading">
                <div>
                  <span>{project.code} · {project.department}</span>
                  <h3>{project.name}</h3>
                </div>
                <button type="button" onClick={() => editProject(project)}>编辑</button>
              </div>
              <dl>
                <div><dt>负责人</dt><dd>{project.owner}</dd></div>
                <div><dt>分管 VP</dt><dd>{project.supervisingVp}</dd></div>
                <div><dt>周期</dt><dd>{project.plannedStartDate} 至 {project.plannedEndDate}</dd></div>
                <div><dt>预算 / 成本</dt><dd>{formatMoney(project.approvedBudget)} / {formatMoney(project.currentCost)}</dd></div>
              </dl>
              <p>{project.strategicObjective}</p>
              <span>{project.milestones.length} 个里程碑</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

function AuditCyclesPanel({
  auditCycles,
  auditChangeRecords,
  aiCeoAssessments,
  approvalRecords,
  projects,
  projectAuditInstances,
  message,
  onCreate,
  onAddProjectsToStartedCycle,
  onApproveOwnerSelfApproval,
  onApproveAiCeo,
  onApproveVp,
  onClose,
  onGenerateAiCeoAssessment,
  onRejectAiCeo,
  onRejectVp,
  onRemoveProjectsFromStartedCycle,
  onSaveAuditForm,
  onStart,
  onSubmitProjectAuditInstance,
  onUpdateScope,
  onWithdrawProjectAuditInstance,
  storage,
}: {
  auditCycles: AuditCycle[]
  auditChangeRecords: AuditChangeRecord[]
  aiCeoAssessments: AiCeoAssessment[]
  approvalRecords: ApprovalRecord[]
  projects: Project[]
  projectAuditInstances: ProjectAuditInstance[]
  message: string
  onCreate: (input: { name: string; startDate: string; endDate: string }) => Promise<void>
  onAddProjectsToStartedCycle: (
    cycleId: string,
    projectIds: string[],
  ) => Promise<void>
  onApproveOwnerSelfApproval: (
    instanceId: string,
    actor: ProjectAuditActor,
  ) => Promise<void>
  onApproveAiCeo: (
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) => Promise<void>
  onApproveVp: (
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) => Promise<void>
  onClose: (cycleId: string) => Promise<void>
  onGenerateAiCeoAssessment: (instanceId: string) => Promise<void>
  onRejectAiCeo: (
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) => Promise<void>
  onRejectVp: (
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) => Promise<void>
  onRemoveProjectsFromStartedCycle: (
    cycleId: string,
    projectIds: string[],
  ) => Promise<void>
  onSaveAuditForm: (
    instanceId: string,
    formData: ProjectAuditFormData,
    reason: string,
    actor: ProjectAuditActor,
  ) => Promise<void>
  onSubmitProjectAuditInstance: (
    instanceId: string,
    actor: ProjectAuditActor,
  ) => Promise<void>
  onStart: (cycleId: string) => Promise<void>
  onUpdateScope: (cycleId: string, projectIds: string[]) => Promise<void>
  onWithdrawProjectAuditInstance: (
    instanceId: string,
    actor: ProjectAuditActor,
  ) => Promise<void>
  storage: LocalStorageAdapter
}) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  async function submitCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onCreate({ name, startDate, endDate })
    setName('')
    setStartDate('')
    setEndDate('')
  }

  function toggleProject(cycle: AuditCycle, projectId: string, checked: boolean) {
    if (cycle.status === 'closed') {
      return
    }

    if (cycle.status === 'started') {
      void (checked
        ? onAddProjectsToStartedCycle(cycle.id, [projectId])
        : onRemoveProjectsFromStartedCycle(cycle.id, [projectId]))
      return
    }

    const projectIds = checked
      ? [...cycle.projectIds, projectId]
      : cycle.projectIds.filter((candidate) => candidate !== projectId)

    void onUpdateScope(cycle.id, projectIds)
  }

  return (
    <section className="admin-grid">
      <form className="panel admin-form compact-form" onSubmit={(event) => void submitCycle(event)}>
        <div className="panel-heading">
          <h2>创建审计周期</h2>
          <span>初始状态：草稿</span>
        </div>
        <TextField label="周期名称" required value={name} onChange={setName} />
        <TextField label="开始日期" required type="date" value={startDate} onChange={setStartDate} />
        <TextField label="结束日期" required type="date" value={endDate} onChange={setEndDate} />
        <button className="primary-action" type="submit">创建草稿周期</button>
        <p className="status-message">{message}</p>
      </form>

      <section className="cycle-list">
        {auditCycles.length ? auditCycles.map((cycle) => (
          <article className="panel cycle-card" key={cycle.id}>
            <div className="panel-heading">
              <div>
                <h2>{cycle.name}</h2>
                <p>{cycle.startDate} 至 {cycle.endDate}</p>
              </div>
              <span className="status-badge">{AUDIT_CYCLE_STATUS_LABELS[cycle.status]}</span>
            </div>
            <p className="view-description">
              {cycle.status === 'draft'
                ? '选择本周期需要审计的项目，启动时会为每个项目生成实例。'
                : cycle.status === 'started'
                  ? '周期已启动：勾选新项目会立即生成实例；已开始填写的项目不能移除。'
                  : '周期已关闭：不能继续追加项目或生成实例。'}
            </p>
            <div className="scope-options">
              {projects.map((project) => (
                <label key={project.id}>
                  <input
                    checked={cycle.projectIds.includes(project.id)}
                    disabled={cycle.status === 'closed'}
                    onChange={(event) => toggleProject(cycle, project.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span><strong>{project.name}</strong>{project.code} · {project.owner}</span>
                </label>
              ))}
            </div>
            <div className="form-actions">
              <p className="scope-summary">已选择 {cycle.projectIds.length} 个项目</p>
              {cycle.status === 'draft' ? (
                <button
                  className="primary-action"
                  disabled={cycle.projectIds.length === 0}
                  onClick={() => void onStart(cycle.id)}
                  type="button"
                >
                  启动周期
                </button>
              ) : null}
              {cycle.status === 'started' ? (
                <button
                  className="primary-action"
                  onClick={() => void onClose(cycle.id)}
                  type="button"
                >
                  关闭周期
                </button>
              ) : null}
            </div>
          </article>
        )) : (
          <section className="panel">
            <p className="empty-state">尚无审计周期。先创建一个草稿周期，再选择审计范围。</p>
          </section>
        )}
      </section>
      <ProjectAuditInstanceRuntimePanel
        auditChangeRecords={auditChangeRecords}
        aiCeoAssessments={aiCeoAssessments}
        approvalRecords={approvalRecords}
        instances={projectAuditInstances}
        onApproveOwnerSelfApproval={onApproveOwnerSelfApproval}
        onApproveAiCeo={onApproveAiCeo}
        onApproveVp={onApproveVp}
        onGenerateAiCeoAssessment={onGenerateAiCeoAssessment}
        onRejectAiCeo={onRejectAiCeo}
        onRejectVp={onRejectVp}
        onSaveAuditForm={onSaveAuditForm}
        onSubmitProjectAuditInstance={onSubmitProjectAuditInstance}
        onWithdrawProjectAuditInstance={onWithdrawProjectAuditInstance}
        projects={projects}
        storage={storage}
      />
    </section>
  )
}

function ProjectAuditInstanceRuntimePanel({
  auditChangeRecords,
  aiCeoAssessments,
  approvalRecords,
  instances,
  onApproveOwnerSelfApproval,
  onApproveAiCeo,
  onApproveVp,
  onGenerateAiCeoAssessment,
  onRejectAiCeo,
  onRejectVp,
  onSaveAuditForm,
  onSubmitProjectAuditInstance,
  onWithdrawProjectAuditInstance,
  projects,
  storage,
}: {
  auditChangeRecords: AuditChangeRecord[]
  aiCeoAssessments: AiCeoAssessment[]
  approvalRecords: ApprovalRecord[]
  instances: ProjectAuditInstance[]
  onApproveOwnerSelfApproval: (
    instanceId: string,
    actor: ProjectAuditActor,
  ) => Promise<void>
  onApproveAiCeo: (
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) => Promise<void>
  onApproveVp: (
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) => Promise<void>
  onGenerateAiCeoAssessment: (instanceId: string) => Promise<void>
  onRejectAiCeo: (
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) => Promise<void>
  onRejectVp: (
    instanceId: string,
    actor: ProjectAuditActor,
    comment: string,
  ) => Promise<void>
  onSaveAuditForm: (
    instanceId: string,
    formData: ProjectAuditFormData,
    reason: string,
    actor: ProjectAuditActor,
  ) => Promise<void>
  onSubmitProjectAuditInstance: (
    instanceId: string,
    actor: ProjectAuditActor,
  ) => Promise<void>
  onWithdrawProjectAuditInstance: (
    instanceId: string,
    actor: ProjectAuditActor,
  ) => Promise<void>
  projects: Project[]
  storage: LocalStorageAdapter
}) {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)
  const [activeBlueprint, setActiveBlueprint] = useState<ProjectAuditBlueprint | null>(null)
  const [selectedActor, setSelectedActor] = useState<ProjectAuditActor>(
    PROJECT_AUDIT_ACTORS[1],
  )
  const [reason, setReason] = useState('')
  const [decisionComment, setDecisionComment] = useState('')
  const visibleInstances = activeBlueprint
    ? getVisibleProjectAuditInstances(activeBlueprint, instances, selectedActor)
    : instances
  const selectedInstance =
    visibleInstances.find((instance) => instance.id === selectedInstanceId) ??
    visibleInstances[0] ??
    null

  useEffect(() => {
    async function loadBlueprint() {
      const activeVersion = await storage.getActiveBlueprintVersion()

      if (!activeVersion) {
        return
      }

      setActiveBlueprint(activeVersion)
    }

    void loadBlueprint()
  }, [storage])

  async function submitAuditForm(event: { formData?: unknown }) {
    if (!selectedInstance || !event.formData) {
      return
    }

    await onSaveAuditForm(
      selectedInstance.id,
      event.formData as ProjectAuditFormData,
      reason,
      selectedActor,
    )
    setReason('')
  }

  const selectedProject = selectedInstance
    ? projects.find((project) => project.id === selectedInstance.projectId)
    : null
  const selectedChangeRecords = selectedInstance
    ? auditChangeRecords.filter((record) => record.instanceId === selectedInstance.id)
    : []
  const selectedApprovalRecords = selectedInstance
    ? approvalRecords.filter((record) => record.instanceId === selectedInstance.id)
    : []
  const selectedAiCeoAssessment = selectedInstance
    ? aiCeoAssessments
        .filter((assessment) => assessment.instanceId === selectedInstance.id)
        .at(-1) ?? null
    : null
  const fieldAccess =
    selectedInstance && activeBlueprint
      ? getFieldAccess(activeBlueprint, selectedInstance, selectedActor, 'ownerSummary')
      : 'hidden'
  const canEditForm = fieldAccess === 'edit'
  const canSubmit =
    canEditForm &&
    selectedInstance !== null &&
    (selectedInstance.status === 'draft' || selectedInstance.status === 'rework')
  const canSelfApprove =
    selectedInstance !== null &&
    selectedActor.roleId === 'project_owner' &&
    selectedInstance.status === 'owner_self_approval'
  const canWithdraw =
    selectedInstance !== null &&
    selectedActor.roleId === 'project_owner' &&
    (selectedInstance.status === 'owner_self_approval' ||
      selectedInstance.status === 'vp_approval')
  const canVpApprove =
    selectedInstance !== null &&
    selectedActor.roleId === 'supervising_vp' &&
    selectedInstance.status === 'vp_approval'
  const canAiCeoApprove =
    selectedInstance !== null &&
    selectedActor.roleId === 'ai_ceo' &&
    selectedInstance.status === 'ai_ceo_approval'

  return (
    <section className="panel audit-runtime-panel">
      <div className="panel-heading">
        <h2>项目审计实例</h2>
        <span>{visibleInstances.length} / {instances.length} 条可见</span>
      </div>
      <div className="project-audit-role-switcher" aria-label="项目审计角色切换">
        {PROJECT_AUDIT_ACTORS.map((actor) => (
          <button
            className={
              selectedActor.roleId === actor.roleId && selectedActor.name === actor.name
                ? 'active'
                : ''
            }
            key={`${actor.roleId}-${actor.name}`}
            onClick={() => setSelectedActor(actor)}
            type="button"
          >
            {actor.label}
          </button>
        ))}
      </div>
      {visibleInstances.length ? (
        <div className="audit-runtime-layout">
          <div className="audit-instance-list">
            {visibleInstances.map((instance) => {
              const project = projects.find((candidate) => candidate.id === instance.projectId)

              return (
                <button
                  className={selectedInstance?.id === instance.id ? 'active' : ''}
                  key={instance.id}
                  onClick={() => setSelectedInstanceId(instance.id)}
                  type="button"
                >
                  <strong>{project?.name ?? instance.projectSnapshot.projectName}</strong>
                  <span>
                    {PROJECT_AUDIT_STATUS_LABELS[instance.status]} · Blueprint v{instance.blueprintVersion}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="audit-form-shell">
            {selectedInstance && activeBlueprint ? (
              <>
                <div className="snapshot-strip">
                  <div>
                    <span>项目快照</span>
                    <strong>{selectedInstance.projectSnapshot.projectName}</strong>
                  </div>
                  <div>
                    <span>负责人</span>
                    <strong>{selectedInstance.projectSnapshot.projectOwner}</strong>
                  </div>
                  <div>
                    <span>台账当前预算</span>
                    <strong>{formatMoney(selectedProject?.approvedBudget ?? 0)}</strong>
                  </div>
                  <div>
                    <span>当前状态</span>
                    <strong>{PROJECT_AUDIT_STATUS_LABELS[selectedInstance.status]}</strong>
                  </div>
                </div>
                <div className="audit-action-bar">
                  <button
                    disabled={!canSubmit}
                    onClick={() => void onSubmitProjectAuditInstance(selectedInstance.id, selectedActor)}
                    type="button"
                  >
                    提交
                  </button>
                  <button
                    disabled={!canSelfApprove}
                    onClick={() => void onApproveOwnerSelfApproval(selectedInstance.id, selectedActor)}
                    type="button"
                  >
                    自审批通过
                  </button>
                  <button
                    disabled={!canWithdraw}
                    onClick={() => void onWithdrawProjectAuditInstance(selectedInstance.id, selectedActor)}
                    type="button"
                  >
                    撤回
                  </button>
                  <button
                    disabled={!canVpApprove}
                    onClick={() => void onApproveVp(selectedInstance.id, selectedActor, decisionComment)}
                    type="button"
                  >
                    VP 通过
                  </button>
                  <button
                    disabled={!canVpApprove}
                    onClick={() => void onRejectVp(selectedInstance.id, selectedActor, decisionComment)}
                    type="button"
                  >
                    VP 驳回
                  </button>
                  <button
                    disabled={!canAiCeoApprove}
                    onClick={() => void onGenerateAiCeoAssessment(selectedInstance.id)}
                    type="button"
                  >
                    生成 AI 建议
                  </button>
                  <button
                    disabled={!canAiCeoApprove}
                    onClick={() => void onApproveAiCeo(selectedInstance.id, selectedActor, decisionComment)}
                    type="button"
                  >
                    AI CEO 批准
                  </button>
                  <button
                    disabled={!canAiCeoApprove}
                    onClick={() => void onRejectAiCeo(selectedInstance.id, selectedActor, decisionComment)}
                    type="button"
                  >
                    AI CEO 驳回
                  </button>
                  <span>{canEditForm ? '可编辑' : fieldAccess === 'read' ? '只读' : '不可见'}</span>
                </div>
                <label className="field">
                  <span>审批意见</span>
                  <textarea
                    placeholder="驳回时必填，通过时可选"
                    value={decisionComment}
                    onChange={(event) => setDecisionComment(event.target.value)}
                  />
                </label>
                {selectedAiCeoAssessment ? (
                  <div className="ai-ceo-assessment-card">
                    <div>
                      <span>AI CEO 建议</span>
                      <strong>{AI_CEO_RISK_LABELS[selectedAiCeoAssessment.riskLevel]} · {AI_CEO_RECOMMENDATION_LABELS[selectedAiCeoAssessment.recommendation]}</strong>
                    </div>
                    <ul>
                      {selectedAiCeoAssessment.keyFindings.map((finding) => (
                        <li key={finding}>{finding}</li>
                      ))}
                    </ul>
                    <p>{selectedAiCeoAssessment.rationale}</p>
                  </div>
                ) : null}
                <label className="field">
                  <span>关键字段修改原因</span>
                  <textarea
                    disabled={!canEditForm}
                    placeholder="修改项目编号、负责人、分管 VP、批准预算或战略目标时必填"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <Form
                  formData={selectedInstance.formData}
                  disabled={!canEditForm}
                  onSubmit={(event) => void submitAuditForm(event)}
                  schema={activeBlueprint.formSchema as RJSFSchema}
                  uiSchema={PROJECT_AUDIT_FORM_UI_SCHEMA}
                  validator={validator}
                >
                  <button className="primary-action" type="submit">保存审计表单</button>
                </Form>
                <div className="change-record-list">
                  <h3>审批记录</h3>
                  {selectedApprovalRecords.length ? (
                    selectedApprovalRecords.map((record) => (
                      <article key={record.id}>
                        <strong>{APPROVAL_RECORD_LABELS[record.roleId][record.decision]}</strong>
                        <span>{record.actor} · {formatActivityTime(record.decidedAt)}</span>
                        <p>{PROJECT_AUDIT_STATUS_LABELS[record.fromStatus]} → {PROJECT_AUDIT_STATUS_LABELS[record.toStatus]}</p>
                        {record.comment ? <p>{record.comment}</p> : null}
                      </article>
                    ))
                  ) : (
                    <p className="empty-state">提交、自审批或撤回后会显示审批记录。</p>
                  )}
                </div>
                <div className="change-record-list">
                  <h3>变更记录</h3>
                  {selectedChangeRecords.length ? (
                    selectedChangeRecords.map((record) => (
                      <article key={record.id}>
                        <strong>{record.fieldPath}</strong>
                        <span>{record.changedBy} · {formatActivityTime(record.changedAt)}</span>
                        <p>
                          {String(record.previousValue ?? '')} → {String(record.nextValue ?? '')}
                        </p>
                        {record.reason ? <p>{record.reason}</p> : null}
                      </article>
                    ))
                  ) : (
                    <p className="empty-state">保存修改后会显示字段级审计变更记录。</p>
                  )}
                </div>
              </>
            ) : (
              <p className="empty-state">选择一个审计实例后，会按绑定的 Blueprint 渲染动态表单。</p>
            )}
          </div>
        </div>
      ) : (
        <p className="empty-state">启动审计周期后，这里会显示自动生成的审计实例。</p>
      )}
    </section>
  )
}

function TextField({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: 'text' | 'number' | 'date'
}) {
  return (
    <label className="field">
      <span>{label}{required ? <strong>*</strong> : null}</span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
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
