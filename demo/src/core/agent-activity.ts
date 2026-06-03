export type AgentActivityStatus = 'success' | 'failed'

export type AgentActivity = {
  id: string
  skillName: string
  inputSummary: string
  outputSummary: string
  status: AgentActivityStatus
  createdAt: string
}
