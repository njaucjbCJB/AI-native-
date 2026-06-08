import { describe, expect, it } from 'vitest'
import {
  addProjectsToStartedAuditCycle,
  closeAuditCycle,
  createDraftAuditCycle,
  removeProjectsFromStartedAuditCycle,
  startAuditCycle,
  updateAuditScope,
} from './audit-cycle'
import { deployBlueprint } from './blueprint-deployment'
import { generateProjectAuditBlueprint } from './project-audit-blueprint'
import { initializeProjectRegistry } from './project'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Audit cycle', () => {
  it('creates and stores a draft audit cycle', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())

    const cycle = await createDraftAuditCycle(
      storage,
      {
        name: '2026 Q3 Project Audit',
        startDate: '2026-07-01',
        endDate: '2026-09-30',
      },
      {
        id: () => 'audit-cycle-q3-2026',
        now: () => new Date('2026-06-07T03:30:00.000Z'),
      },
    )

    expect(cycle).toEqual({
      id: 'audit-cycle-q3-2026',
      name: '2026 Q3 Project Audit',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      status: 'draft',
      projectIds: [],
      createdAt: '2026-06-07T03:30:00.000Z',
      updatedAt: '2026-06-07T03:30:00.000Z',
    })
    await expect(storage.getAuditCycles()).resolves.toEqual([cycle])
  })

  it('updates a draft cycle with multiple projects in its audit scope', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const cycle = await createDraftAuditCycle(
      storage,
      {
        name: '2026 Q3 Project Audit',
        startDate: '2026-07-01',
        endDate: '2026-09-30',
      },
      {
        id: () => 'audit-cycle-q3-2026',
        now: () => new Date('2026-06-07T03:30:00.000Z'),
      },
    )

    const updatedCycle = await updateAuditScope(
      storage,
      cycle.id,
      ['project-data-platform', 'project-customer-portal'],
      {
        now: () => new Date('2026-06-07T04:00:00.000Z'),
      },
    )

    expect(updatedCycle.projectIds).toEqual([
      'project-data-platform',
      'project-customer-portal',
    ])
    expect(updatedCycle.updatedAt).toBe('2026-06-07T04:00:00.000Z')
    await expect(storage.getAuditCycles()).resolves.toEqual([updatedCycle])
  })

  it('adds new projects to a started cycle and creates bound audit instances with project snapshots', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const generationResult = generateProjectAuditBlueprint(
      '生成一个项目审计流程，用于检查里程碑、战略目标和预算执行情况。',
    )

    if (generationResult.status !== 'generated') {
      throw new Error('Expected a generated project audit Blueprint.')
    }

    await deployBlueprint(generationResult.blueprint, storage)
    await initializeProjectRegistry(storage)
    const cycle = await createDraftAuditCycle(
      storage,
      {
        name: '2026 Q3 Project Audit',
        startDate: '2026-07-01',
        endDate: '2026-09-30',
      },
      {
        id: () => 'audit-cycle-q3-2026',
        now: () => new Date('2026-06-07T03:30:00.000Z'),
      },
    )
    await updateAuditScope(storage, cycle.id, ['project-data-platform'])
    await startAuditCycle(storage, cycle.id, {
      id: (projectId) => `instance-${projectId}`,
      now: () => new Date('2026-06-07T04:00:00.000Z'),
    })

    const result = await addProjectsToStartedAuditCycle(
      storage,
      cycle.id,
      ['project-customer-portal', 'project-supply-chain'],
      {
        id: (projectId) => `late-instance-${projectId}`,
        now: () => new Date('2026-06-07T05:00:00.000Z'),
      },
    )

    expect(result.cycle.projectIds).toEqual([
      'project-data-platform',
      'project-customer-portal',
      'project-supply-chain',
    ])
    expect(result.instances.map((instance) => instance.id)).toEqual([
      'late-instance-project-customer-portal',
      'late-instance-project-supply-chain',
    ])
    expect(result.instances[0]).toEqual(
      expect.objectContaining({
        cycleId: cycle.id,
        projectId: 'project-customer-portal',
        blueprintId: 'project-audit',
        blueprintVersion: 1,
        status: 'draft',
        createdAt: '2026-06-07T05:00:00.000Z',
        updatedAt: '2026-06-07T05:00:00.000Z',
      }),
    )
    expect(result.instances[0].projectSnapshot.projectName).toBe(
      'Customer Service Portal',
    )
    await expect(storage.getProjectAuditInstances()).resolves.toHaveLength(3)
  })

  it('prevents removing a project after its audit instance has started being filled', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const generationResult = generateProjectAuditBlueprint(
      '生成一个项目审计流程，用于检查里程碑、战略目标和预算执行情况。',
    )

    if (generationResult.status !== 'generated') {
      throw new Error('Expected a generated project audit Blueprint.')
    }

    await deployBlueprint(generationResult.blueprint, storage)
    await initializeProjectRegistry(storage)
    const cycle = await createDraftAuditCycle(storage, {
      name: '2026 Q3 Project Audit',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
    })
    await updateAuditScope(storage, cycle.id, [
      'project-data-platform',
      'project-customer-portal',
    ])
    const started = await startAuditCycle(storage, cycle.id, {
      id: (projectId) => `instance-${projectId}`,
    })
    await storage.saveProjectAuditInstance({
      ...started.instances[0],
      status: 'owner_self_approval',
    })

    await expect(
      removeProjectsFromStartedAuditCycle(
        storage,
        cycle.id,
        ['project-data-platform'],
      ),
    ).rejects.toThrow('Projects with started audit instances cannot be removed.')

    const result = await removeProjectsFromStartedAuditCycle(
      storage,
      cycle.id,
      ['project-customer-portal'],
    )

    expect(result.projectIds).toEqual(['project-data-platform'])
  })

  it('closes a started cycle and rejects later project additions', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const generationResult = generateProjectAuditBlueprint(
      '生成一个项目审计流程，用于检查里程碑、战略目标和预算执行情况。',
    )

    if (generationResult.status !== 'generated') {
      throw new Error('Expected a generated project audit Blueprint.')
    }

    await deployBlueprint(generationResult.blueprint, storage)
    await initializeProjectRegistry(storage)
    const cycle = await createDraftAuditCycle(storage, {
      name: '2026 Q3 Project Audit',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
    })
    await updateAuditScope(storage, cycle.id, ['project-data-platform'])
    await startAuditCycle(storage, cycle.id)

    const closed = await closeAuditCycle(storage, cycle.id, {
      now: () => new Date('2026-06-07T06:00:00.000Z'),
    })

    expect(closed.status).toBe('closed')
    expect(closed.updatedAt).toBe('2026-06-07T06:00:00.000Z')
    await expect(
      addProjectsToStartedAuditCycle(storage, cycle.id, ['project-customer-portal']),
    ).rejects.toThrow('Projects can only be added to a started audit cycle.')
  })
})
