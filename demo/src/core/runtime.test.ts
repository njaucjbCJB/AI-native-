import { describe, expect, it } from 'vitest'
import { generateBlueprintFromRequirement } from './blueprint'
import { submitRuntimeRequest } from './runtime'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Runtime request submission', () => {
  it('submits a procurement request and starts its approval workflow', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const blueprint = generateBlueprintFromRequirement('I need a procurement approval workflow.')

    await storage.saveBlueprint(blueprint)
    await storage.setActiveBlueprint(blueprint.id)

    const result = await submitRuntimeRequest(
      storage,
      {
        itemName: 'Security audit',
        department: 'Engineering',
        amount: 12000,
        vendor: 'Unknown Vendor',
        neededBy: '2026-07-01',
        reason: 'Run a security audit before the next enterprise customer launch.',
      },
      {
        requestId: () => 'request-runtime-1',
        workflowNow: () => new Date('2026-06-03T13:00:00.000Z'),
        requestNow: () => new Date('2026-06-03T12:00:00.000Z'),
      },
    )

    expect(result.risk.level).toBe('high')
    expect(result.approvalPath.map((step) => step.role)).toEqual([
      'department_manager',
      'finance',
      'ceo',
    ])
    expect(result.workflow.status).toBe('in_review')
    expect(result.workflow.currentStep?.role).toBe('department_manager')
    await expect(storage.getRequestInstances()).resolves.toEqual([result.request])
    await expect(storage.getWorkflowInstances()).resolves.toEqual([result.workflow])
  })
})
