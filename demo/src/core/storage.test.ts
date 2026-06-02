import { describe, expect, it } from 'vitest'
import { generateBlueprintFromRequirement } from './blueprint'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Storage adapter', () => {
  it('stores blueprints and marks one blueprint as active', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const blueprint = generateBlueprintFromRequirement('I need a procurement approval workflow.')

    await storage.saveBlueprint(blueprint)
    await storage.setActiveBlueprint(blueprint.id)

    await expect(storage.getBlueprints()).resolves.toEqual([blueprint])
    await expect(storage.getActiveBlueprint()).resolves.toEqual(blueprint)
  })
})
