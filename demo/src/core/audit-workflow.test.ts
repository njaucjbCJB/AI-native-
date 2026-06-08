import { describe, expect, it } from 'vitest'
import { createDraftAuditCycle, startAuditCycle, updateAuditScope } from './audit-cycle'
import {
  approveAiCeoProjectAuditInstance,
  approveProjectOwnerSelfApproval,
  approveVpProjectAuditInstance,
  rejectVpProjectAuditInstance,
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

  it('lets the supervising VP approve or reject with a required comment and forces rework through owner self-approval', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const instance = await createWorkflowFixture(storage)
    const owner = instance.projectSnapshot.projectOwner
    const vp = instance.projectSnapshot.supervisingVp
    await submitProjectAuditInstance(storage, instance.id, { actor: owner })
    await approveProjectOwnerSelfApproval(storage, instance.id, { actor: owner })

    const vpApproved = await approveVpProjectAuditInstance(storage, instance.id, {
      actor: vp,
      id: () => 'approval-vp-1',
      now: () => new Date('2026-06-08T05:00:00.000Z'),
    })

    expect(vpApproved.status).toBe('ai_ceo_approval')
    await expect(storage.getApprovalRecords(instance.id)).resolves.toContainEqual({
      id: 'approval-vp-1',
      instanceId: instance.id,
      actor: vp,
      roleId: 'supervising_vp',
      decision: 'approved',
      decidedAt: '2026-06-08T05:00:00.000Z',
      fromStatus: 'vp_approval',
      toStatus: 'ai_ceo_approval',
    })

    await approveAiCeoProjectAuditInstance(storage, instance.id, {
      actor: 'AI CEO',
    })
    const reworkFixture = await createWorkflowFixture(storage, 'audit-instance-rework')
    await submitProjectAuditInstance(storage, reworkFixture.id, { actor: owner })
    await approveProjectOwnerSelfApproval(storage, reworkFixture.id, { actor: owner })

    await expect(
      rejectVpProjectAuditInstance(storage, reworkFixture.id, {
        actor: vp,
      }),
    ).rejects.toThrow('A VP rejection comment is required.')

    const rejected = await rejectVpProjectAuditInstance(storage, reworkFixture.id, {
      actor: vp,
      comment: 'Budget evidence needs clarification.',
      id: () => 'reject-vp-1',
      now: () => new Date('2026-06-08T05:10:00.000Z'),
    })

    expect(rejected.status).toBe('rework')

    const resubmitted = await submitProjectAuditInstance(storage, reworkFixture.id, {
      actor: owner,
    })
    expect(resubmitted.status).toBe('owner_self_approval')

    const reapproved = await approveProjectOwnerSelfApproval(
      storage,
      reworkFixture.id,
      { actor: owner },
    )
    expect(reapproved.status).toBe('vp_approval')
  })
})

async function createWorkflowFixture(
  storage: LocalStorageAdapter,
  instanceId = 'audit-instance-project-data-platform',
) {
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
    id: () => instanceId,
  })

  return result.instances[0]
}
