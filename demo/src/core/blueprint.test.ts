import { describe, expect, it } from 'vitest'
import { generateBlueprintFromRequirement } from './blueprint'

describe('Blueprint generation', () => {
  it('generates a deployable procurement approval blueprint from the default requirement', () => {
    const requirement = [
      'I need a procurement approval workflow.',
      'Employees can submit item name, amount, vendor, and purchase reason.',
      'Requests over 10,000 require finance approval.',
      'Requests with non-whitelisted vendors or repeated purchases require CEO confirmation.',
      'Completed requests should be archived and summarized in procurement risk reports.',
    ].join(' ')

    const blueprint = generateBlueprintFromRequirement(requirement)

    expect(blueprint.name).toBe('Procurement Approval')
    expect(blueprint.formSchema.map((field) => field.key)).toEqual([
      'itemName',
      'department',
      'amount',
      'vendor',
      'neededBy',
      'reason',
    ])
    expect(blueprint.workflow.nodes.map((node) => node.role).filter(Boolean)).toEqual([
      'department_manager',
      'finance',
      'ceo',
    ])
    expect(blueprint.riskRules.map((rule) => rule.id)).toEqual([
      'high_amount',
      'vendor_not_whitelisted',
      'similar_recent_request',
      'incomplete_reason',
    ])
    expect(blueprint.archivePolicy.archiveWhen).toBe('approved_or_rejected')
    expect(blueprint.reports.map((report) => report.id)).toEqual([
      'procurement_spend_summary',
      'procurement_risk_summary',
    ])
  })
})
