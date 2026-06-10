# LangGraph 作为复杂 Skill 编排层，而不是主业务 Workflow 引擎

状态：已接受

系统采用 `Workflow Runtime` 管理企业业务流程、人工任务、审批、驳回和业务实例状态；采用 `Skill Runtime` 统一执行 Skill，并允许复杂 Skill 内部使用 LangGraph 进行多步骤 Agent 编排、工具调用、条件分支、检查点恢复和 Human-in-the-loop 中断。LangGraph 不作为 Business Instance 的主状态账本，也不直接承载企业审批主流程；它被包装为 `LangGraph Skill`，通过 Skill Run 输出结果，并由 Acceptance Module 与 Audit Evidence 纳入统一业务上下文。这样可以利用 LangGraph 的 Agent 编排能力，同时避免业务 Workflow、权限、审计和报表被 Agent 内部状态绑架。
