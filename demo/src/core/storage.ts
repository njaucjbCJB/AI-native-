import type { AgentActivity } from './agent-activity'
import type { ArchiveRecord } from './archive'
import type { AuditCycle } from './audit-cycle'
import type { Blueprint } from './blueprint'
import type { ProjectAuditBlueprint } from './project-audit-blueprint'
import type { Project } from './project'
import type { ReportSnapshot } from './report'
import type { RequestInstance } from './request'
import type { WorkflowInstance } from './workflow'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const BLUEPRINTS_KEY = 'aiof.blueprints'
const ACTIVE_BLUEPRINT_KEY = 'aiof.activeBlueprintId'
const REQUEST_INSTANCES_KEY = 'aiof.requests'
const WORKFLOW_INSTANCES_KEY = 'aiof.workflows'
const ARCHIVE_RECORDS_KEY = 'aiof.archiveRecords'
const AGENT_ACTIVITIES_KEY = 'aiof.activities'
const REPORT_SNAPSHOTS_KEY = 'aiof.reportSnapshots'
const BLUEPRINT_VERSIONS_KEY = 'aiof.blueprintVersions'
const ACTIVE_BLUEPRINT_VERSION_KEY = 'aiof.activeBlueprintVersion'
const PROJECTS_KEY = 'aiof.projects'
const AUDIT_CYCLES_KEY = 'aiof.auditCycles'

export class MemoryStorage implements StorageLike {
  private items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

export class LocalStorageAdapter {
  private readonly storage: StorageLike

  constructor(storage: StorageLike = window.localStorage) {
    this.storage = storage
  }

  async getBlueprints(): Promise<Blueprint[]> {
    return this.readJson<Blueprint[]>(BLUEPRINTS_KEY, [])
  }

  async saveBlueprint(blueprint: Blueprint): Promise<void> {
    const blueprints = await this.getBlueprints()
    const nextBlueprints = [
      ...blueprints.filter((existing) => existing.id !== blueprint.id),
      blueprint,
    ]

    this.writeJson(BLUEPRINTS_KEY, nextBlueprints)
  }

  async getActiveBlueprint(): Promise<Blueprint | null> {
    const activeBlueprintId = this.storage.getItem(ACTIVE_BLUEPRINT_KEY)

    if (!activeBlueprintId) {
      return null
    }

    const blueprints = await this.getBlueprints()

    return blueprints.find((blueprint) => blueprint.id === activeBlueprintId) ?? null
  }

  async setActiveBlueprint(blueprintId: string): Promise<void> {
    this.storage.setItem(ACTIVE_BLUEPRINT_KEY, blueprintId)
  }

  async getBlueprintVersions(blueprintId?: string): Promise<ProjectAuditBlueprint[]> {
    const versions = this.readJson<ProjectAuditBlueprint[]>(BLUEPRINT_VERSIONS_KEY, [])

    return blueprintId
      ? versions.filter((blueprint) => blueprint.id === blueprintId)
      : versions
  }

  async saveBlueprintVersion(blueprint: ProjectAuditBlueprint): Promise<void> {
    if (blueprint.lifecycle !== 'deployed' || blueprint.version === null) {
      throw new Error('Only deployed Blueprint versions can be saved.')
    }

    const versions = await this.getBlueprintVersions()
    const versionExists = versions.some(
      (existing) =>
        existing.id === blueprint.id && existing.version === blueprint.version,
    )

    if (versionExists) {
      throw new Error(
        `Blueprint ${blueprint.id} version ${blueprint.version} is immutable.`,
      )
    }

    this.writeJson(BLUEPRINT_VERSIONS_KEY, [...versions, blueprint])
  }

  async setActiveBlueprintVersion(
    blueprintId: string,
    version: number,
  ): Promise<void> {
    this.writeJson(ACTIVE_BLUEPRINT_VERSION_KEY, { blueprintId, version })
  }

  async getActiveBlueprintVersion(): Promise<ProjectAuditBlueprint | null> {
    const activeVersion = this.readJson<{
      blueprintId: string
      version: number
    } | null>(ACTIVE_BLUEPRINT_VERSION_KEY, null)

    if (!activeVersion) {
      return null
    }

    const versions = await this.getBlueprintVersions(activeVersion.blueprintId)

    return (
      versions.find((blueprint) => blueprint.version === activeVersion.version) ?? null
    )
  }

  async getRequestInstances(): Promise<RequestInstance[]> {
    return this.readJson<RequestInstance[]>(REQUEST_INSTANCES_KEY, [])
  }

  async saveRequestInstance(request: RequestInstance): Promise<void> {
    const requests = await this.getRequestInstances()
    const nextRequests = [
      ...requests.filter((existing) => existing.id !== request.id),
      request,
    ]

    this.writeJson(REQUEST_INSTANCES_KEY, nextRequests)
  }

  async getWorkflowInstances(): Promise<WorkflowInstance[]> {
    return this.readJson<WorkflowInstance[]>(WORKFLOW_INSTANCES_KEY, [])
  }

  async saveWorkflowInstance(workflow: WorkflowInstance): Promise<void> {
    const workflows = await this.getWorkflowInstances()
    const nextWorkflows = [
      ...workflows.filter((existing) => existing.requestId !== workflow.requestId),
      workflow,
    ]

    this.writeJson(WORKFLOW_INSTANCES_KEY, nextWorkflows)
  }

  async getArchiveRecords(): Promise<ArchiveRecord[]> {
    return this.readJson<ArchiveRecord[]>(ARCHIVE_RECORDS_KEY, [])
  }

  async saveArchiveRecord(archiveRecord: ArchiveRecord): Promise<void> {
    const archiveRecords = await this.getArchiveRecords()
    const nextArchiveRecords = [
      ...archiveRecords.filter((existing) => existing.id !== archiveRecord.id),
      archiveRecord,
    ]

    this.writeJson(ARCHIVE_RECORDS_KEY, nextArchiveRecords)
  }

  async getAgentActivities(): Promise<AgentActivity[]> {
    return this.readJson<AgentActivity[]>(AGENT_ACTIVITIES_KEY, [])
  }

  async saveAgentActivity(activity: AgentActivity): Promise<void> {
    const activities = await this.getAgentActivities()
    const nextActivities = [
      ...activities.filter((existing) => existing.id !== activity.id),
      activity,
    ]

    this.writeJson(AGENT_ACTIVITIES_KEY, nextActivities)
  }

  async getReportSnapshots(): Promise<ReportSnapshot[]> {
    return this.readJson<ReportSnapshot[]>(REPORT_SNAPSHOTS_KEY, [])
  }

  async saveReportSnapshot(report: ReportSnapshot): Promise<void> {
    const reports = await this.getReportSnapshots()
    const nextReports = [
      ...reports.filter((existing) => existing.id !== report.id),
      report,
    ]

    this.writeJson(REPORT_SNAPSHOTS_KEY, nextReports)
  }

  async getProjects(): Promise<Project[]> {
    return this.readJson<Project[]>(PROJECTS_KEY, [])
  }

  async saveProject(project: Project): Promise<void> {
    const projects = await this.getProjects()
    const nextProjects = [
      ...projects.filter((existing) => existing.id !== project.id),
      project,
    ]

    this.writeJson(PROJECTS_KEY, nextProjects)
  }

  async getAuditCycles(): Promise<AuditCycle[]> {
    return this.readJson<AuditCycle[]>(AUDIT_CYCLES_KEY, [])
  }

  async saveAuditCycle(cycle: AuditCycle): Promise<void> {
    const cycles = await this.getAuditCycles()
    const nextCycles = [
      ...cycles.filter((existing) => existing.id !== cycle.id),
      cycle,
    ]

    this.writeJson(AUDIT_CYCLES_KEY, nextCycles)
  }

  async resetDemoData(): Promise<void> {
    this.storage.removeItem(BLUEPRINTS_KEY)
    this.storage.removeItem(ACTIVE_BLUEPRINT_KEY)
    this.storage.removeItem(REQUEST_INSTANCES_KEY)
    this.storage.removeItem(WORKFLOW_INSTANCES_KEY)
    this.storage.removeItem(ARCHIVE_RECORDS_KEY)
    this.storage.removeItem(AGENT_ACTIVITIES_KEY)
    this.storage.removeItem(REPORT_SNAPSHOTS_KEY)
    this.storage.removeItem(BLUEPRINT_VERSIONS_KEY)
    this.storage.removeItem(ACTIVE_BLUEPRINT_VERSION_KEY)
    this.storage.removeItem(PROJECTS_KEY)
    this.storage.removeItem(AUDIT_CYCLES_KEY)
  }

  private readJson<T>(key: string, fallback: T): T {
    const value = this.storage.getItem(key)

    if (!value) {
      return fallback
    }

    return JSON.parse(value) as T
  }

  private writeJson<T>(key: string, value: T): void {
    this.storage.setItem(key, JSON.stringify(value))
  }
}
