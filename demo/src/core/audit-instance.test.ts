import { describe, expect, it } from 'vitest'
import { createDraftAuditCycle, startAuditCycle, updateAuditScope } from './audit-cycle'
import { deployBlueprint } from './blueprint-deployment'
import { generateProjectAuditBlueprint } from './project-audit-blueprint'
import { initializeProjectRegistry } from './project'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Project audit instances', () => {
  it('starts a draft cycle by creating one snapshot-backed audit instance per scoped project', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const generationResult = generateProjectAuditBlueprint(
      '生成项目审计流程，用于检查里程碑、战略目标和预算执行情况。',
    )

    if (generationResult.status !== 'generated') {
      throw new Error('Expected a generated project audit Blueprint.')
    }

    const blueprint = await deployBlueprint(generationResult.blueprint, storage)
    const projects = await initializeProjectRegistry(storage)
    const cycle = await createDraftAuditCycle(
      storage,
      {
        name: '2026 Q3 Project Audit',
        startDate: '2026-07-01',
        endDate: '2026-09-30',
      },
      {
        id: () => 'audit-cycle-q3-2026',
        now: () => new Date('2026-06-08T01:00:00.000Z'),
      },
    )
    await updateAuditScope(
      storage,
      cycle.id,
      [projects[0].id, projects[1].id],
      { now: () => new Date('2026-06-08T01:05:00.000Z') },
    )

    const result = await startAuditCycle(storage, cycle.id, {
      id: (projectId) => `audit-instance-${projectId}`,
      now: () => new Date('2026-06-08T01:10:00.000Z'),
    })

    expect(result.cycle.status).toBe('started')
    expect(result.instances).toHaveLength(2)
    expect(result.instances[0]).toMatchObject({
      id: 'audit-instance-project-data-platform',
      cycleId: cycle.id,
      projectId: projects[0].id,
      blueprintId: blueprint.id,
      blueprintVersion: 1,
      status: 'draft',
      createdAt: '2026-06-08T01:10:00.000Z',
      updatedAt: '2026-06-08T01:10:00.000Z',
    })
    expect(result.instances[0].projectSnapshot).toEqual({
      projectCode: projects[0].code,
      projectName: projects[0].name,
      projectOwner: projects[0].owner,
      supervisingVp: projects[0].supervisingVp,
      department: projects[0].department,
      plannedStartDate: projects[0].plannedStartDate,
      plannedEndDate: projects[0].plannedEndDate,
      strategicObjective: projects[0].strategicObjective,
      approvedBudget: projects[0].approvedBudget,
      currentCost: projects[0].currentCost,
      milestones: projects[0].milestones,
    })
    expect(result.instances[0].formData).toMatchObject({
      projectSnapshot: result.instances[0].projectSnapshot,
      executionPerformance: {
        approvedBudget: projects[0].approvedBudget,
        actualCost: projects[0].currentCost,
        estimatedCostAtCompletion: projects[0].currentCost,
      },
    })
    expect(result.instances[0].formData.milestoneAssessments).toEqual([
      {
        name: projects[0].milestones[0].name,
        plannedDate: projects[0].milestones[0].plannedCompletionDate,
        status: 'not_started',
        completionPercentage: 0,
        actualSituation: '',
      },
      {
        name: projects[0].milestones[1].name,
        plannedDate: projects[0].milestones[1].plannedCompletionDate,
        status: 'not_started',
        completionPercentage: 0,
        actualSituation: '',
      },
    ])

    await storage.saveProject({
      ...projects[0],
      name: 'Changed after cycle start',
      milestones: [],
    })

    const storedInstances = await storage.getProjectAuditInstances()
    expect(storedInstances[0].projectSnapshot.projectName).toBe(projects[0].name)
    expect(storedInstances[0].projectSnapshot.milestones).toHaveLength(2)
    await expect(storage.getAuditCycles()).resolves.toEqual([result.cycle])
  })

  it('rejects duplicate audit instances for the same project in the same cycle', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const generationResult = generateProjectAuditBlueprint('生成项目审计流程。')

    if (generationResult.status !== 'generated') {
      throw new Error('Expected a generated project audit Blueprint.')
    }

    await deployBlueprint(generationResult.blueprint, storage)
    const projects = await initializeProjectRegistry(storage)
    const cycle = await createDraftAuditCycle(storage, {
      name: '2026 Q3 Project Audit',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
    })
    await updateAuditScope(storage, cycle.id, [projects[0].id])
    const firstStart = await startAuditCycle(storage, cycle.id, {
      id: (projectId) => `audit-instance-${projectId}`,
    })
    await storage.saveAuditCycle({ ...firstStart.cycle, status: 'draft' })

    await expect(startAuditCycle(storage, cycle.id)).rejects.toThrow(
      `Project ${projects[0].id} already has an audit instance in cycle ${cycle.id}.`,
    )
    await expect(storage.getProjectAuditInstances()).resolves.toHaveLength(1)
  })
})
