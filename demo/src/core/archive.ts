export type ArchiveRecord = {
  id: string
  requestId: string
  finalStatus: 'approved' | 'rejected'
  archivedAt: string
}
