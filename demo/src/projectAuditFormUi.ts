import type { UiSchema } from '@rjsf/utils'

export const PROJECT_AUDIT_FORM_UI_SCHEMA: UiSchema = {
  'ui:submitButtonOptions': {
    props: {
      className: 'primary-action',
    },
    submitText: '校验表单',
  },
  projectSnapshot: {
    'ui:classNames': 'audit-schema-section audit-schema-project',
  },
  milestoneAssessments: {
    'ui:classNames': 'audit-schema-section audit-schema-repeatable',
  },
  strategicObjectiveAssessments: {
    'ui:classNames': 'audit-schema-section audit-schema-repeatable',
  },
  executionPerformance: {
    'ui:classNames': 'audit-schema-section audit-schema-performance',
    varianceExplanation: {
      'ui:widget': 'textarea',
      'ui:options': {
        rows: 3,
      },
    },
  },
  risksAndIssues: {
    'ui:widget': 'textarea',
    'ui:options': {
      rows: 4,
    },
  },
  correctiveActionPlan: {
    'ui:widget': 'textarea',
    'ui:options': {
      rows: 4,
    },
  },
  ownerSummary: {
    'ui:widget': 'textarea',
    'ui:options': {
      rows: 4,
    },
  },
}
