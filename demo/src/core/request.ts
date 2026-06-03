import type { Blueprint } from './blueprint'

export type RequestData = Record<string, string | number | boolean | null | undefined>

export type RequestInstance = {
  id: string
  blueprintId: string
  status: 'submitted'
  data: RequestData
  createdAt: string
  updatedAt: string
}

type RequestInstanceStorage = {
  getActiveBlueprint(): Promise<Blueprint | null>
  saveRequestInstance(request: RequestInstance): Promise<void>
}

type SubmitRequestOptions = {
  id?: () => string
  now?: () => Date
}

export async function submitRequestFromActiveBlueprint(
  storage: RequestInstanceStorage,
  data: RequestData,
  options: SubmitRequestOptions = {},
): Promise<RequestInstance> {
  const blueprint = await storage.getActiveBlueprint()

  if (!blueprint) {
    throw new Error('An active blueprint is required before submitting a request.')
  }

  const missingRequiredFields = blueprint.formSchema
    .filter((field) => field.required)
    .map((field) => field.key)
    .filter((key) => isEmptyRequestValue(data[key]))

  if (missingRequiredFields.length > 0) {
    throw new Error(`Missing required fields: ${missingRequiredFields.join(', ')}`)
  }

  const timestamp = (options.now ?? (() => new Date()))().toISOString()
  const id = (options.id ?? (() => crypto.randomUUID()))()
  const request: RequestInstance = {
    id,
    blueprintId: blueprint.id,
    status: 'submitted',
    data,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await storage.saveRequestInstance(request)

  return request
}

function isEmptyRequestValue(value: RequestData[string]): boolean {
  return value === undefined || value === null || value === ''
}
