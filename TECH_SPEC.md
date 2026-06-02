# AI Enterprise Operating Framework Console - Technical Specification

## 1. Purpose

This document defines the first demo of an AI-native enterprise operating framework.

The demo is not a production approval system. It is a technical proof of concept for a CIO or technical leader entering a new company with a reusable framework that can quickly turn business requirements into:

- Configurable forms
- Approval workflows
- Unified business data
- Archival records
- AI-generated reports
- Agent and Skill execution traces

The first demo validates that the framework boundaries are correct and that the core loop can run end to end with minimal implementation cost.

## 2. Target Audience

Primary audience:

- CIO
- CTO
- Technical lead
- Enterprise architecture lead
- Digital transformation team

The first version is not optimized for ordinary business users. It is a framework console that shows how the system can be implemented, extended, and later connected to real infrastructure.

## 3. Demo Scope

The demo will be a static web application built with:

- Vite
- React
- TypeScript
- LocalStorage

The demo will not require:

- Backend server
- Real database
- Real authentication
- Real AI API key
- Real workflow engine
- Real enterprise integrations

The demo must still preserve clear architectural boundaries so each mock layer can later be replaced by a production component.

## 4. Core Concept

The framework is centered around a `Blueprint`.

A Blueprint is a structured business configuration generated from a natural language requirement. It describes:

- Business metadata
- Data model
- Form schema
- Roles and permissions
- Workflow definition
- Risk rules
- Archive policy
- Report definitions

The first demo uses a procurement approval process as the sample business workflow.

Example requirement:

```text
I need a procurement approval workflow.
Employees can submit item name, amount, vendor, and purchase reason.
Requests over 10,000 require finance approval.
Requests with non-whitelisted vendors or repeated purchases require CEO confirmation.
Completed requests should be archived and summarized in procurement risk reports.
```

The Mock Agent converts this requirement into a Blueprint. The application then deploys the Blueprint and runs workflow instances from it.

## 5. High-Level Architecture

```text
Natural Language Requirement
  -> AgentRuntime
  -> Blueprint
  -> Framework Console
  -> Deploy Blueprint
  -> Runtime Application
  -> WorkflowRuntime
  -> StorageAdapter
  -> Reports / Archive / Agent Activity
```

Core runtime abstractions:

- `Blueprint`: business configuration
- `StorageAdapter`: persistence boundary
- `AgentRuntime`: AI and skill execution boundary
- `SkillRegistry`: available AI/business capabilities
- `WorkflowRuntime`: workflow execution boundary

## 6. First Demo Modules

### 6.1 Blueprints

Purpose:

- Accept a natural language business requirement.
- Generate a structured Blueprint using `MockAgentRuntime`.
- Display the active Blueprint.
- Deploy the Blueprint into the runtime.

Required behavior:

- Provide a default procurement approval requirement.
- Generate one procurement approval Blueprint.
- Write Agent Activity records for requirement parsing and Blueprint generation.

### 6.2 Data Model

Purpose:

- Show the business entities implied by the Blueprint.

First demo entities:

- Procurement request
- Approval record
- Vendor
- Archive record
- Agent activity

Required behavior:

- Display entity names, fields, field types, and relationships.
- This is schema visualization only; actual persistence is handled by LocalStorage.

### 6.3 Form Schema

Purpose:

- Show the form fields generated from the Blueprint.
- Dynamically render the runtime procurement request form from the schema.

First demo field types:

- `text`
- `number`
- `textarea`
- `select`
- `date`

Required behavior:

- Render fields from config.
- Validate required fields.
- Store submitted request data as a `RequestInstance`.

### 6.4 Workflow

Purpose:

- Show the workflow nodes and routing rules.
- Drive request state transitions.

First demo workflow:

```text
Submit Request
  -> Risk Analysis
  -> Department Manager Approval
  -> Finance Approval if amount >= 10000 or risk is medium/high
  -> CEO Confirmation if risk is high
  -> Archive
```

Required behavior:

- Create approval tasks based on routing output.
- Allow approve/reject actions.
- Mark completed requests as archived.

### 6.5 Agent & Skills Registry

Purpose:

- Make the AI-native architecture visible.
- Show which skills the Agent can call.

First demo skills:

- `RequirementParsingSkill`
- `BlueprintGenerationSkill`
- `RiskAnalysisSkill`
- `ApprovalRoutingSkill`
- `WorkflowExecutionSkill`
- `ArchiveSkill`
- `ReportGenerationSkill`

Required behavior:

- Display skill name, purpose, mock/production status, and last execution result.
- Each skill call must create an `AgentActivity` record.

### 6.6 Runtime

Purpose:

- Prove that the generated Blueprint can run as a business process.

Required behavior:

- Submit a procurement request.
- Analyze risk.
- Route approval.
- Simulate approvals by role.
- Archive completed requests.
- Persist runtime state in LocalStorage.

### 6.7 Reports

Purpose:

- Show that AI reports can be generated from unified business data.

First demo reports:

- Total procurement amount
- Request count by status
- High-risk request count
- Average approval cycle time
- AI CEO procurement summary

Required behavior:

- Generate report metrics from stored runtime data.
- Generate a text summary using `ReportGenerationSkill`.

### 6.8 Architecture / Roadmap

Purpose:

- Show that the demo is not a dead-end prototype.
- Explain which mock layers can be replaced later.

Required replacement paths:

| Current Demo Layer | Future Production Replacement |
| --- | --- |
| LocalStorageAdapter | PostgreSQL / Supabase |
| MockAgentRuntime | OpenAI / local model / multi-agent runtime |
| Mock Skills | Real tool-calling skills |
| Lightweight WorkflowRuntime | Flowable / Camunda / Temporal |
| Mock notifications | Email / Feishu / WeCom / Slack |
| Static reports | SQL + BI + AI report generation |

## 7. TypeScript Interfaces

### 7.1 Blueprint

```ts
export type Blueprint = {
  id: string
  name: string
  description: string
  version: number
  dataModel: EntitySchema[]
  formSchema: FormField[]
  roles: RoleDefinition[]
  workflow: WorkflowDefinition
  riskRules: RiskRule[]
  archivePolicy: ArchivePolicy
  reports: ReportDefinition[]
  createdAt: string
}
```

### 7.2 Data Model

```ts
export type EntitySchema = {
  name: string
  label: string
  fields: EntityField[]
}

export type EntityField = {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'json'
  required: boolean
  relation?: {
    entity: string
    type: 'one-to-one' | 'one-to-many' | 'many-to-one'
  }
}
```

### 7.3 Form Schema

```ts
export type FormField = {
  key: string
  label: string
  type: 'text' | 'number' | 'textarea' | 'select' | 'date'
  required: boolean
  placeholder?: string
  options?: string[]
}
```

### 7.4 Roles

```ts
export type RoleDefinition = {
  id: string
  name: string
  description: string
  permissions: Permission[]
}

export type Permission =
  | 'blueprint:generate'
  | 'blueprint:deploy'
  | 'request:create'
  | 'request:approve'
  | 'request:reject'
  | 'archive:view'
  | 'reports:view'
```

First demo roles:

- `cio`
- `requester`
- `department_manager`
- `finance`
- `ceo`

### 7.5 Workflow

```ts
export type WorkflowDefinition = {
  id: string
  name: string
  nodes: WorkflowNode[]
}

export type WorkflowNode = {
  id: string
  name: string
  type: 'start' | 'skill' | 'approval' | 'archive' | 'end'
  role?: string
  skillName?: string
  condition?: string
  next: string[]
}
```

### 7.6 Risk Rules

```ts
export type RiskRule = {
  id: string
  name: string
  description: string
  severity: 'low' | 'medium' | 'high'
  condition: string
}
```

First demo risk rules:

- Amount is greater than or equal to 10,000.
- Vendor is not in the whitelist.
- Similar request exists in the last 30 days.
- Purchase reason is too short or incomplete.

Risk level calculation:

- 0 matched rules: `low`
- 1 matched rule: `medium`
- 2 or more matched rules: `high`

### 7.7 Archive Policy

```ts
export type ArchivePolicy = {
  archiveWhen: 'approved' | 'rejected' | 'approved_or_rejected'
  retentionLabel: string
}
```

### 7.8 Reports

```ts
export type ReportDefinition = {
  id: string
  name: string
  description: string
  metricKeys: string[]
}
```

### 7.9 Request Instance

```ts
export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'archived'

export type RiskLevel = 'low' | 'medium' | 'high'

export type RequestInstance = {
  id: string
  blueprintId: string
  status: RequestStatus
  data: Record<string, unknown>
  riskLevel?: RiskLevel
  riskReasons: string[]
  approvalPath: string[]
  currentApproverRole?: string
  approvalHistory: ApprovalRecord[]
  createdAt: string
  updatedAt: string
  archivedAt?: string
}
```

### 7.10 Approval Record

```ts
export type ApprovalRecord = {
  id: string
  requestId: string
  role: string
  action: 'approved' | 'rejected'
  comment: string
  createdAt: string
}
```

### 7.11 Agent Activity

```ts
export type AgentActivity = {
  id: string
  skillName: string
  inputSummary: string
  outputSummary: string
  status: 'success' | 'needs_human_confirmation' | 'failed'
  createdAt: string
}
```

## 8. Adapter Interfaces

### 8.1 StorageAdapter

```ts
export interface StorageAdapter {
  getBlueprints(): Promise<Blueprint[]>
  saveBlueprint(blueprint: Blueprint): Promise<void>
  getActiveBlueprint(): Promise<Blueprint | null>
  setActiveBlueprint(blueprintId: string): Promise<void>

  getRequests(): Promise<RequestInstance[]>
  saveRequest(request: RequestInstance): Promise<void>

  getAgentActivities(): Promise<AgentActivity[]>
  saveAgentActivity(activity: AgentActivity): Promise<void>

  resetDemoData(): Promise<void>
}
```

First implementation:

- `LocalStorageAdapter`

Best practice:

- Use namespaced keys, for example `aiof.blueprints`, `aiof.requests`, `aiof.activities`.
- Keep all storage access behind this adapter.
- Do not let UI components read or write LocalStorage directly.

### 8.2 AgentRuntime

```ts
export interface AgentRuntime {
  generateBlueprint(requirement: string): Promise<Blueprint>
  runSkill<TInput, TOutput>(
    skillName: string,
    input: TInput
  ): Promise<SkillResult<TOutput>>
}

export type SkillResult<TOutput> = {
  output: TOutput
  activity: AgentActivity
}
```

First implementation:

- `MockAgentRuntime`

Best practice:

- All mock AI logic must go through `AgentRuntime`.
- UI must not directly implement risk, routing, archive, or report logic.

### 8.3 WorkflowRuntime

```ts
export interface WorkflowRuntime {
  createRequest(
    blueprint: Blueprint,
    data: Record<string, unknown>
  ): Promise<RequestInstance>

  approveRequest(
    requestId: string,
    role: string,
    comment: string
  ): Promise<RequestInstance>

  rejectRequest(
    requestId: string,
    role: string,
    comment: string
  ): Promise<RequestInstance>
}
```

First implementation:

- `LightweightWorkflowRuntime`

Best practice:

- Workflow state transitions must be handled here.
- UI components should only call runtime actions.
- Archive behavior must be triggered by workflow completion.

## 9. Procurement Demo Blueprint

The first generated Blueprint should include the following form fields:

| Key | Label | Type | Required |
| --- | --- | --- | --- |
| itemName | Item Name | text | yes |
| department | Department | select | yes |
| amount | Amount | number | yes |
| vendor | Vendor | text | yes |
| neededBy | Needed By | date | no |
| reason | Purchase Reason | textarea | yes |

Default departments:

- Engineering
- Sales
- Operations
- Finance

Default whitelisted vendors:

- Apple
- Dell
- Lenovo
- Amazon Business

Default approval behavior:

- All submitted requests go to Department Manager.
- Requests with amount greater than or equal to 10,000 go to Finance.
- High-risk requests require CEO confirmation.
- Approved or rejected requests are archived.

## 10. UI Information Architecture

The application layout should use:

- Left navigation for framework modules
- Top role switcher for demo role simulation
- Main content area for the active module
- Right-side Agent Activity panel

Navigation items:

- Blueprints
- Data Model
- Form Schema
- Workflow
- Agent & Skills
- Runtime
- Reports
- Architecture

Role switcher:

- CIO
- Requester
- Department Manager
- Finance
- CEO

The role switcher is a demo mechanism only. It is not real authentication.

## 11. Minimal Runtime Flow

The first successful demo must run this sequence:

1. User opens Blueprints.
2. User sees a default natural language procurement requirement.
3. User clicks Generate Blueprint.
4. MockAgentRuntime creates a procurement Blueprint.
5. Agent Activity panel records parsing and generation skills.
6. User clicks Deploy Blueprint.
7. User opens Runtime.
8. User submits a procurement request.
9. RiskAnalysisSkill calculates risk.
10. ApprovalRoutingSkill creates approval path.
11. WorkflowRuntime creates approval task.
12. Department Manager approves.
13. Finance approves if required.
14. CEO approves if required.
15. ArchiveSkill archives the request.
16. Reports view shows updated metrics and AI CEO summary.

## 12. Acceptance Criteria

The first demo is complete when all of the following are true:

- A natural language requirement can generate a structured Blueprint.
- The Blueprint can be deployed.
- Data Model view displays entities from the Blueprint.
- Form Schema view displays generated form fields.
- Workflow view displays approval nodes and conditions.
- Agent & Skills view displays the available skills.
- Runtime view can submit a procurement request.
- Risk analysis produces low, medium, or high risk.
- Approval routing changes based on amount, vendor, repeated request, and reason completeness.
- Role switcher can simulate approvals by Department Manager, Finance, and CEO.
- Approved or rejected requests are archived.
- Reports view generates metrics from stored requests.
- Agent Activity panel records each major skill call.
- Data persists after browser refresh through LocalStorage.
- Architecture view explains mock-to-production replacement paths.
- The app can be built as a static site.

## 13. Out of Scope for Version 1

Version 1 will not include:

- Real login
- Real database
- Real file uploads
- Real AI API calls
- Real workflow engine
- Real notification delivery
- Multi-company or multi-tenant support
- BPMN editor
- Complex permission matrix
- External ERP, CRM, or OA integration
- Natural language SQL generation
- Production audit/compliance guarantees

These are intentionally excluded to keep the first demo focused on architecture feasibility.

## 14. Implementation Order

Recommended build order:

1. Create Vite + React + TypeScript project.
2. Define core TypeScript types.
3. Implement `LocalStorageAdapter`.
4. Implement `MockAgentRuntime`.
5. Implement `SkillRegistry` and activity logging.
6. Implement procurement Blueprint generation.
7. Implement Blueprint deploy flow.
8. Implement dynamic form rendering.
9. Implement `LightweightWorkflowRuntime`.
10. Implement risk analysis and approval routing.
11. Implement approval actions and archive behavior.
12. Implement report metrics and AI CEO summary.
13. Implement framework console views.
14. Implement architecture roadmap view.
15. Build and verify static deployment output.

## 15. Production Evolution Plan

### Phase 1: Demo

- Vite + React + TypeScript
- LocalStorage
- MockAgentRuntime
- Mock Skills
- LightweightWorkflowRuntime
- Static deployment

### Phase 2: Real Data Layer

- PostgreSQL or Supabase
- Real schema migration
- User identity
- Role-based access control
- Audit logs

### Phase 3: Real AI Layer

- OpenAI or local model
- Schema-constrained Blueprint generation
- Tool-calling Agent runtime
- Prompt versioning
- Human review for generated configurations

### Phase 4: Real Workflow Layer

- Flowable, Camunda, or Temporal
- Workflow versioning
- Timeout and escalation
- Parallel approval
- Approval delegation

### Phase 5: Enterprise Integration

- Email
- Feishu
- WeCom
- Slack
- ERP
- CRM
- OA
- File archive system
- BI tools

## 16. Best-Practice Principles

- Keep business logic out of UI components.
- Keep persistence behind `StorageAdapter`.
- Keep AI and skill behavior behind `AgentRuntime`.
- Keep workflow state transitions inside `WorkflowRuntime`.
- Treat Blueprint as the central contract.
- Make every important AI/Skill action traceable.
- Start with one complete workflow before adding more business scenarios.
- Prefer replaceable interfaces over early production integrations.
- Use the demo to validate framework shape, not production completeness.

