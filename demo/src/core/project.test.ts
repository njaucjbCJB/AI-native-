import { describe, expect, it } from 'vitest'
import { initializeProjectRegistry, type Project } from './project'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Project registry', () => {
  it('stores and reads a project through the storage adapter', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const project = createProject()

    await storage.saveProject(project)

    await expect(storage.getProjects()).resolves.toEqual([project])
  })

  it('updates an existing project without creating a duplicate', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const project = createProject()

    await storage.saveProject(project)
    await storage.saveProject({
      ...project,
      name: 'Enterprise Data & AI Platform',
      currentCost: 1_050_000,
    })

    await expect(storage.getProjects()).resolves.toEqual([
      {
        ...project,
        name: 'Enterprise Data & AI Platform',
        currentCost: 1_050_000,
      },
    ])
  })

  it('initializes an empty registry with three demo projects', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())

    const projects = await initializeProjectRegistry(storage)

    expect(projects).toHaveLength(3)
    expect(new Set(projects.map((project) => project.owner)).size).toBe(3)
    expect(new Set(projects.map((project) => project.supervisingVp)).size).toBe(3)
    await expect(storage.getProjects()).resolves.toEqual(projects)
  })
})

function createProject(): Project {
  return {
    id: 'project-1',
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
        id: 'milestone-1',
        name: 'Data governance foundation',
        plannedCompletionDate: '2026-06-30',
      },
    ],
  }
}
