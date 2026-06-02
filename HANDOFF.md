# HANDOFF.md

## 一句话交接

本项目正在构建一个面向 CIO / 技术负责人的 **AI 企业运营框架控制台 demo**，用于验证业务需求如何通过 AI 生成 `Blueprint`，再由 `Blueprint` 驱动表单、审批流、数据沉淀、归档、报表和 Agent/Skills 调用。

## 当前目录

当前工作目录：

```text
/Users/amin/Documents/Codex/2026-05-27/github-skills-skills-star-youtube-summit
```

当前代码目录：

```text
demo/
```

## 已完成内容

### 文档

已完成：

- `TECH_SPEC.md`
- `PRD.md`
- `NEXT_STEPS.md`
- `AGENTS.md`
- `HANDOFF.md`

### 工程

已完成：

- 创建 Vite + React + TypeScript 项目。
- 安装 Vitest。
- 完成第一个 TDD 行为：
  - 默认采购需求可以生成可部署 Blueprint。
- 完成第二个 TDD 行为：
  - Blueprint 可以保存、读取，并设为 active。

### 当前核心文件

- `demo/src/core/blueprint.ts`
- `demo/src/core/blueprint.test.ts`
- `demo/src/core/storage.ts`
- `demo/src/core/storage.test.ts`
- `demo/package.json`

## 当前验证状态

在 `demo/` 目录中运行过：

```bash
npm test
```

结果：

- 2 个测试通过。

运行过：

```bash
npm run build
```

结果：

- 构建通过。

## 下一个最小 TDD 节点

下一步建议写第三个测试：

> Blueprint 的表单 Schema 可以创建一条采购申请实例。

这个测试应该验证外部行为：

- 给定一个 active Blueprint。
- 输入采购申请数据。
- 系统能创建 `RequestInstance`。
- 申请实例包含：
  - `blueprintId`
  - `status`
  - `data`
  - `createdAt`
  - `updatedAt`

注意：

- 不要急着实现 UI。
- 不要急着实现风险分析。
- 不要急着实现审批流。
- 先让“表单 Schema -> 申请实例”跑通。

## 推荐后续顺序

1. 表单 Schema 创建申请实例。
2. RiskAnalysisSkill 根据申请数据计算风险等级。
3. ApprovalRoutingSkill 根据风险等级生成审批路径。
4. WorkflowRuntime 根据审批路径推进流程。
5. ArchiveSkill 在审批完成或拒绝后归档。
6. ReportGenerationSkill 从归档和运行数据生成报表摘要。
7. Agent Activity 记录每个关键 Skill 调用。
8. 最后再补控制台 UI。

## 如果要迁移到另一个项目

### 方式一：迁移完整当前项目

适合场景：

- 想保留文档、demo、测试和当前代码。
- 想从当前进度继续开发。

需要复制这些内容到新项目：

```text
TECH_SPEC.md
PRD.md
NEXT_STEPS.md
AGENTS.md
HANDOFF.md
demo/
```

复制后进入新项目的 `demo/` 目录，运行：

```bash
npm install
npm test
npm run build
```

命令说明：

- `npm install`：根据 `package.json` 安装依赖。最佳实践场景是新机器、新目录或刚复制项目后先运行。
- `npm test`：运行测试。最佳实践场景是确认迁移后核心行为仍然通过。
- `npm run build`：执行生产构建。最佳实践场景是确认项目可以被打包部署。

### 方式二：只迁移设计上下文

适合场景：

- 新项目已经有自己的技术栈。
- 只想迁移产品思路和架构约定。

需要复制：

```text
TECH_SPEC.md
PRD.md
NEXT_STEPS.md
AGENTS.md
HANDOFF.md
```

然后让新项目的 agent 先阅读：

1. `AGENTS.md`
2. `HANDOFF.md`
3. `PRD.md`
4. `TECH_SPEC.md`
5. `NEXT_STEPS.md`

再让它根据新项目技术栈重新制定实施方案。

### 方式三：只迁移 TDD 起步代码

适合场景：

- 新项目已经有 React/Vite 或类似前端项目。
- 只想迁移核心模块。

需要迁移：

```text
demo/src/core/blueprint.ts
demo/src/core/blueprint.test.ts
demo/src/core/storage.ts
demo/src/core/storage.test.ts
```

然后根据新项目的测试框架调整 import 和测试脚本。

## 迁移后的第一句提示词

可以在新 session 或新项目中这样说：

```text
请先阅读 AGENTS.md 和 HANDOFF.md，然后继续按照 TDD 开发 AI 企业运营框架控制台 demo。
当前已完成 Blueprint 生成和 StorageAdapter 的前两个红绿循环。
下一步请从“Blueprint 的表单 Schema 可以创建一条采购申请实例”这个行为测试开始。
保持一次一个测试、RED -> GREEN -> Refactor，不要先做完整 UI。
```

## 迁移时的注意事项

- 不要复制 `node_modules/`，它是依赖安装目录，应该通过 `npm install` 重新生成。
- 不要复制 `dist/`，它是构建产物，应该通过 `npm run build` 重新生成。
- 不要批量删除文件。
- 如果新项目已经有 `package.json`，不要直接覆盖，先比较依赖和脚本。
- 如果新项目已有 `AGENTS.md`，需要合并规则，不要直接覆盖。
- 如果新项目技术栈不是 Vite + React + TypeScript，保留 PRD 和技术规格，重新设计实现层。

## 当前判断

最重要的下一步不是做 UI，而是继续验证核心链路：

```text
Blueprint
  -> RequestInstance
  -> RiskAnalysisSkill
  -> ApprovalRoutingSkill
  -> WorkflowRuntime
  -> ArchiveSkill
  -> ReportGenerationSkill
```

这条链路跑通后，再做框架控制台 UI，展示才会有真实运行数据支撑。

