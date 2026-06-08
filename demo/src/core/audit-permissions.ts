import type { ProjectAuditInstance } from './audit-cycle'
import type {
  FieldAccessRule,
  ProjectAuditBlueprint,
  RoleDefinition,
  VisibilityRule,
} from './project-audit-blueprint'

export type ProjectAuditActor = {
  roleId: RoleDefinition['id']
  name: string
}

export type FieldAccess = 'hidden' | 'read' | 'edit'

export function getVisibleProjectAuditInstances(
  blueprint: ProjectAuditBlueprint,
  instances: ProjectAuditInstance[],
  actor: ProjectAuditActor,
): ProjectAuditInstance[] {
  const rule = blueprint.visibilityRules.find(
    (candidate) => candidate.roleId === actor.roleId,
  )

  if (!rule) {
    return []
  }

  return instances.filter((instance) => isInstanceVisible(rule, instance, actor))
}

export function getFieldAccess(
  blueprint: ProjectAuditBlueprint,
  instance: ProjectAuditInstance,
  actor: ProjectAuditActor,
  fieldPath: string,
): FieldAccess {
  if (
    actor.roleId === 'audit_administrator' &&
    getVisibleProjectAuditInstances(blueprint, [instance], actor).length > 0
  ) {
    return 'edit'
  }

  const rule = blueprint.fieldAccessRules.find((candidate) =>
    matchesFieldAccessRule(candidate, instance, actor, fieldPath),
  )

  return rule?.access ?? 'hidden'
}

function isInstanceVisible(
  rule: VisibilityRule,
  instance: ProjectAuditInstance,
  actor: ProjectAuditActor,
): boolean {
  if (rule.scope === 'all') {
    return true
  }

  if (rule.scope === 'owned_projects') {
    return instance.projectSnapshot.projectOwner === actor.name
  }

  if (rule.scope === 'supervised_projects') {
    return instance.projectSnapshot.supervisingVp === actor.name
  }

  return instance.status === 'ai_ceo_approval'
}

function matchesFieldAccessRule(
  rule: FieldAccessRule,
  instance: ProjectAuditInstance,
  actor: ProjectAuditActor,
  fieldPath: string,
): boolean {
  return (
    rule.roleId === actor.roleId &&
    matchesState(rule, instance.status) &&
    matchesField(rule, fieldPath)
  )
}

function matchesState(rule: FieldAccessRule, state: string): boolean {
  return rule.states.includes('*') || rule.states.includes(state)
}

function matchesField(rule: FieldAccessRule, fieldPath: string): boolean {
  return (
    rule.fields.includes('*') ||
    rule.fields.some(
      (field) =>
        fieldPath === field ||
        fieldPath.startsWith(`${field}.`) ||
        fieldPath.startsWith(`${field}[`),
    )
  )
}
