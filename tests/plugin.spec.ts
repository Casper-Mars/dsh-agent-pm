/**
 * `src/plugin.ts` 的装配契约（任务-03 补齐）。
 *
 * 任务-01 只保留骨架复制件，`PM_DOMAIN` / `PM_PERSONA` 尚不存在，故此处留占位。
 * 补齐时的基线：`dsh-agent-dev@bc78f02` 的 `tests/plugin.spec.ts` —— 用最小
 * fake `ctx`（skills 注册表 + agents 生命周期 + per-agent systemPrompt）验证：
 * 注册参数、缺失降级、depth 0 gate、幂等、LIFO 反注册、卸载后重装、全程只读。
 */
import { describe, it } from 'vitest'

describe('领域 Skill 注册', () => {
  it.todo('ctx.skills 可用 → 注册本包 Skill，参数合规（runtime / directory / 正文去 frontmatter）（任务-03）')
  it.todo('ctx.skills 缺失 → 只 warn 降级，不抛错、不注册（任务-03）')
  it.todo('注册中途失败 → 已注册项原子回滚（任务-03）')
})

describe('PM persona 注入', () => {
  it.todo('depth 0 根 agent → 注入 deployment:persona-prefix 槽位（任务-03）')
  it.todo('depth ≥ 1 子 agent → 不注入、不调用 inject（任务-03）')
  it.todo('同一 agent 重复 created → 幂等，只注入一次（任务-03）')
  it.todo('systemPrompt 缺失 → 只 warn，Skill 注册不受影响（任务-03）')
})

describe('插件卸载', () => {
  it.todo('dispose → Skill 按 LIFO 反注册，persona fiber 全部释放（任务-03）')
  it.todo('卸载后重新装配 → 可重新注册（占位已释放）（任务-03）')
})
