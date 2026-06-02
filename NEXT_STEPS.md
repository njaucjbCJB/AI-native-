# 下一步实施建议

## 1. 当前状态

当前项目已经完成两份设计文档：

- 技术规格文档：定义核心架构、接口、模块和验收标准。
- PRD：定义用户问题、解决方案、用户故事、实现决策、测试决策和范围边界。

当前还没有应用代码。

下一步应该进入第一版 demo 的工程实现，但不要一次性做完整 UI。最佳实践是先实现核心运行链路，再补控制台可视化。

## 2. 推荐下一步

建议下一步创建 Vite + React + TypeScript 项目骨架，并完成“架构最小闭环”。

第一轮只实现：

- 核心 TypeScript 类型。
- LocalStorageAdapter。
- MockAgentRuntime。
- SkillRegistry。
- LightweightWorkflowRuntime。
- 默认采购审批 Blueprint 生成。
- 动态表单提交。
- 风险分析。
- 审批路由。
- 审批、拒绝、归档。
- Agent Activity 记录。

先不要急着做完整美观 UI。

## 3. 第一阶段实施任务

### 3.1 初始化前端项目

目标：

- 创建 Vite + React + TypeScript 项目。
- 安装基础依赖。
- 建立清晰目录结构。

建议目录模块：

- core types
- storage
- agent
- skills
- workflow
- reports
- ui views

### 3.2 定义核心类型

目标：

- 把 PRD 和技术规格里的核心契约先固化成 TypeScript 类型。

优先定义：

- Blueprint
- EntitySchema
- FormField
- WorkflowDefinition
- WorkflowNode
- RiskRule
- RequestInstance
- ApprovalRecord
- AgentActivity
- StorageAdapter
- AgentRuntime
- WorkflowRuntime

### 3.3 实现 LocalStorageAdapter

目标：

- 所有持久化都通过 StorageAdapter。
- UI 不直接读写 LocalStorage。

需要支持：

- 保存和读取 Blueprint。
- 设置当前启用 Blueprint。
- 保存和读取申请实例。
- 保存和读取 Agent Activity。
- 重置 demo 数据。

### 3.4 实现 MockAgentRuntime 和 Skills

目标：

- 用 Mock 方式模拟 AI 生成和 Skill 调用。
- 每次调用记录 Agent Activity。

第一批 Skills：

- RequirementParsingSkill
- BlueprintGenerationSkill
- RiskAnalysisSkill
- ApprovalRoutingSkill
- ArchiveSkill
- ReportGenerationSkill

### 3.5 实现 LightweightWorkflowRuntime

目标：

- 根据 Blueprint 和 Skill 输出推进流程。

需要支持：

- 创建申请。
- 计算风险。
- 生成审批路径。
- 当前审批人批准。
- 当前审批人拒绝。
- 流程完成后归档。

### 3.6 实现最小 UI

目标：

- 不追求完整设计，先验证系统能操作。

最小 UI 包括：

- 生成 Blueprint 按钮。
- 部署 Blueprint 按钮。
- 动态采购申请表。
- 角色切换。
- 审批操作区。
- 归档列表。
- Agent Activity 面板。
- 简单报表区。

## 4. 第二阶段实施任务

当核心链路跑通后，再补框架控制台完整视图：

- Blueprints
- Data Model
- Form Schema
- Workflow
- Agent & Skills
- Runtime
- Reports
- Architecture

这一阶段重点是让 CIO/技术负责人理解系统架构，而不是增加业务复杂度。

## 5. 第三阶段验证任务

完成第一版 demo 后，建议验证以下问题：

- Blueprint 是否足够表达采购审批流程？
- StorageAdapter 是否能平滑替换真实数据库？
- AgentRuntime 是否能平滑替换真实 AI API？
- WorkflowRuntime 是否能表达常见审批流？
- Agent Activity 是否足够解释 AI 的行为？
- 控制台是否能让技术负责人理解系统价值？
- 采购审批是否足以证明框架闭环？

## 6. 后续技术选型验证

第一版 demo 跑通后，再做这些技术验证：

- 真实数据库优先比较 PostgreSQL 与 Supabase。
- 真实 AI 层优先验证 OpenAI structured output 或工具调用。
- 真实流程层比较 Flowable、Camunda、Temporal。
- 企业通知优先验证飞书或企业微信。
- 报表层优先验证 SQL 生成和图表生成。

## 7. 推荐实施顺序

1. 初始化 Vite + React + TypeScript。
2. 定义核心类型。
3. 实现 LocalStorageAdapter。
4. 实现 MockAgentRuntime。
5. 实现 RiskAnalysisSkill。
6. 实现 ApprovalRoutingSkill。
7. 实现 LightweightWorkflowRuntime。
8. 实现最小 UI 跑通申请和审批。
9. 实现归档和报表。
10. 实现 Agent Activity 面板。
11. 补完整框架控制台视图。
12. 构建静态站点并本地验证。

## 8. 第一轮验收标准

第一轮实现完成后，必须能演示：

- 生成采购审批 Blueprint。
- 部署 Blueprint。
- 提交采购申请。
- 自动分析风险。
- 自动生成审批路径。
- 用角色切换模拟审批。
- 审批完成后归档。
- 从本地数据生成报表。
- 右侧显示 Agent/Skill 调用记录。
- 刷新页面后数据仍然存在。

## 9. 注意事项

- 不要先做复杂 UI。
- 不要先接真实数据库。
- 不要先接真实 AI。
- 不要先接真实工作流引擎。
- 不要扩展多个业务流程。
- 不要让 UI 组件直接承载业务逻辑。

第一阶段的关键是证明：

> Blueprint -> Agent/Skills -> WorkflowRuntime -> StorageAdapter -> Reports 这条链路能跑通。

