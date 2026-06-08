import { createMachine, transition } from 'xstate'
import type { ProjectAuditInstance, ProjectAuditInstanceStatus } from './audit-cycle'

export type ApprovalRecord = {
  id: string
  instanceId: string
  actor: string
  roleId: 'project_owner' | 'supervising_vp' | 'ai_ceo'
  decision: 'approved' | 'rejected' | 'withdrawn'
  comment?: string
  decidedAt: string
  fromStatus: ProjectAuditInstanceStatus
  toStatus: ProjectAuditInstanceStatus
}

type AuditWorkflowStorage = {
  getProjectAuditInstances(): Promise<ProjectAuditInstance[]>
  saveProjectAuditInstance(instance: ProjectAuditInstance): Promise<void>
  saveApprovalRecord(record: ApprovalRecord): Promise<void>
}

type WorkflowOptions = {
  actor: string
  comment?: string
  id?: () => string
  now?: () => Date
}

type ProjectAuditWorkflowEvent =
  | { type: 'SUBMIT' }
  | { type: 'OWNER_APPROVE' }
  | { type: 'WITHDRAW' }
  | { type: 'VP_APPROVE' }
  | { type: 'VP_REJECT' }
  | { type: 'AI_CEO_APPROVE' }
  | { type: 'AI_CEO_REJECT' }

const projectAuditWorkflowMachine = createMachine({
  id: 'projectAuditWorkflow',
  initial: 'draft',
  states: {
    draft: {
      on: {
        SUBMIT: 'owner_self_approval',
      },
    },
    owner_self_approval: {
      on: {
        OWNER_APPROVE: 'vp_approval',
        WITHDRAW: 'draft',
      },
    },
    vp_approval: {
      on: {
        WITHDRAW: 'draft',
        VP_APPROVE: 'ai_ceo_approval',
        VP_REJECT: 'rework',
      },
    },
    ai_ceo_approval: {
      on: {
        AI_CEO_APPROVE: 'approved',
        AI_CEO_REJECT: 'rework',
      },
    },
    rework: {
      on: {
        SUBMIT: 'owner_self_approval',
      },
    },
    approved: {},
  },
})

export async function submitProjectAuditInstance(
  storage: AuditWorkflowStorage,
  instanceId: string,
  options: WorkflowOptions,
): Promise<ProjectAuditInstance> {
  const instance = await findInstance(storage, instanceId)
  assertProjectOwner(instance, options.actor)

  if (instance.status !== 'draft' && instance.status !== 'rework') {
    throw new Error('Only draft or rework audit instances can be submitted.')
  }

  const nextStatus = getNextStatus(instance.status, { type: 'SUBMIT' })

  return saveInstanceStatus(storage, instance, nextStatus, options)
}

export async function approveProjectOwnerSelfApproval(
  storage: AuditWorkflowStorage,
  instanceId: string,
  options: WorkflowOptions,
): Promise<ProjectAuditInstance> {
  const instance = await findInstance(storage, instanceId)
  assertProjectOwner(instance, options.actor)

  if (instance.status !== 'owner_self_approval') {
    throw new Error('Only instances waiting for owner self-approval can be approved.')
  }

  const nextStatus = getNextStatus(instance.status, { type: 'OWNER_APPROVE' })
  const saved = await saveInstanceStatus(storage, instance, nextStatus, options)

  await storage.saveApprovalRecord(
    createApprovalRecord(instance, saved, 'approved', 'project_owner', options),
  )

  return saved
}

export async function withdrawProjectAuditInstance(
  storage: AuditWorkflowStorage,
  instanceId: string,
  options: WorkflowOptions,
): Promise<ProjectAuditInstance> {
  const instance = await findInstance(storage, instanceId)
  assertProjectOwner(instance, options.actor)

  if (instance.status !== 'owner_self_approval' && instance.status !== 'vp_approval') {
    throw new Error('Only instances before a VP decision can be withdrawn.')
  }

  const nextStatus = getNextStatus(instance.status, { type: 'WITHDRAW' })
  const saved = await saveInstanceStatus(storage, instance, nextStatus, options)

  await storage.saveApprovalRecord(
    createApprovalRecord(instance, saved, 'withdrawn', 'project_owner', options),
  )

  return saved
}

export async function approveVpProjectAuditInstance(
  storage: AuditWorkflowStorage,
  instanceId: string,
  options: WorkflowOptions,
): Promise<ProjectAuditInstance> {
  const instance = await findInstance(storage, instanceId)
  assertSupervisingVp(instance, options.actor)
  assertStatus(instance, 'vp_approval', 'Only instances waiting for VP approval can be approved.')
  const nextStatus = getNextStatus(instance.status, { type: 'VP_APPROVE' })
  const saved = await saveInstanceStatus(storage, instance, nextStatus, options)

  await storage.saveApprovalRecord(
    createApprovalRecord(instance, saved, 'approved', 'supervising_vp', options),
  )

  return saved
}

export async function rejectVpProjectAuditInstance(
  storage: AuditWorkflowStorage,
  instanceId: string,
  options: WorkflowOptions,
): Promise<ProjectAuditInstance> {
  const instance = await findInstance(storage, instanceId)
  assertSupervisingVp(instance, options.actor)
  assertStatus(instance, 'vp_approval', 'Only instances waiting for VP approval can be rejected.')
  assertRequiredComment(options.comment, 'A VP rejection comment is required.')
  const nextStatus = getNextStatus(instance.status, { type: 'VP_REJECT' })
  const saved = await saveInstanceStatus(storage, instance, nextStatus, options)

  await storage.saveApprovalRecord(
    createApprovalRecord(instance, saved, 'rejected', 'supervising_vp', options),
  )

  return saved
}

export async function approveAiCeoProjectAuditInstance(
  storage: AuditWorkflowStorage,
  instanceId: string,
  options: WorkflowOptions,
): Promise<ProjectAuditInstance> {
  const instance = await findInstance(storage, instanceId)
  assertAiCeo(options.actor)
  assertStatus(
    instance,
    'ai_ceo_approval',
    'Only instances waiting for AI CEO approval can be approved.',
  )
  const nextStatus = getNextStatus(instance.status, { type: 'AI_CEO_APPROVE' })
  const saved = await saveInstanceStatus(storage, instance, nextStatus, options)

  await storage.saveApprovalRecord(
    createApprovalRecord(instance, saved, 'approved', 'ai_ceo', options),
  )

  return saved
}

export async function rejectAiCeoProjectAuditInstance(
  storage: AuditWorkflowStorage,
  instanceId: string,
  options: WorkflowOptions,
): Promise<ProjectAuditInstance> {
  const instance = await findInstance(storage, instanceId)
  assertAiCeo(options.actor)
  assertStatus(
    instance,
    'ai_ceo_approval',
    'Only instances waiting for AI CEO approval can be rejected.',
  )
  assertRequiredComment(options.comment, 'An AI CEO rejection comment is required.')
  const nextStatus = getNextStatus(instance.status, { type: 'AI_CEO_REJECT' })
  const saved = await saveInstanceStatus(storage, instance, nextStatus, options)

  await storage.saveApprovalRecord(
    createApprovalRecord(instance, saved, 'rejected', 'ai_ceo', options),
  )

  return saved
}

async function findInstance(
  storage: AuditWorkflowStorage,
  instanceId: string,
): Promise<ProjectAuditInstance> {
  const instances = await storage.getProjectAuditInstances()
  const instance = instances.find((candidate) => candidate.id === instanceId)

  if (!instance) {
    throw new Error(`Project audit instance ${instanceId} was not found.`)
  }

  return instance
}

function assertProjectOwner(instance: ProjectAuditInstance, actor: string): void {
  if (instance.projectSnapshot.projectOwner !== actor) {
    throw new Error('Only the project owner can withdraw this audit instance.')
  }
}

function assertSupervisingVp(instance: ProjectAuditInstance, actor: string): void {
  if (instance.projectSnapshot.supervisingVp !== actor) {
    throw new Error('Only the supervising VP can approve this audit instance.')
  }
}

function assertAiCeo(actor: string): void {
  if (actor !== 'AI CEO') {
    throw new Error('Only AI CEO can approve this audit instance.')
  }
}

function assertStatus(
  instance: ProjectAuditInstance,
  status: ProjectAuditInstanceStatus,
  message: string,
): void {
  if (instance.status !== status) {
    throw new Error(message)
  }
}

function assertRequiredComment(comment: string | undefined, message: string): void {
  if (!comment?.trim()) {
    throw new Error(message)
  }
}

function getNextStatus(
  status: ProjectAuditInstanceStatus,
  event: ProjectAuditWorkflowEvent,
): ProjectAuditInstanceStatus {
  const currentSnapshot = projectAuditWorkflowMachine.resolveState({
    value: status,
    context: {},
  })
  const [snapshot] = transition(projectAuditWorkflowMachine, currentSnapshot, event)

  return snapshot.value as ProjectAuditInstanceStatus
}

async function saveInstanceStatus(
  storage: AuditWorkflowStorage,
  instance: ProjectAuditInstance,
  status: ProjectAuditInstanceStatus,
  options: WorkflowOptions,
): Promise<ProjectAuditInstance> {
  const saved: ProjectAuditInstance = {
    ...instance,
    status,
    updatedAt: (options.now ?? (() => new Date()))().toISOString(),
  }

  await storage.saveProjectAuditInstance(saved)

  return saved
}

function createApprovalRecord(
  previous: ProjectAuditInstance,
  next: ProjectAuditInstance,
  decision: ApprovalRecord['decision'],
  roleId: ApprovalRecord['roleId'],
  options: WorkflowOptions,
): ApprovalRecord {
  return {
    id: (options.id ?? (() => crypto.randomUUID()))(),
    instanceId: previous.id,
    actor: options.actor,
    roleId,
    decision,
    ...(options.comment ? { comment: options.comment } : {}),
    decidedAt: next.updatedAt,
    fromStatus: previous.status,
    toStatus: next.status,
  }
}
