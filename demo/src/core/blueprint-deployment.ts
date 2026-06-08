import type { ProjectAuditBlueprint } from './project-audit-blueprint'

export type BlueprintVersionStorage = {
  getBlueprintVersions(blueprintId?: string): Promise<ProjectAuditBlueprint[]>
  saveBlueprintVersion(blueprint: ProjectAuditBlueprint): Promise<void>
  setActiveBlueprintVersion(blueprintId: string, version: number): Promise<void>
}

function cloneBlueprint(blueprint: ProjectAuditBlueprint): ProjectAuditBlueprint {
  return JSON.parse(JSON.stringify(blueprint)) as ProjectAuditBlueprint
}

export async function deployBlueprint(
  draft: ProjectAuditBlueprint,
  storage: BlueprintVersionStorage,
): Promise<ProjectAuditBlueprint> {
  if (draft.lifecycle !== 'draft') {
    throw new Error('Only a Blueprint draft can be deployed.')
  }

  const existingVersions = await storage.getBlueprintVersions(draft.id)
  const nextVersion =
    Math.max(0, ...existingVersions.map((blueprint) => blueprint.version ?? 0)) + 1
  const deployed = cloneBlueprint({
    ...draft,
    lifecycle: 'deployed',
    version: nextVersion,
  })

  await storage.saveBlueprintVersion(deployed)
  await storage.setActiveBlueprintVersion(deployed.id, nextVersion)

  return deployed
}
