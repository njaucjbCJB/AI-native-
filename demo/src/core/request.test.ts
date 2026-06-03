import { describe, expect, it } from 'vitest'
import { generateBlueprintFromRequirement } from './blueprint'
import { submitRequestFromActiveBlueprint } from './request'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Request instances', () => {
  it('creates and stores a procurement request from the active blueprint form schema', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const blueprint = generateBlueprintFromRequirement('I need a procurement approval workflow.')

    await storage.saveBlueprint(blueprint)
    await storage.setActiveBlueprint(blueprint.id)

    const request = await submitRequestFromActiveBlueprint(
      storage,
      {
        itemName: 'MacBook Pro',
        department: 'Engineering',
        amount: 3200,
        vendor: 'Apple',
        neededBy: '2026-07-01',
        reason: 'Replace an aging laptop for product engineering work.',
      },
      {
        id: () => 'request-1',
        now: () => new Date('2026-06-03T10:00:00.000Z'),
      },
    )

    expect(request).toEqual({
      id: 'request-1',
      blueprintId: blueprint.id,
      status: 'submitted',
      data: {
        itemName: 'MacBook Pro',
        department: 'Engineering',
        amount: 3200,
        vendor: 'Apple',
        neededBy: '2026-07-01',
        reason: 'Replace an aging laptop for product engineering work.',
      },
      createdAt: '2026-06-03T10:00:00.000Z',
      updatedAt: '2026-06-03T10:00:00.000Z',
    })
    await expect(storage.getRequestInstances()).resolves.toEqual([request])
  })

  it('rejects request data that is missing required blueprint fields', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const blueprint = generateBlueprintFromRequirement('I need a procurement approval workflow.')

    await storage.saveBlueprint(blueprint)
    await storage.setActiveBlueprint(blueprint.id)

    await expect(
      submitRequestFromActiveBlueprint(storage, {
        itemName: 'MacBook Pro',
        department: 'Engineering',
        amount: 3200,
        vendor: 'Apple',
      }),
    ).rejects.toThrow('Missing required fields: reason')
    await expect(storage.getRequestInstances()).resolves.toEqual([])
  })

  it('reads stored request instances through a new storage adapter', async () => {
    const memoryStorage = new MemoryStorage()
    const storage = new LocalStorageAdapter(memoryStorage)
    const blueprint = generateBlueprintFromRequirement('I need a procurement approval workflow.')

    await storage.saveBlueprint(blueprint)
    await storage.setActiveBlueprint(blueprint.id)

    const request = await submitRequestFromActiveBlueprint(
      storage,
      {
        itemName: 'Standing desks',
        department: 'Operations',
        amount: 1800,
        vendor: 'Amazon Business',
        reason: 'Equip the new operations room with ergonomic desks.',
      },
      {
        id: () => 'request-after-refresh',
        now: () => new Date('2026-06-03T11:00:00.000Z'),
      },
    )
    const storageAfterRefresh = new LocalStorageAdapter(memoryStorage)

    await expect(storageAfterRefresh.getRequestInstances()).resolves.toEqual([request])
  })
})
