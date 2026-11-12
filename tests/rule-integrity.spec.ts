/**
 * 规则完整性：防止「完备 = 可计数」回潮（issue #1）。
 *
 * 背景：门禁只核验章数、条数、段数，模型唯一能自检的就是这些可数量，
 * 于是凑数成了最优策略（真实案例见 pm-prd 的「反例」一节）。
 *
 * 这里只守住机械可验的那一侧，质量判据（能否指出越界、删掉后是否有判断改变）
 * 由规则文本承担，不假装能被断言。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

/** 承载「非目标 / 未决」判据的规则文件，改动必须同步这里。 */
const RULE_FILES = [
  'src/persona.ts',
  'skills/pm-prd/SKILL.md',
  'skills/pm-prd/references/checklists.md',
  'skills/pm-prd/references/dor.md',
  'skills/pm-prd/references/doc-checks.md',
  'skills/pm-prd/assets/prd-template.md',
  'skills/pm-prd/assets/prfq-template.md',
  'skills/pm-handoff/SKILL.md',
  'skills/pm-handoff/assets/handoff-pack.md',
  'skills/pm-repo-ops/SKILL.md',
  'skills/pm-repo-ops/assets/triage-comment.md',
] as const

/** 以条数判定非目标合格的写法。 */
const NON_GOAL_COUNT_RULES: readonly RegExp[] = [
  /至少\s*[三3]\s*条非目标/,
  /非目标[^\n]{0,16}(至少|≥|>=)\s*[3三]\s*条/,
  /(≥|>=)\s*3\s*条[^\n]{0,8}(非目标|明确不做)/,
]

describe('非目标不按条数判定', () => {
  it('规则文件中不出现「至少三条非目标」式判据', () => {
    const hits: string[] = []
    for (const file of RULE_FILES) {
      const text = read(file)
      for (const pattern of NON_GOAL_COUNT_RULES) {
        if (pattern.test(text)) hits.push(`${file} → ${pattern}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('persona 硬边界给出可判定的判据，而不是数量', () => {
    expect(read('src/persona.ts')).toContain('挡住哪次具体越界')
  })
})

describe('未决是条件项', () => {
  it('pm-prd 输出契约允许零未决', () => {
    expect(read('skills/pm-prd/SKILL.md')).toContain('无未决')
  })

  it('triage 评论模板不预留「未决：<…>」空槽', () => {
    expect(read('skills/pm-repo-ops/assets/triage-comment.md')).not.toMatch(/^未决：</m)
  })

  it('PRD 模板的未决节写明零未决的表达方式', () => {
    expect(read('skills/pm-prd/assets/prd-template.md')).toContain('无未决')
  })
})
