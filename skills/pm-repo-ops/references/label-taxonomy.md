# 标签体系

## 类型（必选 1 个）

| 标签 | 含义 |
|---|---|
| `type:bug` | 行为与预期不符 |
| `type:feature` | 新能力或增强 |
| `type:question` | 使用疑问 |
| `type:docs` | 文档缺失或错误 |
| `type:security` | 安全问题（不公开讨论） |

## 状态（必选 1 个）

| 标签 | 含义 |
|---|---|
| `triage:pending` | 待判定 |
| `triage:needs-info` | 等补充信息 |
| `triage:accepted` | 接受，待排期 |
| `triage:backlog` | 有价值但暂不排 |
| `ops:processing` | 处理中（锁） |

## 优先级（0–1 个）

`p0` 线上不可用 / 安全问题；`p1` 核心流程受阻；`p2` 一般。

## 规则

- 不加无意义标签。
- 人类已设置的标签不擅自改回。
- 同一 issue 类型标签只能有一个。
- 标签是状态机，不是装饰。
