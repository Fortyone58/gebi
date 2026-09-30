# 隔壁：技术栈与架构

## 技术栈

| 层 | 选型 | 用途 |
| --- | --- | --- |
| 前端框架 | React + Vite + TypeScript | 移动端优先的单页 Web App |
| 样式 | Tailwind CSS v4 + @tailwindcss/vite | 通过 Vite 插件生成样式，主题值放在 CSS 的 @theme 中 |
| 路由 | react-router-dom | 列表、详情、发布、看板四个页面 |
| 图标 | lucide-react | 轻量图标库 |
| HTTP 请求 | 原生 fetch + 项目内封装 | 统一处理请求头、错误和身份失效 |
| 前端状态 | useState + 项目内 useApi hook | 覆盖当前页面需要的请求和状态 |
| 后端框架 | FastAPI，全同步 def 接口 | 提供 REST API 与自动生成的 OpenAPI / Swagger UI |
| ORM | SQLAlchemy 2.0 声明式 | 建立四张表和显式 SQL 查询；不使用 relationship() |
| 数据库 | SQLite | 本地单机演示；create_all() 建表，不引入 Alembic |
| LLM | openai SDK 同步客户端 | 可从后端环境配置接入；调用超时 20 秒，并提供规则兜底 |
| 后端依赖 | fastapi、uvicorn[standard]、sqlalchemy、pydantic-settings、openai、python-multipart | API 服务、配置读取与模型调用 |
| 运行工具 | uv / npm | 分别管理后端 Python 环境和前端依赖 |

## 架构分层

~~~mermaid
flowchart LR
  Browser[浏览器：React + TypeScript]
  Vite[Vite 开发服务器与代理]
  API[FastAPI：同步 REST 接口]
  ORM[SQLAlchemy 2.0]
  DB[(SQLite)]
  Browser --> Vite
  Vite -->|/api 请求代理| API
  API --> ORM --> DB
~~~

前端通过相对路径请求 /api，由 Vite 代理到 FastAPI。后端通过 SQLAlchemy 访问 SQLite。LLM 调用由后端服务层完成，密钥只从后端环境配置读取。

## 六项选型决策

1. **熟人场景不做密码登录。** 采用预置住户列表和输入姓名进入，避免把时间花在与邻里闲置流转核心目标无关的密码、会话和找回流程上；写请求用 X-User-Id 识别当前住户。
2. **成交信息折叠进 items。** 单件物品最多送出一次，成交与物品是严格 1:1。合在同一行可避免额外 JOIN 和两表状态不一致，也能用数据库 CHECK 保证送出时间不早于发布时间；本项目不需要独立审计流水。
3. **时间统一存 epoch 整数秒。** 时间间隔、排序和自然月边界都能用整数比较，避免 SQLite 时间文本和前后端时区解析造成偏差。月统计统一按 Asia/Shanghai 自然月在服务端计算边界。
4. **新鲜度不入库。** 新鲜度由 created_at 和当前时间计算，是派生值；持久化后还需要定时刷新，否则会与真实时间逐渐不一致。
5. **后端接口统一使用同步 def。** FastAPI 会把同步接口放入线程池执行。同步 LLM 请求等待时占用一个工作线程，不会像在 async def 中直接调用同步客户端那样阻塞事件循环。
6. **前端依赖保持精简。** 不引入 shadcn/ui、TanStack Query 等额外框架；所需界面用 Tailwind 和 React 状态实现。减少配置和运行时抽象，便于在有限时间内排查并解释行为。

## 数据库设计要点

数据库包含 users、items、wants、messages 四张表。物品关联发布者和可选接收人；wants 与 messages 分别关联住户和物品。所有 created_at / given_away_at 均为 epoch 整数秒。详细字段见 [ER 图](er-diagram.md)。

四条 CHECK 不变量：

| 数据库约束 | 业务含义 |
| --- | --- |
| (trade_mode = 'priced') 与 (price IS NOT NULL) 等价 | 只有标价物品有价格；免费送和随便给不带价格 |
| (status = 'given_away') 与 (given_away_at IS NOT NULL) 等价 | 已送出状态必须有送出时间，未送出时不能有送出时间 |
| given_away_at IS NULL OR given_away_at >= created_at | 送出时间不能早于发布时间 |
| given_to_user_id IS NULL OR status = 'given_away' | 只有已送出的物品可以指定接收人 |

SQLite 外键约束需在每条连接上显式启用 PRAGMA foreign_keys=ON。wants 另有 (item_id, user_id) 唯一约束，保障同一用户对同一物品只产生一条想要记录。

## 已知取舍

- 不做密码登录、评价、举报、信用分和通知：产品定位是熟人间的公告板，不建立交易平台的信用体系。
- 不做图片上传：用按标题生成的品类占位图表达物品，降低存储和接口工作量。
- 不做分页：演示数据量小，列表接口仅保留 limit 上限。
- 不做编辑、删除和撤销送出：保留发布与归档两种主要动作，让状态流转更简单。
- 不做 WebSocket 实时推送：当前使用普通请求刷新页面数据。
- 不单独建立 trades 表：本场景没有审计流水需求，成交字段保留在 items。
- 不使用异步接口：LLM 客户端为同步调用，统一采用同步 def 避免阻塞事件循环。
- 不加入组件库与请求缓存库：减少依赖配置，保持实现可直接解释。

## Swagger UI 截图

截图占位：启动后端后访问 http://127.0.0.1:8000/docs，并在此插入页面截图。

<!-- 在此插入 Swagger UI 截图 -->
