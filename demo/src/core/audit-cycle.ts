export type AuditCycleStatus = 'draft' | 'started' | 'closed'

export type AuditCycle = {
  id: string
  name: string
  startDate: string
  endDate: string
  status: AuditCycleStatus
  projectIds: string[]
  createdAt: string
  updatedAt: string
}

type AuditCycleStorage = {
  getAuditCycles(): Promise<AuditCycle[]>
  saveAuditCycle(cycle: AuditCycle): Promise<void>
}

type CreateAuditCycleInput = Pick<AuditCycle, 'name' | 'startDate' | 'endDate'>

type AuditCycleOptions = {
  id?: () => string
  now?: () => Date
}

export async function createDraftAuditCycle(
  storage: AuditCycleStorage,
  input: CreateAuditCycleInput,
  options: AuditCycleOptions = {},
): Promise<AuditCycle> {
  const timestamp = (options.now ?? (() => new Date()))().toISOString()
  const cycle: AuditCycle = {
    id: (options.id ?? (() => crypto.randomUUID()))(),
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'draft',
    projectIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await storage.saveAuditCycle(cycle)

  return cycle
}

export async function updateAuditScope(
  storage: AuditCycleStorage,
  cycleId: string,
  projectIds: string[],
  options: Pick<AuditCycleOptions, 'now'> = {},
): Promise<AuditCycle> {
  const cycles = await storage.getAuditCycles()
  const cycle = cycles.find((candidate) => candidate.id === cycleId)

  if (!cycle) {
    throw new Error(`Audit cycle ${cycleId} was not found.`)
  }

  if (cycle.status !== 'draft') {
    throw new Error('Audit scope can only be changed while the cycle is a draft.')
  }

  const updatedCycle: AuditCycle = {
    ...cycle,
    projectIds: [...new Set(projectIds)],
    updatedAt: (options.now ?? (() => new Date()))().toISOString(),
  }

  await storage.saveAuditCycle(updatedCycle)

  return updatedCycle
}
