import { describe, expect, it } from 'vitest'
import { deployBlueprint } from './blueprint-deployment'
import { generateProjectAuditBlueprint } from './project-audit-blueprint'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Blueprint deployment', () => {
  it('deploys a draft as version 1 and selects it as the active version', async () => {
    const generationResult = generateProjectAuditBlueprint(
      '生成一个项目审计流程，用于检查里程碑、战略目标和预算执行情况。',
    )

    if (generationResult.status !== 'generated') {
      throw new Error('Expected a generated project audit Blueprint.')
    }

    const storage = new LocalStorageAdapter(new MemoryStorage())
    const deployed = await deployBlueprint(generationResult.blueprint, storage)

    expect(deployed.lifecycle).toBe('deployed')
    expect(deployed.version).toBe(1)
    await expect(storage.getBlueprintVersions('project-audit')).resolves.toEqual([deployed])
    await expect(storage.getActiveBlueprintVersion()).resolves.toEqual(deployed)
  })

  it('creates a higher version without changing the previously deployed version', async () => {
    const firstResult = generateProjectAuditBlueprint(
      '生成一个项目审计流程，用于检查里程碑和战略目标。',
    )
    const secondResult = generateProjectAuditBlueprint(
      '生成一个项目审计流程，用于检查里程碑、战略目标、预算和成本。',
    )

    if (firstResult.status !== 'generated' || secondResult.status !== 'generated') {
      throw new Error('Expected generated project audit Blueprints.')
    }

    const storage = new LocalStorageAdapter(new MemoryStorage())
    const version1 = await deployBlueprint(firstResult.blueprint, storage)
    const version2 = await deployBlueprint(secondResult.blueprint, storage)
    const versions = await storage.getBlueprintVersions('project-audit')

    expect(version1.version).toBe(1)
    expect(version2.version).toBe(2)
    expect(versions).toHaveLength(2)
    expect(versions[0].metadata.description).toBe(
      '生成一个项目审计流程，用于检查里程碑和战略目标。',
    )
    expect(versions[1].metadata.description).toBe(
      '生成一个项目审计流程，用于检查里程碑、战略目标、预算和成本。',
    )
    await expect(storage.getActiveBlueprintVersion()).resolves.toEqual(version2)
  })

  it('rejects attempts to overwrite an existing deployed version', async () => {
    const generationResult = generateProjectAuditBlueprint(
      '生成项目审计流程并保留项目变更记录。',
    )

    if (generationResult.status !== 'generated') {
      throw new Error('Expected a generated project audit Blueprint.')
    }

    const storage = new LocalStorageAdapter(new MemoryStorage())
    const deployed = await deployBlueprint(generationResult.blueprint, storage)

    await expect(storage.saveBlueprintVersion(deployed)).rejects.toThrow(
      'Blueprint project-audit version 1 is immutable.',
    )
  })
})
