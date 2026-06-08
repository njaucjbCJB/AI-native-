import { describe, expect, it } from 'vitest'
import { createDraftAuditCycle, startAuditCycle, updateAuditScope } from './audit-cycle'
import {
  approveAiCeoProjectAuditInstance,
  approveProjectOwnerSelfApproval,
  approveVpProjectAuditInstance,
  rejectAiCeoProjectAuditInstance,
  submitProjectAuditInstance,
} from './audit-workflow'
import {
  createAiCeoAssessment,
  generateAiCeoAssessment,
} from './ai-ceo-assessment'
import { deployBlueprint } from './blueprint-deployment'
import { generateProjectAuditBlueprint } from './project-audit-blueprint'
import { initializeProjectRegistry } from './project'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('AI CEO assessment and final approval', () => {
  it('generates a deterministic recommendation and lets AI CEO approve or reject final review', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const instance = await createAiCeoFixture(storage)
    const riskyFormData = {
      ...instance.formData,
      milestoneAssessments: [
        {
          ...instance.formData.milestoneAssessments[0],
          status: 'delayed' as const,
          completionPercentage: 25,
        },
      ],
      strategicObjectiveAssessments: [
        {
          ...instance.formData.strategicObjectiveAssessments[0],
          completionPercentage: 35,
        },
      ],
      executionPerformance: {
        ...instance.formData.executionPerformance,
        actualCost: 2_250_000,
        estimatedCostAtCompletion: 2_600_000,
        budgetVariance: 600_000,
      },
      risksAndIssues: 'Data quality issues block executive reporting.',
    }
    await storage.saveProjectAuditInstance({ ...instance, formData: riskyFormData })

    const assessment = await createAiCeoAssessment(storage, instance.id, {
      id: () => 'ai-ceo-assessment-1',
      now: () => new Date('2026-06-08T06:00:00.000Z'),
    })
    const directAssessment = generateAiCeoAssessment(
      { ...instance, formData: riskyFormData, status: 'ai_ceo_approval' },
      [],
      await storage.getApprovalRecords(instance.id),
    )

    expect(assessment).toEqual({
      ...directAssessment,
      id: 'ai-ceo-assessment-1',
      instanceId: instance.id,
      generatedAt: '2026-06-08T06:00:00.000Z',
    })
    expect(assessment.riskLevel).toBe('high')
    expect(assessment.keyFindings).toContain('存在延期里程碑')
    await expect(storage.getAiCeoAssessments(instance.id)).resolves.toEqual([
      assessment,
    ])

    const approved = await approveAiCeoProjectAuditInstance(storage, instance.id, {
      actor: 'AI CEO',
      id: () => 'approval-ai-ceo-1',
      now: () => new Date('2026-06-08T06:05:00.000Z'),
    })
    expect(approved.status).toBe('approved')

    const rejectedFixture = await createAiCeoFixture(storage, 'audit-instance-ai-reject')
    await expect(
      rejectAiCeoProjectAuditInstance(storage, rejectedFixture.id, {
        actor: 'AI CEO',
      }),
    ).rejects.toThrow('An AI CEO rejection comment is required.')

    const rejected = await rejectAiCeoProjectAuditInstance(storage, rejectedFixture.id, {
      actor: 'AI CEO',
      comment: 'Strategic progress is too weak for final approval.',
      id: () => 'reject-ai-ceo-1',
      now: () => new Date('2026-06-08T06:10:00.000Z'),
    })
    expect(rejected.status).toBe('rework')
  })
})

async function createAiCeoFixture(
  storage: LocalStorageAdapter,
  instanceId = 'audit-instance-ai-ceo',
) {
  const generationResult = generateProjectAuditBlueprint('生成项目审计流程。')

  if (generationResult.status !== 'generated') {
    throw new Error('Expected a generated project audit Blueprint.')
  }

  await deployBlueprint(generationResult.blueprint, storage)
  const projects = await initializeProjectRegistry(storage)
  const cycle = await createDraftAuditCycle(storage, {
    name: `2026 Q3 Project Audit ${instanceId}`,
    startDate: '2026-07-01',
    endDate: '2026-09-30',
  })
  await updateAuditScope(storage, cycle.id, [projects[0].id])
  const result = await startAuditCycle(storage, cycle.id, {
    id: () => instanceId,
  })
  const instance = result.instances[0]
  await submitProjectAuditInstance(storage, instance.id, {
    actor: instance.projectSnapshot.projectOwner,
  })
  await approveProjectOwnerSelfApproval(storage, instance.id, {
    actor: instance.projectSnapshot.projectOwner,
  })
  await approveVpProjectAuditInstance(storage, instance.id, {
    actor: instance.projectSnapshot.supervisingVp,
  })

  return (await storage.getProjectAuditInstances()).find(
    (candidate) => candidate.id === instance.id,
  )!
}
