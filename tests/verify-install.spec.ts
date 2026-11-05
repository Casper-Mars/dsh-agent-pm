/**
 * `scripts/verify-install.mjs` 单测。
 *
 * 覆盖：检查项计数、完整夹具全 PASS、缺 SKILL.md / 空文件 → FAIL 带原因、
 * `skillsRoot` 入参校验。夹具全部落在 `mkdtempSync` 临时目录，不读写真实 profile。
 * 「包内 skills/ 齐全后全 PASS」由任务-02 迁入 Skill 后启用。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  EXPECTED_CHECK_COUNT,
  EXPECTED_FILES,
  EXPECTED_SKILLS,
  exitCode,
  formatReport,
  verifyInstall,
} from '../scripts/verify-install.mjs'

const temporaryRoots: string[] = []

function writeFile(target: string, content: string): void {
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
}

/** 完整夹具：每个 Skill 一个 SKILL.md + 清单里的随包文件。 */
function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'verify-install-'))
  temporaryRoots.push(root)
  const skillsRoot = join(root, 'skills')
  for (const name of EXPECTED_SKILLS) writeFile(join(skillsRoot, name, 'SKILL.md'), `# ${name}\n`)
  for (const item of EXPECTED_FILES) {
    writeFile(join(skillsRoot, item.skill, ...item.file.split('/')), '# 随包文件\n')
  }
  return skillsRoot
}

/** 报告里以 PASS / FAIL 开头的行（检查项行）。 */
const checkLines = (lines: string[]): string[] => lines.filter((line) => /^(PASS|FAIL)/.test(line))

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop() as string, { recursive: true, force: true })
  }
})

describe('期望常量', () => {
  it('检查项总数 = SKILL.md 数 + 随包文件数', () => {
    expect(new Set(EXPECTED_SKILLS).size).toBe(EXPECTED_SKILLS.length)
    expect(EXPECTED_CHECK_COUNT).toBe(EXPECTED_SKILLS.length + EXPECTED_FILES.length)
  })
})

describe('verifyInstall', () => {
  it('完整夹具 → 全 PASS，退出码 0，kind / name 与清单同序', () => {
    const skillsRoot = makeFixture()
    const result = verifyInstall({ skillsRoot })

    expect([result.passed, result.failed]).toEqual([EXPECTED_CHECK_COUNT, 0])
    expect(exitCode(result)).toBe(0)
    expect(result.source).toBe('package')

    const actual = checkLines(formatReport(result)).map((line) => line.split(' ').slice(1, 3).join(':'))
    expect(actual).toEqual([
      ...EXPECTED_SKILLS.map((name: string) => `skill:${name}`),
      ...EXPECTED_FILES.map((item: { skill: string; file: string }) => `file:${item.skill}/${item.file}`),
    ])
    expect(new Set(actual).size).toBe(actual.length)
  })

  it('缺 1 个 SKILL.md → 1 条 FAIL（带路径），退出码 1', () => {
    const skillsRoot = makeFixture()
    const missing = join(skillsRoot, EXPECTED_SKILLS[0] as string, 'SKILL.md')
    rmSync(dirname(missing), { recursive: true, force: true })

    const result = verifyInstall({ skillsRoot })
    const lines = checkLines(formatReport(result))
    const fails = lines.filter((line) => line.startsWith('FAIL'))

    expect(exitCode(result)).toBe(1)
    expect(fails).toHaveLength(1)
    expect(fails[0]).toContain(`skill ${EXPECTED_SKILLS[0]}`)
    expect(fails[0]).toContain(missing)
    expect(lines.filter((line) => line.startsWith('PASS'))).toHaveLength(EXPECTED_CHECK_COUNT - 1)
  })

  it('空文件 → FAIL 原因为「文件为空」', () => {
    const skillsRoot = makeFixture()
    const empty = join(skillsRoot, EXPECTED_SKILLS[0] as string, 'SKILL.md')
    writeFileSync(empty, '', 'utf8')

    const result = verifyInstall({ skillsRoot })
    const fail = checkLines(formatReport(result)).find((line) => line.startsWith('FAIL'))
    expect(fail).toContain('文件为空')
    expect(fail).toContain(empty)
    expect(exitCode(result)).toBe(1)
  })

  it('skillsRoot 为空字符串 → TypeError（调用方错误）', () => {
    expect(() => verifyInstall({ skillsRoot: '' })).toThrowError(TypeError)
  })

  it.todo('包内 skills/ 迁入后：默认路径全 PASS、报告条数等于 EXPECTED_CHECK_COUNT（任务-02）')
})
