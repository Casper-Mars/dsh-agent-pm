# AGENTS.md - dsh-agent-pm

面向在本仓库工作的 agent 的最小硬规则。当前为任务-01 骨架占位，由任务-05 完善。

## 角色边界

- 本包只承载**市场部经理（产品经理）**一个角色：需求洞察 → 需求诊断 → 定义范围与 AC → 交接技术与开发。
- 不做技术选型、不写实施方案、不承诺排期与人日；需要技术结论时移交 CTO（`dsh-agent-cto`）。

## 分层（谁能改什么）

| 层 | 位置 | 规则 |
|----|------|------|
| Skill 正文 | `skills/<name>/SKILL.md` | 唯一真源，不在 `src/` 内联（任务-02 迁入） |
| Skill 元数据 | `src/domain.ts` | 增删技能时改，`dir` 一律 `import.meta.url` 推导 |
| 人设 | `src/persona.ts` | 只改文案，不改导出名，≤ 70 行 |
| 插件行为 | `src/plugin.ts` | 注册 / 回滚 / 人设生命周期 |
| 装配 | `cordis.patch.yml` | preset 与默认值，`id`/`name`/`inject` 必须与 `src/plugin.ts` 一致 |

## 硬规则

1. **一个 profile 只装一个角色包**（pm / cto 双装会互相覆盖 default preset 与人设槽位）。
2. `src/plugin.ts` / `src/firmware.ts` 与 `dsh-agent-dev`、`dsh-agent-cto` 同源：改一处必须三仓同改。
3. 角色包不做子 agent 编排，不挂 `tool-subagent`；跨角色协作走驿传派单。
4. 不在本仓库改 `dsh-agent-dev` / `dsh-domain`；不执行 `npm publish` / `pnpm publish`。
5. 交付前跑 `pnpm test`；涉及装配的改动加跑 `pnpm verify:install`，不得用 skip 掩盖失败。
