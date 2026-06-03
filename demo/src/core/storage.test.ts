import { describe, expect, it } from 'vitest'
import type { AgentActivity } from './agent-activity'
import type { ArchiveRecord } from './archive'
import { generateBlueprintFromRequirement } from './blueprint'
import type { ReportSnapshot } from './report'
import { LocalStorageAdapter, MemoryStorage } from './storage'
import type { WorkflowInstance } from './workflow'

describe('Storage adapter', () => {
  it('stores blueprints and marks one blueprint as active', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const blueprint = generateBlueprintFromRequirement('I need a procurement approval workflow.')

    await storage.saveBlueprint(blueprint)
    await storage.setActiveBlueprint(blueprint.id)

    await expect(storage.getBlueprints()).resolves.toEqual([blueprint])
    await expect(storage.getActiveBlueprint()).resolves.toEqual(blueprint)
  })

  it('stores workflow instances with approval history', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const workflow: WorkflowInstance = {
      requestId: 'request-1',
      status: 'in_review',
      approvalPath: [
        {
          id: 'department-manager-approval',
          role: 'department_manager',
          name: 'Department Manager Approval',
        },
      ],
      currentStepIndex: 0,
      currentStep: {
        id: 'department-manager-approval',
        role: 'department_manager',
        name: 'Department Manager Approval',
      },
      approvalRecords: [],
      archivedAt: null,
      updatedAt: '2026-06-03T12:00:00.000Z',
    }

    await storage.saveWorkflowInstance(workflow)

    await expect(storage.getWorkflowInstances()).resolves.toEqual([workflow])
  })

  it('stores archive records', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const archiveRecord: ArchiveRecord = {
      id: 'archive-1',
      requestId: 'request-1',
      finalStatus: 'approved',
      archivedAt: '2026-06-03T13:00:00.000Z',
    }

    await storage.saveArchiveRecord(archiveRecord)

    await expect(storage.getArchiveRecords()).resolves.toEqual([archiveRecord])
  })

  it('stores agent activity records', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const activity: AgentActivity = {
      id: 'activity-1',
      skillName: 'RiskAnalysisSkill',
      inputSummary: 'request-1',
      outputSummary: 'medium risk',
      status: 'success',
      createdAt: '2026-06-03T13:00:00.000Z',
    }

    await storage.saveAgentActivity(activity)

    await expect(storage.getAgentActivities()).resolves.toEqual([activity])
  })

  it('stores report snapshots', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const report: ReportSnapshot = {
      id: 'report-1',
      totalAmount: 13200,
      requestCountByStatus: {
        submitted: 1,
        approved: 1,
        rejected: 0,
      },
      highRiskRequestCount: 1,
      averageApprovalCycleTimeHours: 2,
      summary: 'Procurement activity is within the expected demo range.',
      generatedAt: '2026-06-03T14:00:00.000Z',
    }

    await storage.saveReportSnapshot(report)

    await expect(storage.getReportSnapshots()).resolves.toEqual([report])
  })

  it('resets all demo runtime data', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())

    await storage.saveWorkflowInstance({
      requestId: 'request-1',
      status: 'approved',
      approvalPath: [],
      currentStepIndex: 0,
      currentStep: null,
      approvalRecords: [],
      archivedAt: '2026-06-03T13:00:00.000Z',
      updatedAt: '2026-06-03T13:00:00.000Z',
    })
    await storage.saveArchiveRecord({
      id: 'archive-1',
      requestId: 'request-1',
      finalStatus: 'approved',
      archivedAt: '2026-06-03T13:00:00.000Z',
    })
    await storage.saveAgentActivity({
      id: 'activity-1',
      skillName: 'WorkflowExecutionSkill',
      inputSummary: 'request-1',
      outputSummary: 'approved',
      status: 'success',
      createdAt: '2026-06-03T13:00:00.000Z',
    })
    await storage.saveReportSnapshot({
      id: 'report-1',
      totalAmount: 13200,
      requestCountByStatus: { approved: 1 },
      highRiskRequestCount: 1,
      averageApprovalCycleTimeHours: 2,
      summary: 'Demo report.',
      generatedAt: '2026-06-03T14:00:00.000Z',
    })

    await storage.resetDemoData()

    await expect(storage.getWorkflowInstances()).resolves.toEqual([])
    await expect(storage.getArchiveRecords()).resolves.toEqual([])
    await expect(storage.getAgentActivities()).resolves.toEqual([])
    await expect(storage.getReportSnapshots()).resolves.toEqual([])
  })
})
