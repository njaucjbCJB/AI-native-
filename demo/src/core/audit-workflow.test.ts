import { describe, expect, it } from 'vitest'
import { createDraftAuditCycle, startAuditCycle, updateAuditScope } from './audit-cycle'
import {
  approveProjectOwnerSelfApproval,
  submitProjectAuditInstance,
  withdrawProjectAuditInstance,
} from './audit-workflow'
import { deployBlueprint } from './blueprint-deployment'
import { generateProjectAuditBlueprint } from './project-audit-blueprint'
import { initializeProjectRegistry } from './project'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Project owner audit workflow', () => {
  it('submits, self-approves, records the decision, and allows withdrawal before VP decision', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const instance = await createWorkflowFixture(storage)
    const owner = instance.projectSnapshot.projectOwner

    const submitted = await submitProjectAuditInstance(storage, instance.id, {
      actor: owner,
      now: () => new Date('2026-06-08T04:00:00.000Z'),
    })

    expect(submitted.status).toBe('owner_self_approval')

    const approved = await approveProjectOwnerSelfApproval(storage, instance.id, {
      actor: owner,
      comment: 'I confirm this audit submission is accurate.',
      id: () => 'approval-owner-1',
      now: () => new Date('2026-06-08T04:05:00.000Z'),
    })

    expect(approved.status).toBe('vp_approval')
    await expect(storage.getApprovalRecords(instance.id)).resolves.toEqual([
      {
        id: 'approval-owner-1',
        instanceId: instance.id,
        actor: owner,
        roleId: 'project_owner',
        decision: 'approved',
        comment: 'I confirm this audit submission is accurate.',
        decidedAt: '2026-06-08T04:05:00.000Z',
        fromStatus: 'owner_self_approval',
        toStatus: 'vp_approval',
      },
    ])

    const withdrawn = await withdrawProjectAuditInstance(storage, instance.id, {
      actor: owner,
      comment: 'Need to correct a cost note before VP review.',
      id: () => 'withdraw-owner-1',
      now: () => new Date('2026-06-08T04:10:00.000Z'),
    })

    expect(withdrawn.status).toBe('draft')
    await expect(storage.getApprovalRecords(instance.id)).resolves.toHaveLength(2)
  })

  it('rejects withdrawal when the actor is not the project owner', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const instance = await createWorkflowFixture(storage)
    await submitProjectAuditInstance(storage, instance.id, {
      actor: instance.projectSnapshot.projectOwner,
    })

    await expect(
      withdrawProjectAuditInstance(storage, instance.id, {
        actor: instance.projectSnapshot.supervisingVp,
      }),
    ).rejects.toThrow('Only the project owner can withdraw this audit instance.')
  })
})

async function createWorkflowFixture(storage: LocalStorageAdapter) {
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
  const result = await startAuditCycle(storage, cycle.id, {
    id: (projectId) => `audit-instance-${projectId}`,
  })

  return result.instances[0]
}
