import { describe, expect, it } from 'vitest'
import { createDraftAuditCycle, startAuditCycle, updateAuditScope } from './audit-cycle'
import { saveProjectAuditForm } from './audit-form'
import { deployBlueprint } from './blueprint-deployment'
import { generateProjectAuditBlueprint } from './project-audit-blueprint'
import { initializeProjectRegistry } from './project'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Project audit form', () => {
  it('validates and persists Blueprint-driven form data with repeatable groups', async () => {
    const memory = new MemoryStorage()
    const storage = new LocalStorageAdapter(memory)
    const instance = await createStartedAuditInstance(storage)
    const nextFormData = {
      ...instance.formData,
      milestoneAssessments: [
        {
          name: 'Data governance foundation',
          plannedDate: '2026-06-30',
          status: 'completed' as const,
          completionPercentage: 100,
          actualSituation: 'Foundation shipped with stewardship roles.',
        },
        {
          name: 'Executive dashboard pilot',
          plannedDate: '2026-08-15',
          status: 'in_progress' as const,
          completionPercentage: 55,
          actualSituation: 'Pilot dashboard is in UAT.',
        },
      ],
      strategicObjectiveAssessments: [
        {
          objective: 'Create a governed enterprise data foundation.',
          weight: 70,
          completionPercentage: 80,
          actualSituation: 'Core domains are modeled.',
        },
        {
          objective: 'Improve AI-ready business context.',
          weight: 30,
          completionPercentage: 45,
          actualSituation: 'Audit evidence is being structured.',
        },
      ],
      executionPerformance: {
        ...instance.formData.executionPerformance,
        actualCost: 900_000,
        estimatedCostAtCompletion: 1_800_000,
        budgetVariance: -200_000,
        varianceExplanation: 'Vendor onboarding completed below budget.',
      },
      risksAndIssues: 'Data quality coverage is not complete.',
      correctiveActionPlan: 'Finish domain data quality rules before Q4.',
      ownerSummary: 'Project is aligned with the strategic data foundation goal.',
    }

    const saved = await saveProjectAuditForm(
      storage,
      instance.id,
      nextFormData,
      {
        changeReasons: {
          strategicObjectiveAssessments:
            'Strategic objective progress was reviewed for this audit cycle.',
        },
        now: () => new Date('2026-06-08T02:00:00.000Z'),
      },
    )

    expect(saved.formData).toEqual(nextFormData)
    expect(saved.updatedAt).toBe('2026-06-08T02:00:00.000Z')

    const storageAfterRefresh = new LocalStorageAdapter(memory)
    await expect(storageAfterRefresh.getProjectAuditInstances()).resolves.toEqual([
      saved,
    ])
  })

  it('rejects form data that does not satisfy the bound Blueprint schema', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const instance = await createStartedAuditInstance(storage)
    const invalidFormData = {
      ...instance.formData,
      executionPerformance: undefined,
    }

    await expect(
      saveProjectAuditForm(
        storage,
        instance.id,
        invalidFormData as unknown as typeof instance.formData,
      ),
    ).rejects.toThrow('Audit form data does not match Blueprint schema')
    await expect(storage.getProjectAuditInstances()).resolves.toEqual([instance])
  })

  it('records append-only field changes and requires reasons for critical fields', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const instance = await createStartedAuditInstance(storage)
    const budgetChange = {
      ...instance.formData,
      executionPerformance: {
        ...instance.formData.executionPerformance,
        approvedBudget: 2_100_000,
      },
    }

    await expect(
      saveProjectAuditForm(storage, instance.id, budgetChange, {
        actor: 'Alice Chen',
        now: () => new Date('2026-06-08T03:00:00.000Z'),
      }),
    ).rejects.toThrow(
      'A change reason is required for executionPerformance.approvedBudget.',
    )
    await expect(storage.getAuditChangeRecords(instance.id)).resolves.toEqual([])

    const savedWithBudgetChange = await saveProjectAuditForm(
      storage,
      instance.id,
      budgetChange,
      {
        actor: 'Alice Chen',
        changeReasons: {
          'executionPerformance.approvedBudget':
            'Budget was revised after vendor negotiation.',
        },
        id: () => 'change-1',
        now: () => new Date('2026-06-08T03:05:00.000Z'),
      },
    )

    await expect(storage.getAuditChangeRecords(instance.id)).resolves.toEqual([
      {
        id: 'change-1',
        instanceId: instance.id,
        changedBy: 'Alice Chen',
        changedAt: '2026-06-08T03:05:00.000Z',
        fieldPath: 'executionPerformance.approvedBudget',
        previousValue: instance.formData.executionPerformance.approvedBudget,
        nextValue: 2_100_000,
        reason: 'Budget was revised after vendor negotiation.',
      },
    ])

    await saveProjectAuditForm(
      storage,
      instance.id,
      {
        ...savedWithBudgetChange.formData,
        risksAndIssues: 'Data quality coverage is not complete.',
      },
      {
        actor: 'Alice Chen',
        id: () => 'change-2',
        now: () => new Date('2026-06-08T03:10:00.000Z'),
      },
    )

    const changeRecords = await storage.getAuditChangeRecords(instance.id)
    expect(changeRecords.map((record) => record.id)).toEqual(['change-1', 'change-2'])
    expect(changeRecords[1]).toMatchObject({
      fieldPath: 'risksAndIssues',
      previousValue: '',
      nextValue: 'Data quality coverage is not complete.',
    })
    expect(changeRecords[1]).not.toHaveProperty('reason')

    const projects = await storage.getProjects()
    expect(projects[0].approvedBudget).toBe(2_000_000)
  })
})

async function createStartedAuditInstance(storage: LocalStorageAdapter) {
  const generationResult = generateProjectAuditBlueprint(
    '生成项目审计流程，用于检查里程碑、战略目标和预算执行情况。',
  )

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
  const result = await startAuditCycle(storage, cycle.id)

  return result.instances[0]
}
