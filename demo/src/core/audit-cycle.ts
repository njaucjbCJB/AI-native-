import type { ProjectAuditBlueprint } from './project-audit-blueprint'
import type { Project, ProjectMilestone } from './project'

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

export type ProjectSnapshot = {
  projectCode: string
  projectName: string
  projectOwner: string
  supervisingVp: string
  department: string
  plannedStartDate: string
  plannedEndDate: string
  strategicObjective: string
  approvedBudget: number
  currentCost: number
  milestones: ProjectMilestone[]
}

export type MilestoneAssessment = {
  name: string
  plannedDate: string
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
  completionPercentage: number
  actualSituation: string
}

export type StrategicObjectiveAssessment = {
  objective: string
  weight: number
  completionPercentage: number
  actualSituation: string
}

export type ProjectAuditFormData = {
  projectSnapshot: ProjectSnapshot
  milestoneAssessments: MilestoneAssessment[]
  strategicObjectiveAssessments: StrategicObjectiveAssessment[]
  executionPerformance: {
    approvedBudget: number
    actualCost: number
    estimatedCostAtCompletion: number
    budgetVariance: number
    varianceExplanation: string
  }
  risksAndIssues: string
  correctiveActionPlan: string
  ownerSummary: string
}

export type ProjectAuditInstanceStatus =
  | 'draft'
  | 'owner_self_approval'
  | 'vp_approval'
  | 'ai_ceo_approval'
  | 'rework'
  | 'approved'

export type ProjectAuditInstance = {
  id: string
  cycleId: string
  projectId: string
  blueprintId: ProjectAuditBlueprint['id']
  blueprintVersion: number
  status: ProjectAuditInstanceStatus
  projectSnapshot: ProjectSnapshot
  formData: ProjectAuditFormData
  createdAt: string
  updatedAt: string
}

type ProjectAuditInstanceStorage = AuditCycleStorage & {
  getActiveBlueprintVersion(): Promise<ProjectAuditBlueprint | null>
  getProjectAuditInstances(): Promise<ProjectAuditInstance[]>
  getProjects(): Promise<Project[]>
  saveProjectAuditInstance(instance: ProjectAuditInstance): Promise<void>
}

type CreateAuditCycleInput = Pick<AuditCycle, 'name' | 'startDate' | 'endDate'>

type AuditCycleOptions = {
  id?: () => string
  now?: () => Date
}

type StartAuditCycleOptions = {
  id?: (projectId: string) => string
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

export async function startAuditCycle(
  storage: ProjectAuditInstanceStorage,
  cycleId: string,
  options: StartAuditCycleOptions = {},
): Promise<{ cycle: AuditCycle; instances: ProjectAuditInstance[] }> {
  const cycles = await storage.getAuditCycles()
  const cycle = cycles.find((candidate) => candidate.id === cycleId)

  if (!cycle) {
    throw new Error(`Audit cycle ${cycleId} was not found.`)
  }

  if (cycle.status !== 'draft') {
    throw new Error('Only a draft audit cycle can be started.')
  }

  const blueprint = await storage.getActiveBlueprintVersion()

  if (!blueprint || blueprint.version === null) {
    throw new Error('A deployed active Blueprint version is required.')
  }

  const [projects, existingInstances] = await Promise.all([
    storage.getProjects(),
    storage.getProjectAuditInstances(),
  ])
  const timestamp = (options.now ?? (() => new Date()))().toISOString()
  const instances = cycle.projectIds.map((projectId) => {
    const project = projects.find((candidate) => candidate.id === projectId)

    if (!project) {
      throw new Error(`Project ${projectId} was not found.`)
    }

    const duplicate = existingInstances.some(
      (instance) => instance.cycleId === cycle.id && instance.projectId === project.id,
    )

    if (duplicate) {
      throw new Error(
        `Project ${project.id} already has an audit instance in cycle ${cycle.id}.`,
      )
    }

    return createProjectAuditInstance(project, cycle, blueprint, timestamp, options)
  })

  const startedCycle: AuditCycle = {
    ...cycle,
    status: 'started',
    updatedAt: timestamp,
  }

  for (const instance of instances) {
    await storage.saveProjectAuditInstance(instance)
  }

  await storage.saveAuditCycle(startedCycle)

  return { cycle: startedCycle, instances }
}

export async function addProjectsToStartedAuditCycle(
  storage: ProjectAuditInstanceStorage,
  cycleId: string,
  projectIds: string[],
  options: StartAuditCycleOptions = {},
): Promise<{ cycle: AuditCycle; instances: ProjectAuditInstance[] }> {
  const cycles = await storage.getAuditCycles()
  const cycle = cycles.find((candidate) => candidate.id === cycleId)

  if (!cycle) {
    throw new Error(`Audit cycle ${cycleId} was not found.`)
  }

  if (cycle.status !== 'started') {
    throw new Error('Projects can only be added to a started audit cycle.')
  }

  const blueprint = await storage.getActiveBlueprintVersion()

  if (!blueprint || blueprint.version === null) {
    throw new Error('A deployed active Blueprint version is required.')
  }

  const [projects, existingInstances] = await Promise.all([
    storage.getProjects(),
    storage.getProjectAuditInstances(),
  ])
  const newProjectIds = [...new Set(projectIds)].filter(
    (projectId) => !cycle.projectIds.includes(projectId),
  )
  const timestamp = (options.now ?? (() => new Date()))().toISOString()
  const instances = newProjectIds.map((projectId) => {
    const project = projects.find((candidate) => candidate.id === projectId)

    if (!project) {
      throw new Error(`Project ${projectId} was not found.`)
    }

    const duplicate = existingInstances.some(
      (instance) => instance.cycleId === cycle.id && instance.projectId === project.id,
    )

    if (duplicate) {
      throw new Error(
        `Project ${project.id} already has an audit instance in cycle ${cycle.id}.`,
      )
    }

    return createProjectAuditInstance(project, cycle, blueprint, timestamp, options)
  })

  const updatedCycle: AuditCycle = {
    ...cycle,
    projectIds: [...cycle.projectIds, ...newProjectIds],
    updatedAt: timestamp,
  }

  for (const instance of instances) {
    await storage.saveProjectAuditInstance(instance)
  }

  await storage.saveAuditCycle(updatedCycle)

  return { cycle: updatedCycle, instances }
}

export async function removeProjectsFromStartedAuditCycle(
  storage: ProjectAuditInstanceStorage,
  cycleId: string,
  projectIds: string[],
  options: Pick<AuditCycleOptions, 'now'> = {},
): Promise<AuditCycle> {
  const cycles = await storage.getAuditCycles()
  const cycle = cycles.find((candidate) => candidate.id === cycleId)

  if (!cycle) {
    throw new Error(`Audit cycle ${cycleId} was not found.`)
  }

  if (cycle.status !== 'started') {
    throw new Error('Projects can only be removed from a started audit cycle.')
  }

  const instances = await storage.getProjectAuditInstances()
  const projectIdsToRemove = new Set(projectIds)
  const startedInstances = instances.filter(
    (instance) =>
      instance.cycleId === cycle.id &&
      projectIdsToRemove.has(instance.projectId) &&
      instance.status !== 'draft',
  )

  if (startedInstances.length > 0) {
    throw new Error('Projects with started audit instances cannot be removed.')
  }

  const updatedCycle: AuditCycle = {
    ...cycle,
    projectIds: cycle.projectIds.filter((projectId) => !projectIdsToRemove.has(projectId)),
    updatedAt: (options.now ?? (() => new Date()))().toISOString(),
  }

  await storage.saveAuditCycle(updatedCycle)

  return updatedCycle
}

export async function closeAuditCycle(
  storage: AuditCycleStorage,
  cycleId: string,
  options: Pick<AuditCycleOptions, 'now'> = {},
): Promise<AuditCycle> {
  const cycles = await storage.getAuditCycles()
  const cycle = cycles.find((candidate) => candidate.id === cycleId)

  if (!cycle) {
    throw new Error(`Audit cycle ${cycleId} was not found.`)
  }

  if (cycle.status !== 'started') {
    throw new Error('Only a started audit cycle can be closed.')
  }

  const closedCycle: AuditCycle = {
    ...cycle,
    status: 'closed',
    updatedAt: (options.now ?? (() => new Date()))().toISOString(),
  }

  await storage.saveAuditCycle(closedCycle)

  return closedCycle
}

function createProjectAuditInstance(
  project: Project,
  cycle: AuditCycle,
  blueprint: ProjectAuditBlueprint,
  timestamp: string,
  options: StartAuditCycleOptions,
): ProjectAuditInstance {
  const projectSnapshot = createProjectSnapshot(project)

  return {
    id: (options.id ?? (() => crypto.randomUUID()))(project.id),
    cycleId: cycle.id,
    projectId: project.id,
    blueprintId: blueprint.id,
    blueprintVersion: blueprint.version ?? 0,
    status: 'draft',
    projectSnapshot,
    formData: createPrefilledAuditFormData(projectSnapshot),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function createProjectSnapshot(project: Project): ProjectSnapshot {
  return cloneJson({
    projectCode: project.code,
    projectName: project.name,
    projectOwner: project.owner,
    supervisingVp: project.supervisingVp,
    department: project.department,
    plannedStartDate: project.plannedStartDate,
    plannedEndDate: project.plannedEndDate,
    strategicObjective: project.strategicObjective,
    approvedBudget: project.approvedBudget,
    currentCost: project.currentCost,
    milestones: project.milestones,
  })
}

function createPrefilledAuditFormData(
  projectSnapshot: ProjectSnapshot,
): ProjectAuditFormData {
  return {
    projectSnapshot: cloneJson(projectSnapshot),
    milestoneAssessments: projectSnapshot.milestones.map((milestone) => ({
      name: milestone.name,
      plannedDate: milestone.plannedCompletionDate,
      status: 'not_started',
      completionPercentage: 0,
      actualSituation: '',
    })),
    strategicObjectiveAssessments: [
      {
        objective: projectSnapshot.strategicObjective,
        weight: 100,
        completionPercentage: 0,
        actualSituation: '',
      },
    ],
    executionPerformance: {
      approvedBudget: projectSnapshot.approvedBudget,
      actualCost: projectSnapshot.currentCost,
      estimatedCostAtCompletion: projectSnapshot.currentCost,
      budgetVariance: projectSnapshot.currentCost - projectSnapshot.approvedBudget,
      varianceExplanation: '',
    },
    risksAndIssues: '',
    correctiveActionPlan: '',
    ownerSummary: '',
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
