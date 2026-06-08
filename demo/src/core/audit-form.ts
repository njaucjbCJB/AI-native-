import validator from '@rjsf/validator-ajv8'
import type { RJSFSchema } from '@rjsf/utils'
import type { ProjectAuditFormData, ProjectAuditInstance } from './audit-cycle'
import type { ProjectAuditBlueprint } from './project-audit-blueprint'

export type AuditChangeRecord = {
  id: string
  instanceId: string
  changedBy: string
  changedAt: string
  fieldPath: string
  previousValue: unknown
  nextValue: unknown
  reason?: string
}

type ProjectAuditFormStorage = {
  getBlueprintVersions(blueprintId?: string): Promise<ProjectAuditBlueprint[]>
  getAuditChangeRecords(instanceId?: string): Promise<AuditChangeRecord[]>
  getProjectAuditInstances(): Promise<ProjectAuditInstance[]>
  saveAuditChangeRecord(record: AuditChangeRecord): Promise<void>
  saveProjectAuditInstance(instance: ProjectAuditInstance): Promise<void>
}

type SaveProjectAuditFormOptions = {
  actor?: string
  changeReasons?: Record<string, string>
  id?: () => string
  now?: () => Date
}

export async function saveProjectAuditForm(
  storage: ProjectAuditFormStorage,
  instanceId: string,
  formData: ProjectAuditFormData,
  options: SaveProjectAuditFormOptions = {},
): Promise<ProjectAuditInstance> {
  const instances = await storage.getProjectAuditInstances()
  const instance = instances.find((candidate) => candidate.id === instanceId)

  if (!instance) {
    throw new Error(`Project audit instance ${instanceId} was not found.`)
  }

  const blueprint = await findBoundBlueprint(storage, instance)
  const validation = validator.validateFormData(
    formData,
    blueprint.formSchema as RJSFSchema,
  )

  if (validation.errors.length > 0) {
    const errorSummary = validation.errors
      .map((error) => error.stack ?? error.message)
      .filter(Boolean)
      .join('; ')

    throw new Error(
      `Audit form data does not match Blueprint schema: ${errorSummary}`,
    )
  }

  const changedAt = (options.now ?? (() => new Date()))().toISOString()
  const changes = diffValues(instance.formData, formData)

  for (const change of changes) {
    const reason = findReason(change.fieldPath, options.changeReasons ?? {})

    if (isReasonRequired(change.fieldPath, blueprint) && !reason) {
      throw new Error(`A change reason is required for ${change.fieldPath}.`)
    }
  }

  const savedInstance: ProjectAuditInstance = {
    ...instance,
    formData: cloneJson(formData),
    updatedAt: changedAt,
  }

  for (const change of changes) {
    const reason = findReason(change.fieldPath, options.changeReasons ?? {})

    await storage.saveAuditChangeRecord({
      id: (options.id ?? (() => crypto.randomUUID()))(),
      instanceId: instance.id,
      changedBy: options.actor ?? 'system',
      changedAt,
      fieldPath: change.fieldPath,
      previousValue: cloneJson(change.previousValue),
      nextValue: cloneJson(change.nextValue),
      ...(reason ? { reason } : {}),
    })
  }

  await storage.saveProjectAuditInstance(savedInstance)

  return savedInstance
}

async function findBoundBlueprint(
  storage: ProjectAuditFormStorage,
  instance: ProjectAuditInstance,
): Promise<ProjectAuditBlueprint> {
  const versions = await storage.getBlueprintVersions(instance.blueprintId)
  const blueprint = versions.find(
    (candidate) => candidate.version === instance.blueprintVersion,
  )

  if (!blueprint) {
    throw new Error(
      `Blueprint ${instance.blueprintId} version ${instance.blueprintVersion} was not found.`,
    )
  }

  return blueprint
}

function cloneJson<T>(value: T): T {
  if (value === undefined) {
    return value
  }

  return JSON.parse(JSON.stringify(value)) as T
}

type FieldChange = {
  fieldPath: string
  previousValue: unknown
  nextValue: unknown
}

function diffValues(
  previousValue: unknown,
  nextValue: unknown,
  path = '',
): FieldChange[] {
  if (Object.is(previousValue, nextValue)) {
    return []
  }

  if (isRecord(previousValue) && isRecord(nextValue)) {
    const keys = new Set([...Object.keys(previousValue), ...Object.keys(nextValue)])

    return [...keys].flatMap((key) =>
      diffValues(previousValue[key], nextValue[key], path ? `${path}.${key}` : key),
    )
  }

  if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
    const length = Math.max(previousValue.length, nextValue.length)

    return Array.from({ length }).flatMap((_, index) =>
      diffValues(previousValue[index], nextValue[index], `${path}[${index}]`),
    )
  }

  return [
    {
      fieldPath: path,
      previousValue,
      nextValue,
    },
  ]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isReasonRequired(
  fieldPath: string,
  blueprint: ProjectAuditBlueprint,
): boolean {
  return blueprint.changeAuditRules.reasonRequiredFields.some(
    (requiredField) =>
      fieldPath === requiredField ||
      fieldPath.startsWith(`${requiredField}.`) ||
      fieldPath.startsWith(`${requiredField}[`),
  )
}

function findReason(
  fieldPath: string,
  changeReasons: Record<string, string>,
): string | undefined {
  if (changeReasons[fieldPath]?.trim()) {
    return changeReasons[fieldPath].trim()
  }

  const parentPath = Object.keys(changeReasons).find(
    (candidate) =>
      changeReasons[candidate]?.trim() &&
      (fieldPath.startsWith(`${candidate}.`) ||
        fieldPath.startsWith(`${candidate}[`)),
  )

  return parentPath ? changeReasons[parentPath].trim() : undefined
}
