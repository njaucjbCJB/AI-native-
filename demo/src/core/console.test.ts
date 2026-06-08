import { describe, expect, it } from 'vitest'
import { generateBlueprintFromRequirement } from './blueprint'
import { getFrameworkConsoleViews } from './console'

describe('Framework console views', () => {
  it('defines the CIO console views from the active blueprint', () => {
    const blueprint = generateBlueprintFromRequirement('I need a procurement approval workflow.')

    const views = getFrameworkConsoleViews(blueprint)

    expect(views.map((view) => view.id)).toEqual([
      'blueprints',
      'project-registry',
      'audit-cycles',
      'data-model',
      'form-schema',
      'workflow',
      'agent-skills',
      'runtime',
      'reports',
    ])
    expect(views.find((view) => view.id === 'blueprints')?.items).toContain(
      'Procurement Approval v1',
    )
    expect(views.find((view) => view.id === 'project-registry')?.title).toBe(
      '项目台账',
    )
    expect(views.find((view) => view.id === 'audit-cycles')?.title).toBe(
      '审计周期',
    )
    expect(views.find((view) => view.id === 'form-schema')?.items).toContain(
      'Amount: number',
    )
    expect(views.find((view) => view.id === 'workflow')?.items).toContain(
      'CEO Confirmation: ceo',
    )
    expect(views.find((view) => view.id === 'agent-skills')?.items).toContain(
      'ReportGenerationSkill: mock now, production replaceable',
    )
  })
})
