/**
 * `src/domain.ts` / `src/persona.ts` 的声明契约（任务-02 / 任务-03 补齐）。
 *
 * 任务-01 只建骨架，`src/domain.ts`（`PM_DOMAIN`）与 `src/persona.ts`（`PM_PERSONA`）
 * 尚未产出，因此这里留占位断言。补齐时的基线：`dsh-agent-dev@bc78f02`
 * 的 `tests/domain.spec.ts`（Skill 名称集合与 skills/ 目录精确相等、frontmatter
 * 三字段一致、references 可达、persona 长度上限）。
 */
import { describe, it } from 'vitest'

describe('PM_DOMAIN 声明', () => {
  it.todo('id / 版本 / 展示名稳定，Skill 清单唯一且与 skills/ 目录精确相等（任务-02）')
  it.todo('每个 Skill 的 frontmatter.name 与目录名、声明名一致，description 与 whenToUse 非空（任务-02）')
  it.todo('references/*.md 全部存在、非空，且在 SKILL.md 正文被点名（任务-02）')
})

describe('PM_PERSONA 人设', () => {
  it.todo('与 PM_DOMAIN.personaMarkdown 同源（同一字符串）且不超过 70 行（任务-03）')
  it.todo('承载身份 / 硬边界 / 交接 / 升级四段（任务-03）')
})
