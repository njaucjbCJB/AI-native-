# AI-native 企业业务系统框架

这是一个面向 CIO / 技术负责人的 AI 企业运营框架 demo。第一版用采购审批流程证明：

- Blueprint 可以驱动表单、风险规则、审批流、归档和报表。
- Runtime 可以提交申请并推进审批状态。
- Agent / Skills 调用会形成 Agent Activity 记录。
- Reports 可以从运行数据生成采购指标和 AI CEO 摘要。

## 重要目录

- `demo/`：可运行的 Vite + React + TypeScript demo。
- `demo/src/core/`：核心业务边界，包括 Blueprint、StorageAdapter、Runtime、Workflow、Agent Activity 和 Reports。
- `PRD.md`、`TECH_SPEC.md`、`NEXT_STEPS.md`：产品、技术和后续实施文档。

## 第一次运行

所有 npm 命令都必须先进入 `demo/` 目录再执行。

```bash
cd demo
```

这个命令的意思是切换当前终端所在目录。目的：进入真正的前端项目目录，因为 `package.json` 在 `demo/` 里面。最佳实践场景：运行 `npm install`、`npm test`、`npm run build`、`npm run dev` 前都先确认自己在正确项目目录。

```bash
npm install
```

这个命令的意思是根据 `demo/package-lock.json` 安装项目依赖。目的：把 React、Vite、TypeScript、Vitest 等开发和运行需要的包安装到本机。最佳实践场景：第一次拉取项目后运行一次；以后依赖变化时再运行。

```bash
npm test
```

这个命令的意思是运行 Vitest 自动化测试。目的：确认核心业务行为仍然正确。最佳实践场景：每完成一个 TDD 小循环、提交代码前、交付验证前运行。

```bash
npm run build
```

这个命令的意思是先执行 TypeScript 编译，再用 Vite 生成生产版静态文件。目的：确认代码不仅测试通过，也能被正式构建。最佳实践场景：提交前、部署前、交付验收前运行。

```bash
npm run dev
```

这个命令的意思是启动本地开发服务器。目的：在浏览器里打开 demo，手动测试 Runtime、Reports、Agent Activity 和 8 个控制台视图。最佳实践场景：需要看界面、点击流程、演示 demo 时运行。

启动后，终端通常会显示一个本地地址，例如：

```text
http://localhost:5173/
```

用浏览器打开这个地址即可。

## 不要提交的目录

不要提交这些目录或文件：

- `node_modules/`：本机安装出来的依赖目录，体积很大，可以通过 `npm install` 重新生成。
- `dist/`：`npm run build` 生成的构建产物，可以重新构建生成。
- `.env`、`.env.*`：本地环境变量文件，可能包含密钥。

这些规则已经写在 `.gitignore` 里。正常情况下 Git 不会提交它们。

## 当前验证命令

交付前在 `demo/` 目录运行：

```bash
npm test
npm run build
```

两条命令都通过后，再运行：

```bash
npm run dev
```

然后在浏览器中逐个检查 8 个视图，并提交一条采购申请，确认 Reports 和 Agent Activity 会更新。
