/**
 * `pm` 领域数据（`src/domain.ts` + `src/persona.ts`）的声明契约。
 *
 * 基线：`dsh-agent-dev@bc78f02` 的 `tests/domain.spec.ts`。断言四件事：
 *   1. 声明的 Skill 集合与 `skills/` 目录精确相等（不多不少）；
 *   2. 每个 SKILL.md 的 frontmatter 三字段非空，name 等于目录名，description
 *      与领域声明逐字一致；
 *   3. 随包 `references/` / `assets/` 的每个 .md 存在且非空；
 *   4. 人设与 `PM_DOMAIN.personaMarkdown` 同源，且不超过 70 行。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PM_DOMAIN } from '../src/domain'
import { parseFirmwareSkillMarkdown } from '../src/firmware'
import { PM_PERSONA } from '../src/persona'

/** 包根：源码态 `tests/` 的上一级。 */
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills')

/** 期望的 Skill（顺序与 `PM_DOMAIN.skills` 的稳定声明顺序一致）。 */
const EXPECTED_SKILL_NAMES = ['pm-prd']

/** 人设行数硬上限（方案 §8）。 */
const PERSONA_MAX_LINES = 70

/** `skills/` 下的一级目录名（排序后）。 */
function skillDirectories(): string[] {
  return readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/** 读取并解析某个 Skill 的 SKILL.md。 */
function readSkillFrontmatter(name: string) {
  const file = path.join(SKILLS_ROOT, name, 'SKILL.md')
  return parseFirmwareSkillMarkdown(readFileSync(file, 'utf8'), file)
}

/** 递归列出目录下的 .md 文件（相对目录）。 */
function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...markdownFiles(abs).map((rel) => path.join(entry.name, rel)))
    else if (entry.isFile() && entry.name.endsWith('.md')) results.push(entry.name)
  }
  return results.sort()
}

describe('PM_DOMAIN 声明', () => {
  it('身份字段稳定，Skill 清单唯一且顺序固定', () => {
    expect(PM_DOMAIN.id).toBe('pm')
    expect(PM_DOMAIN.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(PM_DOMAIN.displayName.length).toBeGreaterThan(0)

    const names = PM_DOMAIN.skills.map((skill) => skill.name)
    expect(names).toEqual(EXPECTED_SKILL_NAMES)
    expect(new Set(names).size).toBe(names.length)
  })

  it('声明的 Skill 集合与 skills/ 目录精确相等（不多不少）', () => {
    const declared = PM_DOMAIN.skills.map((skill) => skill.name).sort()
    expect(declared).toEqual(skillDirectories())
  })
})

describe.each(EXPECTED_SKILL_NAMES)('Skill %s', (name) => {
  const declared = PM_DOMAIN.skills.find((skill) => skill.name === name)

  it('已声明且 dir 是存在的一级目录绝对路径', () => {
    expect(declared).toBeDefined()
    const dir = (declared as { dir: string }).dir
    expect(path.isAbsolute(dir)).toBe(true)
    expect(path.basename(dir)).toBe(name)
    expect(path.dirname(dir)).toBe(SKILLS_ROOT)
    expect(existsSync(dir)).toBe(true)
    expect(statSync(dir).isDirectory()).toBe(true)
    expect(existsSync(path.join(dir, 'SKILL.md'))).toBe(true)
  })

  it('frontmatter 三字段非空，name 与目录名 / 声明名一致，description 与声明逐字一致', () => {
    const declaredSkill = declared as { name: string; description: string; dir: string }
    const parsed = readSkillFrontmatter(name)

    expect(parsed.name).toBe(name)
    expect(parsed.name).toBe(declaredSkill.name)
    expect(parsed.name).toBe(path.basename(declaredSkill.dir))
    expect(parsed.description.trim()).not.toBe('')
    expect(parsed.whenToUse.trim()).not.toBe('')

    // 模型侧描述与 SKILL.md frontmatter 必须同源，避免两处漂移。
    expect(declaredSkill.description).toBe(parsed.description)

    // 正文已剥离 frontmatter。
    expect(parsed.content.startsWith('---')).toBe(false)
    expect(parsed.content.trim().length).toBeGreaterThan(0)
  })
})

describe.each(EXPECTED_SKILL_NAMES)('Skill %s 随包资产', (name) => {
  it.each(['references', 'assets'])('%s/ 下的每个 .md 都存在且非空', (subdir) => {
    const dir = path.join(SKILLS_ROOT, name, subdir)
    if (!existsSync(dir)) return
    const files = markdownFiles(dir)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      expect(statSync(path.join(dir, file)).size, `${name}/${subdir}/${file} 为空`).toBeGreaterThan(0)
    }
  })
})

describe('PM 人设', () => {
  it('PM_PERSONA 与 PM_DOMAIN.personaMarkdown 同源（同一字符串）', () => {
    expect(PM_PERSONA).toBe(PM_DOMAIN.personaMarkdown)
  })

  it('以角色标题开头，且不超过 70 行', () => {
    const lines = PM_PERSONA.split('\n')
    expect(lines.length).toBeLessThanOrEqual(PERSONA_MAX_LINES)
    expect(PM_PERSONA.startsWith('# 市场部经理（产品经理）')).toBe(true)
    expect(PM_PERSONA.trim().length).toBeGreaterThan(0)
  })

  it('承载身份 / 硬边界 / 交接 / 升级 / 红线五段', () => {
    expect(PM_PERSONA).toContain('身份：')
    expect(PM_PERSONA).toContain('## 硬边界')
    expect(PM_PERSONA).toContain('## 交接')
    expect(PM_PERSONA).toContain('## 升级')
    expect(PM_PERSONA).toContain('## 红线')
  })

  it('不夹带流程检查清单（清单属于 Skill，不属于 persona）', () => {
    expect(PM_PERSONA).not.toContain('- [ ]')
  })
})
