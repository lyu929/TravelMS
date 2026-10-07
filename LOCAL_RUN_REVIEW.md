# TravelMS 本机运行检查

> **历史检查报告：以下结果针对改造前版本。** 后续已修复所列问题并完成 Waypoint 个人版本改造。当前功能、验证结果和启动方式见 [PROJECT_NOTES.md](PROJECT_NOTES.md) 和 [README.md](README.md)。下面的旧文件行号、错误和启动流程仅保留作为原始检查证据。

检查日期：2026-10-06（America/Los_Angeles）

## 结论

可以由一个人在一台电脑上运行。前端、后端和 MySQL 都能放在这台 Mac 上，不需要队友的电脑或远程服务器。一个人通过退出登录、切换普通用户和管理员账户，就能演示两种角色。

但当前版本只能算“能够启动、部分功能可用”，还不能完成 README 描述的完整业务流程。审批按钮、部分费用类别、报表生成存在已复现的错误；后端也没有真正执行用户身份和角色权限检查。

本次没有修改原有业务代码、配置或现有数据库记录。验证使用临时项目副本和独立数据库；比对确认 32 个源码及配置文件与工作区一致。独立测试库采用与当前 `travelms` 一致的表结构，使用虚构用户测试。

## 本机环境与实测结果

| 项目 | 结果 |
| --- | --- |
| Node.js / npm | 本机已有，分别为 26.5.0 / 11.17.0 |
| MySQL | 本机已有 9.6.0，服务监听 127.0.0.1:3306 |
| 当前数据库 | `.env` 指向 `travelms`，包含 users、trips、expenses、reports 四张表 |
| 当前记录数量 | 检查前后均为 1 个用户、1 个行程、0 条费用、0 份报表 |
| 依赖安装 | 临时副本执行 `npm ci` 成功，安装 514 个包 |
| 正式前端构建 | `npm run build` 成功，初始资源约 319.20 kB；有一条非阻断的可选链类型提示 |
| 前后端启动 | 成功；浏览器实际打开页面，并成功登录管理员和普通用户 |
| 注册、登录 | 使用有效密码注册成功；正确密码登录成功，错误密码返回 401 |
| 新建、读取行程 | 填写有效日期可成功创建，状态保存为 `PLANNED` |
| 管理员审批按钮 | 新行程不显示 Approve / Reject |
| 普通用户编辑按钮 | 新行程不显示 Edit / Delete |
| 费用登记 | Transport / Other 可保存；Flight / Hotel / Meals 保存失败 |
| 报表生成 | 接口和页面均失败，返回 report_status 列错误 |
| 自动化测试 | `npm test -- --watch=false` 失败，提示没有找到测试 |

原工作区部分 `node_modules` 文件带有 `compressed,dataless` 标记，是云端占位文件，读取时出现明显停顿。重新安装依赖的临时副本很快完成启动和构建。因此，原文件夹的启动迟缓不能直接等同于源码无法编译。依赖完整下载后，应用本身可本地运行；首次安装依赖需要网络。

## 必须完善的内容

### 1. 统一行程状态，恢复审批流程

前端使用 `Pending`、`Approved`、`Rejected`，后端新建行程固定保存 `PLANNED`，状态接口只接受 `PLANNED`、`APPROVED`、`REJECTED`、`COMPLETED`。

- 前端只在 `t.status === 'Pending'` 时显示审批按钮和普通用户的编辑/删除按钮，因此新建行程没有这些按钮。
- 按前端逻辑发送 `Approved`，状态接口返回 400 / `Invalid status`。
- 按普通用户编辑逻辑发送 `Pending`，当前数据库返回 500 / status 列错误。
- 管理员在 Edit 表单选择 `Approved` 可以通过当前 MySQL 的不区分大小写枚举匹配保存；这个替代路径不能修复专用审批按钮和普通用户编辑流程。

建议让 API 与数据库使用统一常量，例如现有的大写枚举；界面另行显示“待审批、已批准、已拒绝、已完成”。若需要独立的草稿/计划状态和待审批状态，应明确业务状态迁移，并同步表结构和接口。

位置：[前端行程组件](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/app/components/trips/trips.component.ts:91)、[状态接口](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/server.js:132)。

### 2. 统一费用类别

前端选项为 Flight / Hotel / Meals / Transport / Other；数据库只允许 TRANSPORT / FOOD / LODGING / OTHER。

实测 Flight、Hotel、Meals 都返回 500 / `Data truncated for column 'category' at row 1`。Transport 和 Other 因当前数据库的枚举匹配规则可以保存。

可采用以下映射，并让下拉框显示名称与提交值分开：Flight、Transport → TRANSPORT；Hotel → LODGING；Meals → FOOD；Other → OTHER。若课程要求机票和地面交通分别统计，应扩展枚举，而不是合并它们。

位置：[费用下拉框](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/app/components/expenses/expenses.component.ts:43)、[数据库类别](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/fixed_setup.sql:39)。

### 3. 修复报表生成

后端计算费用合计后写入 `Generated`；当前数据库只接受 `PENDING` / `SUBMITTED` / `APPROVED`。即使已有有效费用，生成报表也返回 500 / `Data truncated for column 'report_status' at row 1`，没有保存成功。

需要确定报表生成后的初始状态，并统一后端与数据库。如果还要求报表提交/审批，应补充相应操作和接口，目前只有读取、生成、删除。当前报表界面仅提供列表和费用总额，未实现 PDF/CSV 导出；是否补充导出应以课程要求为准。

位置：[报表生成接口](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/server.js:205)、[数据库报表状态](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/fixed_setup.sql:58)。

### 4. 在后端落实身份、角色和数据归属

目前登录只是校验密码并返回用户资料，前端把资料存在 localStorage。后端没有会话或 token 校验，也没有管理员权限中间件。

独立测试库实测，在不携带任何登录凭证的情况下：

- 可以读取用户、费用、报表列表。
- 可以通过创建用户接口直接指定 `role: 'ADMIN'`，成功创建管理员。
- 可以将行程状态改为 `APPROVED`。
- 可以将一个用户的行程费用归到另一个用户名下。

此外，普通用户费用和报表页面请求所有行程及用户，接口没有按登录身份隔离数据。

需要增加服务端会话或 JWT 校验；公开注册接口固定创建普通用户；管理员专用操作在服务端验证角色；普通用户只访问自己的行程、费用和报表。`user_id`、`generated_by` 应按已验证的身份决定或验证，不能单纯信任请求中传入的数字。

位置：[用户创建接口](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/server.js:55)、[前端身份保存](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/app/services/auth.service.ts:17)。

### 5. 整理数据库初始化及管理员创建

| 文件/配置 | 当前情况 |
| --- | --- |
| `setup.sql`、`.env.example`、README | 使用数据库名 `travelmanagement` |
| 当前 `.env`、`fixed_setup.sql` | 使用数据库名 `travelms` |
| `setup.sql` | users 表缺少后端需要的 password_hash、created_at |
| `fixed_setup.sql` | 有必要字段，但状态/类别与代码不一致；开头执行 DROP TABLE |
| README 管理员示例 | 不填写 password_hash，与当前表的 NOT NULL 约束不兼容 |

需要保留一套明确、完整的初始化方案，并提供不会删除现有数据的升级脚本。提供使用 bcrypt 密码哈希创建演示管理员的方式，统一数据库名、状态、类别和启动说明。

**不要为了启动当前项目直接重跑 `fixed_setup.sql`：它会删除四张现有表及其数据。** 本次测试只在独立库中创建表，未对当前库执行这些删除语句。

位置：[原初始化脚本](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/setup.sql:7)、[另一份初始化脚本](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/fixed_setup.sql:4)。

### 6. 补齐表单校验、错误处理和测试

- 日期在界面中不是必填，但当前数据库要求日期不能为空；空日期提交返回 500。
- 接口接受结束日期早于开始日期、负预算、负费用；应在后端拒绝，并在表单提示具体原因。
- 费用归属与行程所有者不匹配也能保存；需要明确并执行归属规则。
- 修改不存在的行程 ID 仍返回成功；应检查受影响记录并返回 404。
- 重复邮箱、无效值、缺字段等应返回清晰的 400/409 等业务错误，而不是直接暴露数据库错误。
- 测试代码在 `app/app.spec.ts`，但 sourceRoot 与测试配置指向 `src`，没有发现测试；现有测试还断言旧模板标题 `Hello, Sprint2`，与当前界面不一致。

位置：[测试范围](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/tsconfig.spec.json:11)、[旧模板测试](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main/app/app.spec.ts:17)。

## 一个人在当前电脑上如何启动

当前 MySQL 服务和 `travelms` 数据库已经存在，所以不需要重新创建数据库。先确保依赖实际下载到本机；在项目目录执行：

```sh
cd /Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main
npm ci
```

保留现有 `.env` 的正确连接配置，确认数据库名为 `travelms`。不要仅因 README 写着 `travelmanagement` 就切换数据库。

在第一个终端启动后端：

```sh
cd /Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main
npm run server
```

在第二个终端启动前端：

```sh
cd /Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/TravelMS-main
npm start
```

两个终端保持运行，然后打开 [TravelMS 本地页面](http://localhost:4200)。后端 API 在 `http://localhost:3000/api`。不需要全局安装 Angular CLI，也不需要 Docker。

普通账户可在页面注册。管理员需要有带有效密码哈希的 Admin/ADMIN 记录；不能假定 README 中的默认 admin 密码适用于当前数据库。使用自己的现有账户密码，或在完善初始化流程时创建专用演示管理员。

这些步骤能启动应用，但不会自动解决本报告中已确认的功能问题。本次临时前后端服务已停止，独立测试库已清理，正常 MySQL 服务继续运行。

## 修复顺序与验收标准

建议先完成状态、费用类别、报表状态和数据库脚本的统一，使“注册 → 登录 → 新建行程 → 管理员审批 → 登记费用 → 生成费用报表”完整跑通；随后落实后端权限和校验，并让测试覆盖这条流程与越权场景。

验收时至少确认：

1. 从空数据库能按统一说明初始化并创建普通用户和管理员。
2. 普通用户能提交行程，管理员看到审批按钮，批准/拒绝后状态正确。
3. 所有费用类别都能保存，有效费用总额准确；例如 12.50 + 12.50 = 25.00。
4. 报表能成功保存并在刷新后保留。
5. 未登录请求不能读写业务数据，普通用户不能审批、管理其他用户或操作他人的数据。
6. 无效日期、负金额、重复邮箱有明确提示，正式构建与有效自动化测试通过。

收据文件上传、PDF/CSV 导出、搜索筛选、分页、统计看板和邮件通知可按课程 rubric 决定是否增加。没有提供 rubric，因此不能仅根据 README 判定所有课程要求都已满足。

## 页面证据

管理员看到 `PLANNED` 行程，但没有审批按钮：

![管理员行程页面](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/review-evidence/trips.jpg)

实际点击 Generate 后出现报表状态错误：

![报表生成错误](/Users/lvhaolin/Documents/2026Spring/CSC4350_Software_Engineering/TravelMS_/review-evidence/reports.jpg)
