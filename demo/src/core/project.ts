export type ProjectMilestone = {
  id: string
  name: string
  plannedCompletionDate: string
}

export type Project = {
  id: string
  code: string
  name: string
  owner: string
  supervisingVp: string
  department: string
  plannedStartDate: string
  plannedEndDate: string
  strategicObjective: string
  approvedBudget: number
  currentCost: number
  milestones: ProjectMilestone[]
}

type ProjectRegistryStorage = {
  getProjects(): Promise<Project[]>
  saveProject(project: Project): Promise<void>
}

export async function initializeProjectRegistry(
  storage: ProjectRegistryStorage,
): Promise<Project[]> {
  const existingProjects = await storage.getProjects()

  if (existingProjects.length > 0) {
    return existingProjects
  }

  for (const project of DEMO_PROJECTS) {
    await storage.saveProject(project)
  }

  return storage.getProjects()
}

const DEMO_PROJECTS: Project[] = [
  {
    id: 'project-data-platform',
    code: 'PRJ-001',
    name: 'Enterprise Data Platform',
    owner: 'Alice Chen',
    supervisingVp: 'Victor Zhao',
    department: 'Technology',
    plannedStartDate: '2026-01-15',
    plannedEndDate: '2026-12-15',
    strategicObjective: 'Create a governed enterprise data foundation.',
    approvedBudget: 2_000_000,
    currentCost: 850_000,
    milestones: [
      {
        id: 'milestone-data-governance',
        name: 'Data governance foundation',
        plannedCompletionDate: '2026-06-30',
      },
      {
        id: 'milestone-analytics-release',
        name: 'Self-service analytics release',
        plannedCompletionDate: '2026-10-31',
      },
    ],
  },
  {
    id: 'project-customer-portal',
    code: 'PRJ-002',
    name: 'Customer Service Portal',
    owner: 'Brian Liu',
    supervisingVp: 'Sophia Wang',
    department: 'Customer Operations',
    plannedStartDate: '2026-02-01',
    plannedEndDate: '2026-09-30',
    strategicObjective: 'Improve customer service speed and transparency.',
    approvedBudget: 1_200_000,
    currentCost: 620_000,
    milestones: [
      {
        id: 'milestone-portal-pilot',
        name: 'Pilot customer launch',
        plannedCompletionDate: '2026-07-15',
      },
    ],
  },
  {
    id: 'project-supply-chain',
    code: 'PRJ-003',
    name: 'Supply Chain Resilience',
    owner: 'Carol Zhang',
    supervisingVp: 'Daniel Xu',
    department: 'Operations',
    plannedStartDate: '2026-03-01',
    plannedEndDate: '2027-02-28',
    strategicObjective: 'Reduce supply risk and improve delivery continuity.',
    approvedBudget: 3_500_000,
    currentCost: 940_000,
    milestones: [
      {
        id: 'milestone-supplier-assessment',
        name: 'Critical supplier assessment',
        plannedCompletionDate: '2026-08-31',
      },
    ],
  },
]
