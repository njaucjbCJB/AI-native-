import { describe, expect, it } from 'vitest'
import { createDraftAuditCycle, updateAuditScope } from './audit-cycle'
import { LocalStorageAdapter, MemoryStorage } from './storage'

describe('Audit cycle', () => {
  it('creates and stores a draft audit cycle', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())

    const cycle = await createDraftAuditCycle(
      storage,
      {
        name: '2026 Q3 Project Audit',
        startDate: '2026-07-01',
        endDate: '2026-09-30',
      },
      {
        id: () => 'audit-cycle-q3-2026',
        now: () => new Date('2026-06-07T03:30:00.000Z'),
      },
    )

    expect(cycle).toEqual({
      id: 'audit-cycle-q3-2026',
      name: '2026 Q3 Project Audit',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      status: 'draft',
      projectIds: [],
      createdAt: '2026-06-07T03:30:00.000Z',
      updatedAt: '2026-06-07T03:30:00.000Z',
    })
    await expect(storage.getAuditCycles()).resolves.toEqual([cycle])
  })

  it('updates a draft cycle with multiple projects in its audit scope', async () => {
    const storage = new LocalStorageAdapter(new MemoryStorage())
    const cycle = await createDraftAuditCycle(
      storage,
      {
        name: '2026 Q3 Project Audit',
        startDate: '2026-07-01',
        endDate: '2026-09-30',
      },
      {
        id: () => 'audit-cycle-q3-2026',
        now: () => new Date('2026-06-07T03:30:00.000Z'),
      },
    )

    const updatedCycle = await updateAuditScope(
      storage,
      cycle.id,
      ['project-data-platform', 'project-customer-portal'],
      {
        now: () => new Date('2026-06-07T04:00:00.000Z'),
      },
    )

    expect(updatedCycle.projectIds).toEqual([
      'project-data-platform',
      'project-customer-portal',
    ])
    expect(updatedCycle.updatedAt).toBe('2026-06-07T04:00:00.000Z')
    await expect(storage.getAuditCycles()).resolves.toEqual([updatedCycle])
  })
})
