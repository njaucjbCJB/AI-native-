# Demo

这是 AI 企业运营框架控制台的可运行 demo，技术栈是 Vite + React + TypeScript + Vitest。

请在这个 `demo/` 目录里运行 npm 命令。如果你在项目根目录运行 `npm test` 或 `npm run build`，npm 会找不到正确的 `package.json` 脚本。

## 安装依赖

```bash
npm install
```

这个命令会安装 demo 需要的前端依赖。第一次运行项目时需要执行一次；依赖文件变化时也需要再次执行。

## 运行测试

```bash
npm test
```

这个命令会运行 Vitest 测试，验证 Blueprint、RequestInstance、WorkflowRuntime、Agent Activity、Reports 和控制台视图模型等核心行为。

## 构建

```bash
npm run build
```

这个命令会运行 TypeScript 编译和 Vite 生产构建，用来确认 demo 可以生成静态网页产物。

## 本地启动

```bash
npm run dev
```

这个命令会启动本地开发服务器。终端会显示一个地址，例如 `http://localhost:5173/`。用浏览器打开后，可以测试：

- 左侧 8 个控制台视图。
- Runtime 采购申请提交。
- 审批角色切换、批准和拒绝。
- Reports 指标和 AI CEO 摘要。
- Agent Activity 调用记录。

## 不要提交

不要提交：

- `node_modules/`
- `dist/`
- `.env`
- `.env.*`

这些文件和目录已经由项目 `.gitignore` 排除。
