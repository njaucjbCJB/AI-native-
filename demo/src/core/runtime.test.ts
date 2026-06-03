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

  it('records skill activity in storage when a runtime request is submitted', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const blueprint = generateBlueprintFromRequirement('I need a procurement approval workflow.')

    await storage.saveBlueprint(blueprint)
    await storage.setActiveBlueprint(blueprint.id)

    await submitRuntimeRequest(
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
        activityId: createSequentialIds('activity-risk-1', 'activity-routing-1'),
        activityNow: createSequentialDates(
          new Date('2026-06-03T13:05:00.000Z'),
          new Date('2026-06-03T13:06:00.000Z'),
        ),
      },
    )

    await expect(storage.getAgentActivities()).resolves.toEqual([
      {
        id: 'activity-risk-1',
        skillName: 'RiskAnalysisSkill',
        inputSummary: 'request request-runtime-1',
        outputSummary: 'high risk with 2 matched rule(s)',
        status: 'success',
        createdAt: '2026-06-03T13:05:00.000Z',
      },
      {
        id: 'activity-routing-1',
        skillName: 'ApprovalRoutingSkill',
        inputSummary: 'request request-runtime-1 with high risk',
        outputSummary: '3 approval step(s)',
        status: 'success',
        createdAt: '2026-06-03T13:06:00.000Z',
      },
    ])
  })
})

function createSequentialIds(...ids: string[]) {
  let index = 0

  return () => ids[index++] ?? ids.at(-1) ?? 'activity'
}

function createSequentialDates(...dates: Date[]) {
  let index = 0

  return () => dates[index++] ?? dates.at(-1) ?? new Date('2026-06-03T00:00:00.000Z')
}
