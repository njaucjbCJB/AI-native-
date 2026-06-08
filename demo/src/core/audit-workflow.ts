import { createMachine, transition } from 'xstate'
import type { ProjectAuditInstance, ProjectAuditInstanceStatus } from './audit-cycle'

export type ApprovalRecord = {
  id: string
  instanceId: string
  actor: string
  roleId: 'project_owner'
  decision: 'approved' | 'withdrawn'
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
      },
    },
    ai_ceo_approval: {},
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
    createApprovalRecord(instance, saved, 'approved', options),
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
    createApprovalRecord(instance, saved, 'withdrawn', options),
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
  options: WorkflowOptions,
): ApprovalRecord {
  return {
    id: (options.id ?? (() => crypto.randomUUID()))(),
    instanceId: previous.id,
    actor: options.actor,
    roleId: 'project_owner',
    decision,
    ...(options.comment ? { comment: options.comment } : {}),
    decidedAt: next.updatedAt,
    fromStatus: previous.status,
    toStatus: next.status,
  }
}
