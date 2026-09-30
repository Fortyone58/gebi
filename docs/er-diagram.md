# 隔壁：数据库 ER 图

本图按开发文档 §3.1 / §3.2 列出四张表的全部字段和 SQLite 类型。字段约束摘要见图后说明。

~~~mermaid
erDiagram
  users ||--o{ items : "owner_id 发布"
  users o|--o{ items : "given_to_user_id 接收"
  users ||--o{ wants : "表达想要"
  users ||--o{ messages : "留言"
  items ||--o{ wants : "被想要"
  items ||--o{ messages : "留言板"

  users {
    INTEGER id PK
    TEXT name UK
    TEXT room_no
    TEXT avatar_emoji
    INTEGER created_at
  }
  items {
    INTEGER id PK
    INTEGER owner_id FK
    TEXT title
    TEXT description
    TEXT image_url
    TEXT trade_mode
    INTEGER price
    TEXT status
    INTEGER created_at
    INTEGER given_away_at
    INTEGER given_to_user_id FK
  }
  wants {
    INTEGER id PK
    INTEGER item_id FK
    INTEGER user_id FK
    INTEGER created_at
  }
  messages {
    INTEGER id PK
    INTEGER item_id FK
    INTEGER user_id FK
    TEXT content
    INTEGER created_at
  }
~~~

## 约束摘要

- users.name 唯一；物品标题、描述、留言内容有长度约束。
- items.trade_mode 只能是 free、pay_what_you_want、priced；status 只能是 available、given_away。
- 仅 priced 物品有 price；已送出状态与 given_away_at 同时设置；送出时间不早于发布时间；接收人只能关联已送出的物品。
- wants 对 (item_id, user_id) 唯一，避免同一住户重复表达想要。
- 数据库时间字段统一为 epoch 整数秒。
