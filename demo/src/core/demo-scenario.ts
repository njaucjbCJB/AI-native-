import { deployBlueprint } from './blueprint-deployment'
import { generateBlueprintFromRequirement } from './blueprint'
import {
  generateProjectAuditBlueprint,
  type ProjectAuditBlueprint,
} from './project-audit-blueprint'
import { initializeProjectRegistry } from './project'

type DemoStorage = {
  resetDemoData(): Promise<void>
  saveBlueprint(blueprint: ReturnType<typeof generateBlueprintFromRequirement>): Promise<void>
  setActiveBlueprint(blueprintId: string): Promise<void>
} & Parameters<typeof deployBlueprint>[1] &
  Parameters<typeof initializeProjectRegistry>[0] & {
    getActiveBlueprintVersion(): Promise<ProjectAuditBlueprint | null>
  }

const DEFAULT_PROCUREMENT_REQUIREMENT = 'I need a procurement approval workflow.'
const DEFAULT_PROJECT_AUDIT_DESCRIPTION = [
  '我们需要周期性开展项目审计，检查项目里程碑、战略目标和预算执行情况。',
  '项目负责人填写并自审批，随后由分管项目 VP 审批，最后由 AI CEO 审批。',
  '审批人需要查看项目快照、当前申报值和完整字段变更记录。',
].join('')

export async function resetProjectAuditDemoData(
  storage: DemoStorage,
): Promise<void> {
  await storage.resetDemoData()
  await initializeProjectAuditDemo(storage)
}

export async function initializeProjectAuditDemo(
  storage: DemoStorage,
): Promise<void> {
  const defaultBlueprint = generateBlueprintFromRequirement(DEFAULT_PROCUREMENT_REQUIREMENT)

  await storage.saveBlueprint(defaultBlueprint)
  await storage.setActiveBlueprint(defaultBlueprint.id)
  const activeProjectAuditBlueprint = await storage.getActiveBlueprintVersion()

  if (!activeProjectAuditBlueprint) {
    const projectAuditResult = generateProjectAuditBlueprint(DEFAULT_PROJECT_AUDIT_DESCRIPTION)

    if (projectAuditResult.status !== 'generated') {
      throw new Error('Default project audit Blueprint could not be generated.')
    }

    await deployBlueprint(projectAuditResult.blueprint, storage)
  }

  await initializeProjectRegistry(storage)
}
