# RedeemHelper

统一的游戏 Key 提取与领取辅助脚本，聚合了 Steam / IndieGala / itch.io。

## 功能概览

- **Steam Key 识别与激活**
  - 复制/选中/点击 Key 时快速激活
  - 支持批量提取并激活页面内所有 Key
  - 支持 Steam 商店页面快捷切换国家/地区
  - 支持在许可证页批量激活 SUB
- **ASF IPC 集成**
  - 可在脚本中直接发送 ASF 指令或执行 `!redeem`
- **IndieGala**
  - 为外部页面中的 IndieGala 链接注入“入库”按钮
  - 菜单支持“入库所有”批量处理
- **itch.io**
  - 为外部页面中的 itch 链接注入“领取”按钮
  - 支持 bundle 页面“后台领取”
  - 菜单支持“提取所有链接”并批量尝试领取

## 安装方式

### 方式 1：直接安装编译产物（推荐）

1. 安装并启用 Tampermonkey（或同类扩展）。
2. 在脚本管理器中导入仓库根目录的 `RedeemHelper.user.js`。
3. 保存后刷新目标页面。

## 使用说明

### 1) 脚本菜单入口

脚本加载后，可在用户脚本菜单中看到：

- `⚙Steam设置`
- `执行ASF指令`
- `入库所有IndieGala链接`
- `入库所有ItchIo链接`

### 2) Steam 使用

- 在包含 Steam Key 的页面中：
  - 复制 Key / 选中 Key / 点击 Key（取决于设置）可触发激活流程。
- 在 `store.steampowered.com/account/registerkey` 页面：
  - 可直接批量激活输入的 Key。
- 在 `store.steampowered.com/account/licenses` 页面：
  - 可输入 SUB 列表（逗号分隔）进行激活。

### 3) ASF 配置与使用

在菜单 `⚙Steam设置` 中配置：

- ASF IPC 协议（默认 `http`）
- ASF IPC 地址（默认 `127.0.0.1`）
- ASF IPC 端口（默认 `1242`）
- ASF IPC 密码
- ASF Bot 名称（可选）
- 启用 ASF 激活

配置后可通过菜单 `执行ASF指令` 发送命令。

### 4) IndieGala 使用

- 在外部页面遇到 `*.indiegala.com` 游戏链接时，脚本会在链接旁注入“入库”按钮。
- 点击按钮可单个入库；使用菜单 `入库所有IndieGala链接` 可批量执行。

### 5) itch.io 使用

- 在支持的外部站点（如 keylol、steamgifts、reddit、isthereanydeal、freegames.codes 等）中，脚本会为 itch 链接注入“领取”按钮。
- 在 itch bundle 页面会出现“后台领取”按钮。
- 使用菜单 `入库所有ItchIo链接` 可从当前页面提取 itch 链接并尝试批量领取。

## 常见问题

### 1. 菜单功能没有出现

- 确认脚本已启用且页面已刷新。
- 确认脚本管理器授予了所需权限。

### 2. Steam 激活失败

- 确认已登录 Steam。
- 部分 Key 可能已使用、区域受限或活动过期。

### 3. ASF 连接失败

- 检查 ASF IPC 是否已开启。
- 检查协议、地址、端口、密码是否正确。
- 确认浏览器到 ASF 服务网络可达。

## 注意事项

- 本项目仅用于提高合法领取/激活流程效率。
- 请遵守各平台条款与当地法律法规。
- 对于失效活动、区域限制、账号限制等情况，脚本无法绕过平台规则。

## Todo

- [ ] 统一http请求方式
