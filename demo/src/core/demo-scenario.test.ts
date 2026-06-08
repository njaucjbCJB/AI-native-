import { describe, expect, it } from 'vitest'
import { createAiCeoAssessment } from './ai-ceo-assessment'
import { createDraftAuditCycle, startAuditCycle, updateAuditScope } from './audit-cycle'
import {
  approveAiCeoProjectAuditInstance,
  approveProjectOwnerSelfApproval,
  approveVpProjectAuditInstance,
  rejectVpProjectAuditInstance,
  submitProjectAuditInstance,
} from './audit-workflow'
import { initializeProjectRegistry } from './project'
import { initializeProjectAuditDemo, resetProjectAuditDemoData } from './demo-scenario'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Project audit demo scenario', () => {
  it('resets persisted data and restores a demonstrable initial project audit setup', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    await resetProjectAuditDemoData(storage)
    const projects = await initializeProjectRegistry(storage)
    const cycle = await createDraftAuditCycle(storage, {
      name: 'Temporary cycle',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
    })
    await updateAuditScope(storage, cycle.id, [projects[0].id])
    const started = await startAuditCycle(storage, cycle.id)
    const instance = started.instances[0]
    await submitProjectAuditInstance(storage, instance.id, {
      actor: instance.projectSnapshot.projectOwner,
    })
    await approveProjectOwnerSelfApproval(storage, instance.id, {
      actor: instance.projectSnapshot.projectOwner,
    })
    await approveVpProjectAuditInstance(storage, instance.id, {
      actor: instance.projectSnapshot.supervisingVp,
    })
    await createAiCeoAssessment(storage, instance.id)

    await resetProjectAuditDemoData(storage)

    await expect(storage.getActiveBlueprintVersion()).resolves.toEqual(
      expect.objectContaining({
        id: 'project-audit',
        lifecycle: 'deployed',
        version: 1,
      }),
    )
    await expect(storage.getProjects()).resolves.toHaveLength(3)
    await expect(storage.getAuditCycles()).resolves.toEqual([])
    await expect(storage.getProjectAuditInstances()).resolves.toEqual([])
    await expect(storage.getApprovalRecords()).resolves.toEqual([])
    await expect(storage.getAiCeoAssessments()).resolves.toEqual([])
  })

  it('keeps the project audit Blueprint version stable when the app initializes again', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())

    await initializeProjectAuditDemo(storage)
    await initializeProjectAuditDemo(storage)

    await expect(storage.getBlueprintVersions('project-audit')).resolves.toHaveLength(1)
    await expect(storage.getActiveBlueprintVersion()).resolves.toEqual(
      expect.objectContaining({ id: 'project-audit', version: 1 }),
    )
  })

  it('runs a complete approval path and a VP rejection rework path from the seeded demo data', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    await resetProjectAuditDemoData(storage)
    const projects = await storage.getProjects()
    const cycle = await createDraftAuditCycle(storage, {
      name: '2026 Q3 Project Audit',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
    })
    await updateAuditScope(
      storage,
      cycle.id,
      projects.map((project) => project.id),
    )
    const started = await startAuditCycle(storage, cycle.id, {
      id: (projectId) => `audit-instance-${projectId}`,
    })
    const [mainPathInstance, reworkInstance] = started.instances

    await submitProjectAuditInstance(storage, mainPathInstance.id, {
      actor: mainPathInstance.projectSnapshot.projectOwner,
    })
    await approveProjectOwnerSelfApproval(storage, mainPathInstance.id, {
      actor: mainPathInstance.projectSnapshot.projectOwner,
    })
    await approveVpProjectAuditInstance(storage, mainPathInstance.id, {
      actor: mainPathInstance.projectSnapshot.supervisingVp,
    })
    await createAiCeoAssessment(storage, mainPathInstance.id)
    const mainApproved = await approveAiCeoProjectAuditInstance(
      storage,
      mainPathInstance.id,
      { actor: 'AI CEO' },
    )

    expect(mainApproved.status).toBe('approved')

    await submitProjectAuditInstance(storage, reworkInstance.id, {
      actor: reworkInstance.projectSnapshot.projectOwner,
    })
    await approveProjectOwnerSelfApproval(storage, reworkInstance.id, {
      actor: reworkInstance.projectSnapshot.projectOwner,
    })
    const rejected = await rejectVpProjectAuditInstance(storage, reworkInstance.id, {
      actor: reworkInstance.projectSnapshot.supervisingVp,
      comment: '预算执行说明需要补充。',
    })

    expect(rejected.status).toBe('rework')

    await submitProjectAuditInstance(storage, reworkInstance.id, {
      actor: reworkInstance.projectSnapshot.projectOwner,
    })
    await approveProjectOwnerSelfApproval(storage, reworkInstance.id, {
      actor: reworkInstance.projectSnapshot.projectOwner,
    })
    await approveVpProjectAuditInstance(storage, reworkInstance.id, {
      actor: reworkInstance.projectSnapshot.supervisingVp,
    })
    await createAiCeoAssessment(storage, reworkInstance.id)
    const reworkApproved = await approveAiCeoProjectAuditInstance(
      storage,
      reworkInstance.id,
      { actor: 'AI CEO' },
    )

    expect(reworkApproved.status).toBe('approved')
    await expect(storage.getApprovalRecords()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: reworkInstance.id, decision: 'rejected' }),
        expect.objectContaining({ instanceId: reworkInstance.id, roleId: 'ai_ceo' }),
      ]),
    )
  })
})
