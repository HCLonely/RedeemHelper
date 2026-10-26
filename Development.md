# 开发说明

## 环境与依赖

Node.js 版本要求：20.19+（20.x）、22.13+（22.x）或 24+。在项目根目录执行 `npm ci` 安装依赖。

构建本身无需配置环境变量。Steam 登录状态及 ASF IPC 配置由用户在浏览器中提供。

## 本地运行与构建

```bash
npm run build     # 更新 ASF 命令快照并构建用户脚本
```

构建入口为 `src/main.ts`，输出为根目录 `RedeemHelper.user.js`。在浏览器脚本管理器中安装或更新该文件，再刷新目标页面验证；本项目没有本地开发服务器。

构建会通过网络更新 ASF 命令快照，相关逻辑位于 `scripts/update-asf-commands.mjs`；只验证现有源码打包时可执行 `node esbuild.config.cjs`。

## 代码检查

```bash
npm run lint       # 检查 TypeScript 源码和 JavaScript 构建脚本
npm run lint:fix   # 自动修复可修复的 ESLint 问题
npm run typecheck  # TypeScript 类型检查
npm test          # 依次运行 ESLint、类型检查和构建
```

ESLint 使用 `eslint.config.mjs` 中的推荐规则，排除构建产物 `RedeemHelper.user.js`、`*.generated.ts` 自动生成文件及本地忽略目录。

## 排错与手动验证

- 依赖安装或 ESLint 启动失败时，先确认 Node.js 版本满足要求，再执行 `npm ci`。
