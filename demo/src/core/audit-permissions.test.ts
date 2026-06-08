import { describe, expect, it } from 'vitest'
import type { ProjectAuditInstance } from './audit-cycle'
import {
  getFieldAccess,
  getVisibleProjectAuditInstances,
  type ProjectAuditActor,
} from './audit-permissions'
import { deployBlueprint } from './blueprint-deployment'
import { createDraftAuditCycle, startAuditCycle, updateAuditScope } from './audit-cycle'
import { generateProjectAuditBlueprint } from './project-audit-blueprint'
import { initializeProjectRegistry } from './project'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Project audit permissions', () => {
  it('filters visible instances and calculates field access from the bound Blueprint', async () => {
    const { blueprint, instances } = await createPermissionFixture()
    const [aliceInstance, brianInstance, aiCeoInstance] = instances

    const owner: ProjectAuditActor = {
      roleId: 'project_owner',
      name: aliceInstance.projectSnapshot.projectOwner,
    }
    const supervisingVp: ProjectAuditActor = {
      roleId: 'supervising_vp',
      name: brianInstance.projectSnapshot.supervisingVp,
    }
    const aiCeo: ProjectAuditActor = { roleId: 'ai_ceo', name: 'AI CEO' }
    const globalViewer: ProjectAuditActor = {
      roleId: 'global_viewer',
      name: 'Observer',
    }
    const auditAdministrator: ProjectAuditActor = {
      roleId: 'audit_administrator',
      name: 'Audit Admin',
    }

    expect(
      getVisibleProjectAuditInstances(blueprint, instances, owner).map(
        (instance) => instance.projectId,
      ),
    ).toEqual([aliceInstance.projectId])
    expect(
      getVisibleProjectAuditInstances(blueprint, instances, supervisingVp).map(
        (instance) => instance.projectId,
      ),
    ).toEqual([brianInstance.projectId])
    expect(
      getVisibleProjectAuditInstances(blueprint, instances, aiCeo).map(
        (instance) => instance.projectId,
      ),
    ).toEqual([aiCeoInstance.projectId])
    expect(getVisibleProjectAuditInstances(blueprint, instances, globalViewer)).toEqual(
      instances,
    )
    expect(
      getVisibleProjectAuditInstances(blueprint, instances, auditAdministrator),
    ).toEqual(instances)

    expect(getFieldAccess(blueprint, aliceInstance, owner, 'ownerSummary')).toBe(
      'edit',
    )
    expect(
      getFieldAccess(blueprint, brianInstance, supervisingVp, 'ownerSummary'),
    ).toBe('read')
    expect(getFieldAccess(blueprint, aiCeoInstance, aiCeo, 'ownerSummary')).toBe(
      'read',
    )
    expect(getFieldAccess(blueprint, aliceInstance, aiCeo, 'ownerSummary')).toBe(
      'hidden',
    )
    expect(
      getFieldAccess(blueprint, aliceInstance, globalViewer, 'ownerSummary'),
    ).toBe('read')
  })
})

async function createPermissionFixture() {
  const storage = new LocalStorageAdapter(new MemoryStorage())
  const generationResult = generateProjectAuditBlueprint('生成项目审计流程。')

  if (generationResult.status !== 'generated') {
    throw new Error('Expected a generated project audit Blueprint.')
  }

  const blueprint = await deployBlueprint(generationResult.blueprint, storage)
  const projects = await initializeProjectRegistry(storage)
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
  const result = await startAuditCycle(storage, cycle.id, {
    id: (projectId) => `audit-instance-${projectId}`,
  })
  const instances: ProjectAuditInstance[] = [
    result.instances[0],
    {
      ...result.instances[1],
      status: 'vp_approval',
    },
    {
      ...result.instances[2],
      status: 'ai_ceo_approval',
    },
  ]

  return { blueprint, instances }
}
