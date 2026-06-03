import type { AgentActivity } from './agent-activity'
import type { ArchiveRecord } from './archive'
import type { Blueprint } from './blueprint'
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

  async resetDemoData(): Promise<void> {
    this.storage.removeItem(BLUEPRINTS_KEY)
    this.storage.removeItem(ACTIVE_BLUEPRINT_KEY)
    this.storage.removeItem(REQUEST_INSTANCES_KEY)
    this.storage.removeItem(WORKFLOW_INSTANCES_KEY)
    this.storage.removeItem(ARCHIVE_RECORDS_KEY)
    this.storage.removeItem(AGENT_ACTIVITIES_KEY)
    this.storage.removeItem(REPORT_SNAPSHOTS_KEY)
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
