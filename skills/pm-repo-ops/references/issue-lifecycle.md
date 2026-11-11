# Issue 生命周期

```text
new → triage:pending
      ├─ needs-info ──(14 天无回应)──> closed:invalid
      ├─ duplicate ──> closed:duplicate
      ├─ decline ──> closed:not planned
      ├─ backlog ──(优先级提升)──> accepted
      └─ accepted ──> milestone → in progress → released → closed:completed
```

## 关闭原因

| 原因 | 何时用 | 必须写 |
|---|---|---|
| completed | 已发布并验证 | 版本 / PR 链接 |
| duplicate | 已有 canonical | canonical 链接 |
| not planned | 明确不做 | 理由 + 重开条件 |
| invalid | 无法复现 / 信息不足 | 缺什么 |
| stale | 长期无回应 | 最后回应日期 |

## 规则

- 关闭必须有一条评论说明原因。
- 批量关闭、静默关闭一律禁止。
- `needs-info` 关闭前至少提醒一次。
- 安全 issue 不公开关闭，走私密渠道。
