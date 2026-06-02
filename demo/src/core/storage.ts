import type { Blueprint } from './blueprint'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const BLUEPRINTS_KEY = 'aiof.blueprints'
const ACTIVE_BLUEPRINT_KEY = 'aiof.activeBlueprintId'

export class MemoryStorage implements StorageLike {
  private items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

export class LocalStorageAdapter {
  private readonly storage: StorageLike

  constructor(storage: StorageLike = window.localStorage) {
    this.storage = storage
  }

  async getBlueprints(): Promise<Blueprint[]> {
    return this.readJson<Blueprint[]>(BLUEPRINTS_KEY, [])
  }

  async saveBlueprint(blueprint: Blueprint): Promise<void> {
    const blueprints = await this.getBlueprints()
    const nextBlueprints = [
      ...blueprints.filter((existing) => existing.id !== blueprint.id),
      blueprint,
    ]

    this.writeJson(BLUEPRINTS_KEY, nextBlueprints)
  }

  async getActiveBlueprint(): Promise<Blueprint | null> {
    const activeBlueprintId = this.storage.getItem(ACTIVE_BLUEPRINT_KEY)

    if (!activeBlueprintId) {
      return null
    }

    const blueprints = await this.getBlueprints()

    return blueprints.find((blueprint) => blueprint.id === activeBlueprintId) ?? null
  }

  async setActiveBlueprint(blueprintId: string): Promise<void> {
    this.storage.setItem(ACTIVE_BLUEPRINT_KEY, blueprintId)
  }

  async resetDemoData(): Promise<void> {
    this.storage.removeItem(BLUEPRINTS_KEY)
    this.storage.removeItem(ACTIVE_BLUEPRINT_KEY)
  }

  private readJson<T>(key: string, fallback: T): T {
    const value = this.storage.getItem(key)

    if (!value) {
      return fallback
    }

    return JSON.parse(value) as T
  }

  private writeJson<T>(key: string, value: T): void {
    this.storage.setItem(key, JSON.stringify(value))
  }
}
