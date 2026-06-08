import { describe, expect, it } from 'vitest'
import { generateProjectAuditBlueprint } from './project-audit-blueprint'

describe('Project audit Blueprint generation', () => {
  it('generates a complete Blueprint V2 draft from a project audit description', () => {
    const result = generateProjectAuditBlueprint(
      '我们需要周期性开展项目审计，检查里程碑、战略目标和预算执行情况，并依次由项目负责人、分管项目 VP 和 AI CEO 审批。',
    )

    expect(result.status).toBe('generated')

    if (result.status !== 'generated') {
      throw new Error('Expected a generated project audit Blueprint.')
    }

    const blueprint = result.blueprint

    expect(blueprint.schemaVersion).toBe('2.0')
    expect(blueprint.lifecycle).toBe('draft')
    expect(blueprint.metadata.scenario).toBe('project_audit')
    expect(blueprint.entities.map((entity) => entity.id)).toEqual([
      'project',
      'project_audit_instance',
    ])
    expect(blueprint.formSchema.type).toBe('object')
    expect(blueprint.formSchema.properties).toHaveProperty('milestoneAssessments')
    expect(blueprint.formSchema.properties).toHaveProperty('strategicObjectiveAssessments')
    expect(blueprint.prefillRules).toContainEqual({
      source: 'projectSnapshot.approvedBudget',
      target: 'executionPerformance.approvedBudget',
    })
    expect(blueprint.roles.map((role) => role.id)).toEqual([
      'audit_administrator',
      'project_owner',
      'supervising_vp',
      'ai_ceo',
      'global_viewer',
    ])
    expect(blueprint.visibilityRules).toHaveLength(5)
    expect(blueprint.fieldAccessRules.length).toBeGreaterThan(0)
    expect(blueprint.workflow.states).toContainEqual(
      expect.objectContaining({ id: 'vp_approval', type: 'approval' }),
    )
    expect(blueprint.changeAuditRules.reasonRequiredFields).toEqual(
      expect.arrayContaining([
        'projectSnapshot.projectCode',
        'projectSnapshot.projectOwner',
        'projectSnapshot.supervisingVp',
        'executionPerformance.approvedBudget',
        'strategicObjectiveAssessments',
      ]),
    )
  })

  it('returns a clear unsupported result for a different business scenario', () => {
    const result = generateProjectAuditBlueprint(
      'I need a procurement approval workflow for office equipment.',
    )

    expect(result).toEqual({
      status: 'unsupported',
      message: '当前版本仅支持生成项目审计业务蓝图。',
    })
  })

  it('generates the same structure for the same business description', () => {
    const description = '项目审计需要检查里程碑、战略目标和预算执行情况。'

    expect(generateProjectAuditBlueprint(description)).toEqual(
      generateProjectAuditBlueprint(description),
    )
  })
})
