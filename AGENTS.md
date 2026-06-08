# AGENTS.md

## 用户协作偏好

- 用户不熟悉 GitHub、Python、终端命令和 Linux 命令。
- 如果回答中出现相关命令或代码，需要顺带解释：
  - 这个命令/代码是什么。
  - 目的是什么。
  - 最佳实践使用场景是什么。
- 禁止批量删除文件或目录。
- 不要使用：
  - `del /s`
  - `rd /s`
  - `rmdir /s`
  - `Remove-Item -Recurse`
  - `rm -rf`
- 需要删除文件时，只能一次删除一个明确路径的文件。
- 如果需要批量删除文件，应停止操作，并请求用户手动删除。

## 项目目标

本项目目标是验证一套 **AI-native 企业业务系统框架**，面向 CIO / 技术负责人，而不是先做一个普通采购审批应用。

核心愿景：

> CIO 进入一家新公司后，可以用这套系统快速把业务需求转成可运行的企业流程系统。表单、审批、数据、归档、报表、Agent/Skills 全部通过统一框架协作。

核心目的：

> 让 AI 和人共同参与企业业务协作，并共享同一份可连接、可解释、可审计的业务上下文。系统不把 AI 限制在外挂聊天窗口，也不要求 AI 通过大量碎片化接口重新拼接业务事实；数据、规则、AI 和 Workflow 共同驱动流程，并通过反馈和审计形成闭环。AI 是本系统的一等用户，也是最重要的使用者之一。

第一版 demo 要证明：

- 自然语言业务需求可以生成业务蓝图 `Blueprint`。
- `Blueprint` 可以驱动表单、审批流、风险规则、归档和报表。
- Agent/Skills 是底层能力层。
- AI 可以在权限范围内直接获得结构化业务上下文，包括数据、规则、流程状态、反馈和审计证据。
- 数据通过统一适配器沉淀。
- 当前 mock 层后续可以替换成真实数据库、真实 AI、真实流程引擎和企业集成。

## 当前产品定位

产品名称暂定：

- 中文：AI 企业运营框架控制台
- 英文：AI Enterprise Operating Framework Console

第一版形态：

- 框架控制台 + 一个采购审批样例流程

目标用户：

- CIO
- CTO
- 技术负责人
- 企业架构负责人
- 数字化转型团队

第一版不是面向普通业务用户的完整低代码平台。

## 当前文档

根目录已有三份主要文档：

- `TECH_SPEC.md`：技术规格文档，定义架构、接口、数据结构、模块和验收标准。
- `PRD.md`：中文 PRD，定义问题、解决方案、用户故事、实现决策、测试决策和范围边界。
- `NEXT_STEPS.md`：下一步实施建议，定义工程实现顺序。

## 当前代码状态

当前 demo 位于：

- `demo/`

技术栈：

- Vite
- React
- TypeScript
- Vitest
- LocalStorage 适配器

当前已经完成：

- Vite + React + TypeScript 项目初始化。
- Vitest 测试框架安装。
- 第一个 TDD 红绿循环：
  - 行为：默认采购需求可以生成可部署 Blueprint。
  - 实现：`demo/src/core/blueprint.ts`
  - 测试：`demo/src/core/blueprint.test.ts`
- 第二个 TDD 红绿循环：
  - 行为：Blueprint 可以保存、读取，并设为 active。
  - 实现：`demo/src/core/storage.ts`
  - 测试：`demo/src/core/storage.test.ts`

当前验证结果：

- `npm test` 通过。
- `npm run build` 通过。

## TDD 工作方式

继续开发时必须遵守 TDD 节奏：

1. 一次只写一个行为测试。
2. 先让测试失败，也就是 RED。
3. 写最小实现让测试通过，也就是 GREEN。
4. 所有测试通过后再考虑重构。
5. 测试公共行为，不测试实现细节。
6. 不要一次性写完所有测试再实现。

下一条推荐测试：

> Blueprint 的表单 Schema 可以创建一条采购申请实例。

推荐后续测试顺序：

1. Blueprint 的表单 Schema 可以创建一条采购申请实例。
2. 采购申请可以根据金额、供应商、重复采购、理由完整度得到风险等级。
3. 风险等级可以生成审批路径。
4. WorkflowRuntime 可以把申请从提交推进到归档。
5. 每个关键 Skill 调用会产生 Agent Activity。
6. 归档数据可以生成 AI CEO 报表摘要。

## 核心架构约定

第一版必须围绕以下深模块推进：

- `Blueprint`：业务蓝图，是系统中心契约。
- `StorageAdapter`：数据持久化边界，当前实现为 LocalStorage。
- `AgentRuntime`：AI/Skill 调用边界，后续实现 MockAgentRuntime。
- `SkillRegistry`：Skill 注册与调用能力。
- `WorkflowRuntime`：流程状态推进边界。
- `ReportGenerationSkill`：基于统一数据生成报表摘要。

重要原则：

- UI 组件不能直接承载核心业务逻辑。
- UI 组件不能直接读写 LocalStorage。
- 所有持久化必须经过 `StorageAdapter`。
- 所有 AI/Skill 行为必须经过 `AgentRuntime` 或 Skill 接口。
- 所有流程状态推进必须经过 `WorkflowRuntime`。
- 采购审批只是样例流程，不要把框架写死成采购系统。

## 当前命令

在 `demo/` 目录中运行：

```bash
npm test
```

用途：

- 运行 Vitest 测试。
- 最佳实践场景：每完成一个 TDD 小循环后运行，确认行为仍然正确。

```bash
npm run build
```

用途：

- 执行 TypeScript 编译和 Vite 生产构建。
- 最佳实践场景：确认代码不仅测试通过，也能作为静态网页构建。

```bash
npm run dev
```

用途：

- 启动本地开发服务器。
- 最佳实践场景：需要在浏览器中查看 React 页面效果时使用。

## 第一版暂不做

第一版不要急着实现：

- 真实登录。
- 真实数据库。
- 真实 AI API。
- 真实工作流引擎。
- 真实通知。
- 多租户。
- 多业务模板。
- 复杂权限。
- BPMN 设计器。
- ERP / CRM / OA 集成。

第一版重点是：

> 证明 Blueprint -> Agent/Skills -> WorkflowRuntime -> StorageAdapter -> Archive -> Reports 这条链路跑通。

## Agent skills

### Issue tracker

Issues and PRDs for this repo are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain documentation layout. See `docs/agents/domain.md`.
