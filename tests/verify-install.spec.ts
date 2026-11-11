/**
 * `scripts/verify-install.mjs` 单测。
 *
 * 覆盖：检查项计数（10 个 SKILL.md + 14 个 asset + 32 个 reference = 56）、
 * 包内默认路径全 PASS、完整夹具全 PASS、缺 SKILL.md / asset / reference →
 * 恰好 1 条 FAIL 且带绝对路径、空文件 → FAIL 带原因、`skillsRoot` 入参校验。
 * 夹具全部落在 `mkdtempSync` 临时目录，不读写真实 profile。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  EXPECTED_ASSETS,
  EXPECTED_CHECK_COUNT,
  EXPECTED_FILES,
  EXPECTED_REFERENCES,
  EXPECTED_SKILLS,
  exitCode,
  formatReport,
  resolveSkillsRoot,
  verifyInstall,
} from '../scripts/verify-install.mjs'

/** 包根：源码态 `tests/` 的上一级。 */
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

const temporaryRoots: string[] = []

function writeFile(target: string, content: string): void {
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
}

interface ExpectedFile {
  skill: string
  file: string
}

/** 完整夹具：每个 Skill 一个 SKILL.md + 清单里的随包文件。 */
function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'verify-install-'))
  temporaryRoots.push(root)
  const skillsRoot = join(root, 'skills')
  for (const name of EXPECTED_SKILLS) writeFile(join(skillsRoot, name, 'SKILL.md'), `# ${name}\n`)
  for (const item of EXPECTED_FILES as ExpectedFile[]) {
    writeFile(join(skillsRoot, item.skill, ...item.file.split('/')), '# 随包文件\n')
  }
  return skillsRoot
}

/** 报告里以 PASS / FAIL 开头的行（检查项行）。 */
const checkLines = (lines: string[]): string[] => lines.filter((line) => /^(PASS|FAIL)/.test(line))

/** FAIL 行的路径段（`FAIL <kind> <name> <reason>：<path>`）。 */
const failPath = (line: string): string => line.slice(line.lastIndexOf('：') + 1)

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop() as string, { recursive: true, force: true })
  }
})

describe('期望常量', () => {
  it('10 个 Skill + 14 个 asset + 32 个 reference = 56 项', () => {
    expect(EXPECTED_SKILLS).toHaveLength(10)
    expect(EXPECTED_ASSETS).toHaveLength(14)
    expect(EXPECTED_REFERENCES).toHaveLength(32)
    expect(EXPECTED_FILES).toHaveLength(46)
    expect(EXPECTED_CHECK_COUNT).toBe(56)
  })

  it('EXPECTED_SKILLS 无重复、EXPECTED_FILES 无重复键', () => {
    expect(new Set(EXPECTED_SKILLS).size).toBe(EXPECTED_SKILLS.length)

    const keys = (EXPECTED_FILES as ExpectedFile[]).map((item) => `${item.skill}/${item.file}`)
    expect(new Set(keys).size).toBe(keys.length)

    // 清单只允许挂在已声明的 Skill 下，且路径必须是 assets/ 或 references/ 下的 .md。
    for (const key of keys) {
      const [skill, ...rest] = key.split('/')
      expect(EXPECTED_SKILLS).toContain(skill)
      expect(rest.join('/')).toMatch(/^(assets|references)\/[^/]+\.md$/)
    }
  })
})

describe('verifyInstall', () => {
  it('默认检查包内 skills/：56 条全 PASS、退出码 0', () => {
    const targets = resolveSkillsRoot({ repoRoot: REPO_ROOT })
    expect(targets.source).toBe('package')
    expect(targets.skillsRoot).toBe(join(REPO_ROOT, 'skills'))

    const result = verifyInstall(targets)
    expect([result.checks.length, result.passed, result.failed]).toEqual([EXPECTED_CHECK_COUNT, EXPECTED_CHECK_COUNT, 0])
    expect(exitCode(result)).toBe(0)

    const reports = checkLines(formatReport(result))
    expect(reports).toHaveLength(EXPECTED_CHECK_COUNT)
    expect(reports.every((line) => line.startsWith('PASS'))).toBe(true)
  })

  it('完整夹具 → 全 PASS，退出码 0，kind / name 与清单同序', () => {
    const skillsRoot = makeFixture()
    const result = verifyInstall({ skillsRoot })

    expect([result.passed, result.failed]).toEqual([EXPECTED_CHECK_COUNT, 0])
    expect(exitCode(result)).toBe(0)
    expect(result.source).toBe('package')

    const actual = checkLines(formatReport(result)).map((line) => line.split(' ').slice(1, 3).join(':'))
    expect(actual).toEqual([
      ...EXPECTED_SKILLS.map((name: string) => `skill:${name}`),
      ...EXPECTED_FILES.map((item: ExpectedFile) => `file:${item.skill}/${item.file}`),
    ])
    expect(new Set(actual).size).toBe(actual.length)
  })

  it('缺 1 个 SKILL.md → 1 条 FAIL（带绝对路径）+ 55 条 PASS，退出码 1', () => {
    const skillsRoot = makeFixture()
    const missing = join(skillsRoot, EXPECTED_SKILLS[0] as string, 'SKILL.md')
    rmSync(missing) // 只删 SKILL.md，保留同目录 assets/references，确保只有 1 项失败

    const result = verifyInstall({ skillsRoot })
    const lines = checkLines(formatReport(result))
    const fails = lines.filter((line) => line.startsWith('FAIL'))

    expect(exitCode(result)).toBe(1)
    expect(fails).toHaveLength(1)
    expect(fails[0]).toContain(`skill ${EXPECTED_SKILLS[0]}`)
    expect(fails[0]).toContain(missing)
    expect(failPath(fails[0] as string)).toBe(missing)
    expect(lines.filter((line) => line.startsWith('PASS'))).toHaveLength(EXPECTED_CHECK_COUNT - 1)
  })

  it('缺 1 个 asset → 恰好 1 条 FAIL（带绝对路径），退出码 1', () => {
    const skillsRoot = makeFixture()
    const target = EXPECTED_ASSETS[0] as ExpectedFile
    const missing = join(skillsRoot, target.skill, ...target.file.split('/'))
    rmSync(missing)

    const result = verifyInstall({ skillsRoot })
    const fails = checkLines(formatReport(result)).filter((line) => line.startsWith('FAIL'))

    expect(exitCode(result)).toBe(1)
    expect(fails).toHaveLength(1)
    expect(fails[0]).toContain(`file ${target.skill}/${target.file}`)
    expect(fails[0]).toContain('缺少文件')
    expect(failPath(fails[0] as string)).toBe(missing)
    expect(result.passed).toBe(EXPECTED_CHECK_COUNT - 1)
  })

  it('缺 1 个 reference → 恰好 1 条 FAIL（带绝对路径），退出码 1', () => {
    const skillsRoot = makeFixture()
    const target = EXPECTED_REFERENCES[0] as ExpectedFile
    const missing = join(skillsRoot, target.skill, ...target.file.split('/'))
    rmSync(missing)

    const result = verifyInstall({ skillsRoot })
    const fails = checkLines(formatReport(result)).filter((line) => line.startsWith('FAIL'))

    expect(exitCode(result)).toBe(1)
    expect(fails).toHaveLength(1)
    expect(fails[0]).toContain(`file ${target.skill}/${target.file}`)
    expect(fails[0]).toContain('缺少文件')
    expect(failPath(fails[0] as string)).toBe(missing)
    expect(result.passed).toBe(EXPECTED_CHECK_COUNT - 1)
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
})

describe('resolveSkillsRoot', () => {
  it('默认 = <repoRoot>/skills；--assets 相对 cwd 解析', () => {
    expect(resolveSkillsRoot({ repoRoot: '/repo/root' })).toEqual({
      skillsRoot: '/repo/root/skills',
      source: 'package',
    })
    expect(resolveSkillsRoot({ assets: 'legacy/assets', repoRoot: '/repo/root', cwd: '/cwd' })).toEqual({
      skillsRoot: '/cwd/legacy/assets',
      source: 'assets',
    })
  })
})
