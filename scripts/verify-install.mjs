/**
 * 包内资产自检（`pnpm verify:install`）：确认本包 `skills/` 下领域 Skill 的
 * `SKILL.md` 与随包文件（`assets/` / `references/`）齐全且非空。
 *
 * 检查目标是**包内**资产，与是否安装到 profile 无关：未安装状态下也必须全 PASS。
 * 旧版的「安装目录」硬编码与 `--home` / 环境变量默认推导已随任务-05 删除；
 * `--assets <dir>` 只用于手工核查其它资产目录，不再是默认路径。
 *
 * 检查清单是本文件的唯一真源：`EXPECTED_SKILLS`（10 个）+ `EXPECTED_ASSETS`（14 个）
 * + `EXPECTED_REFERENCES`（32 个）= 56 项，与包内 `skills/pm-prd/` 的实际布局逐项对应。
 * 新增 / 删除随包文件时必须同步本清单与 `tests/verify-install.spec.ts` 的计数断言。
 *
 * 退出码：全 PASS 为 0，有 FAIL 为 1，参数 / 环境错误（目录不存在、未知参数）为 2。
 * 核心逻辑均为导出纯函数，`main` 仅在直接执行本文件时运行；导入本模块不跑 main、
 * 不 `process.exit`，便于单测直接调用。
 */
import { realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 期望的领域 Skill（与 `src/domain.ts` 的 `PM_DOMAIN.skills` 一致）。 */
export const EXPECTED_SKILLS = [
  'pm-discovery',
  'pm-prd',
  'pm-prioritize',
  'pm-handoff',
  'pm-metrics',
  'pm-competitive',
  'pm-launch',
  'pm-repo-ops',
  'pm-stakeholder',
  'pm-retro',
]

/**
 * 除 `SKILL.md` 外必须存在且非空的随包文件。
 *
 * 形如 `{ skill: 'pm-prd', file: 'references/mining.md' }`，`file` 相对
 * `<skillsRoot>/<skill>/`。按 `assets/` 与 `references/` 分组维护，`EXPECTED_FILES`
 * 由两者派生，供检查逻辑与测试统一消费。
 */
export const EXPECTED_ASSETS = [
  { skill: 'pm-discovery', file: 'assets/diagnosis-card.md' },
  { skill: 'pm-prd', file: 'assets/prd-template.md' },
  { skill: 'pm-prd', file: 'assets/prfq-template.md' },
  { skill: 'pm-prioritize', file: 'assets/prioritization-table.md' },
  { skill: 'pm-handoff', file: 'assets/handoff-pack.md' },
  { skill: 'pm-handoff', file: 'assets/change-request.md' },
  { skill: 'pm-metrics', file: 'assets/metric-spec.md' },
  { skill: 'pm-metrics', file: 'assets/experiment-plan.md' },
  { skill: 'pm-competitive', file: 'assets/competitor-matrix.md' },
  { skill: 'pm-launch', file: 'assets/launch-checklist.md' },
  { skill: 'pm-launch', file: 'assets/release-notes.md' },
  { skill: 'pm-repo-ops', file: 'assets/triage-comment.md' },
  { skill: 'pm-stakeholder', file: 'assets/decision-memo.md' },
  { skill: 'pm-retro', file: 'assets/retro-summary.md' },
]

/** `references/` 下的随包文件（32 个）。 */
export const EXPECTED_REFERENCES = [
  { skill: 'pm-discovery', file: 'references/diagnosis.md' },
  { skill: 'pm-discovery', file: 'references/hackernews.md' },
  { skill: 'pm-discovery', file: 'references/interview.md' },
  { skill: 'pm-discovery', file: 'references/mining.md' },
  { skill: 'pm-discovery', file: 'references/opportunity-tree.md' },
  { skill: 'pm-discovery', file: 'references/producthunt.md' },
  { skill: 'pm-discovery', file: 'references/v2ex.md' },
  { skill: 'pm-prd', file: 'references/ac-examples.md' },
  { skill: 'pm-prd', file: 'references/checklists.md' },
  { skill: 'pm-prd', file: 'references/doc-checks.md' },
  { skill: 'pm-prd', file: 'references/dor.md' },
  { skill: 'pm-prd', file: 'references/language.md' },
  { skill: 'pm-prioritize', file: 'references/methods.md' },
  { skill: 'pm-prioritize', file: 'references/roadmap.md' },
  { skill: 'pm-handoff', file: 'references/story-slicing.md' },
  { skill: 'pm-handoff', file: 'references/uat.md' },
  { skill: 'pm-metrics', file: 'references/experiment-design.md' },
  { skill: 'pm-metrics', file: 'references/metric-tree.md' },
  { skill: 'pm-metrics', file: 'references/readout.md' },
  { skill: 'pm-competitive', file: 'references/market-map.md' },
  { skill: 'pm-competitive', file: 'references/positioning.md' },
  { skill: 'pm-launch', file: 'references/gtm-enablement.md' },
  { skill: 'pm-launch', file: 'references/launch-tiers.md' },
  { skill: 'pm-repo-ops', file: 'references/event-routing.md' },
  { skill: 'pm-repo-ops', file: 'references/github-api.md' },
  { skill: 'pm-repo-ops', file: 'references/issue-lifecycle.md' },
  { skill: 'pm-repo-ops', file: 'references/label-taxonomy.md' },
  { skill: 'pm-stakeholder', file: 'references/conflict-escalation.md' },
  { skill: 'pm-stakeholder', file: 'references/weekly-update.md' },
  { skill: 'pm-retro', file: 'references/assumption-review.md' },
  { skill: 'pm-retro', file: 'references/opportunity-backfill.md' },
  { skill: 'pm-retro', file: 'references/retro-format.md' },
]

export const EXPECTED_FILES = [...EXPECTED_ASSETS, ...EXPECTED_REFERENCES]

/** 检查项总数：SKILL.md 数 + 随包文件数。 */
export const EXPECTED_CHECK_COUNT = EXPECTED_SKILLS.length + EXPECTED_FILES.length

/** 目录存在性判断（环境错误 → 退出码 2 用）。 */
const isDir = (target) => {
  try {
    return statSync(target).isDirectory()
  } catch {
    return false
  }
}

const describeError = (error) => (error instanceof Error ? error.message : String(error))

/** 校验一个「必须存在、是普通文件、非空」的文件，返回单个检查项。 */
function check(kind, name, file) {
  let reason = '缺少文件'
  try {
    const info = statSync(file)
    reason = info.isFile() ? (info.size === 0 ? '文件为空' : '') : '不是普通文件'
  } catch {
    /* 缺失即 FAIL，reason 用于定位 */
  }
  return { kind, name, path: file, ok: reason === '', reason }
}

/**
 * 执行自检（每个 Skill 1 项 + 每个随包文件 1 项），不抛错、不写盘。
 *
 * @param {{ skillsRoot: string, source?: 'package' | 'assets' }} targets
 * @returns {{ skillsRoot: string, source: string, checks: object[], passed: number, failed: number, ok: boolean }}
 */
export function verifyInstall({ skillsRoot, source = 'package' }) {
  if (typeof skillsRoot !== 'string' || skillsRoot === '') {
    throw new TypeError('verifyInstall 需要非空的 skillsRoot')
  }
  const checks = [
    ...EXPECTED_SKILLS.map((name) => check('skill', name, path.join(skillsRoot, name, 'SKILL.md'))),
    ...EXPECTED_FILES.map((item) =>
      check(
        'file',
        `${item.skill}/${item.file}`,
        path.join(skillsRoot, item.skill, ...item.file.split('/')),
      ),
    ),
  ]
  const passed = checks.filter((item) => item.ok).length
  return {
    skillsRoot,
    source,
    checks,
    passed,
    failed: checks.length - passed,
    ok: passed === checks.length,
  }
}

/** 报告 → 文本行：`PASS` / `FAIL` 行只对应检查项，其余以 `#` 开头，便于 grep 计数。 */
export function formatReport(result) {
  const lines = [`# verify-install：skills=${result.skillsRoot} 来源=${result.source}`]
  if (result.source === 'assets') {
    lines.push(`# 手工资产目录核查（--assets）：${result.skillsRoot}`)
  }
  for (const item of result.checks) {
    lines.push(
      item.ok
        ? `PASS ${item.kind} ${item.name} ${item.path}`
        : `FAIL ${item.kind} ${item.name} ${item.reason}：${item.path}`,
    )
  }
  lines.push(`# 结果：${result.passed}/${result.checks.length} 通过，退出码 ${exitCode(result)}`)
  return lines
}

/** 报告 → 退出码：全 PASS 为 0，有 FAIL 为 1（参数 / 环境错误由 CLI 返回 2）。 */
export function exitCode(result) {
  return result.ok ? 0 : 1
}

/**
 * 解析待检查的 skills 根目录（只推导路径、不检查存在性）。
 *
 * 默认 = `<包根>/skills`；`--assets <dir>` 时 = `<cwd>/<dir>`（手工核查用）。
 */
export function resolveSkillsRoot({ assets, repoRoot, cwd = process.cwd() }) {
  if (assets) return { skillsRoot: path.resolve(cwd, assets), source: 'assets' }
  return { skillsRoot: path.join(repoRoot, 'skills'), source: 'package' }
}

/** 解析命令行参数（仅支持 `--assets <dir>`）；非法参数抛错，由 main 转成退出码 2。 */
function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag !== '--assets') throw new Error(`未知参数 "${flag}"（可用：--assets <dir>）`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`参数 "${flag}" 缺少取值`)
    options.assets = value
    index += 1
  }
  return options
}

/** CLI 主流程：解析参数 → 定位 skills 根 → 校验 → 打印报告。环境错误只输出一行（无堆栈）。 */
export function main(argv) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  let options
  try {
    options = parseArgs(argv)
  } catch (error) {
    console.error(`[verify-install] ${describeError(error)}`)
    return 2
  }

  const targets = resolveSkillsRoot({ ...options, repoRoot })
  if (!isDir(targets.skillsRoot)) {
    const label = targets.source === 'assets' ? '--assets 指定的目录' : '包内 skills 目录'
    console.error(`[verify-install] ${label}不存在：${targets.skillsRoot}`)
    return 2
  }

  try {
    const result = verifyInstall(targets)
    for (const line of formatReport(result)) console.log(line)
    return exitCode(result)
  } catch (error) {
    console.error(`[verify-install] 自检异常：${describeError(error)}`)
    return 2
  }
}

/**
 * CLI 入口守卫：`argv[1]` 可能经符号链接（`/tmp`、挂载盘），而 `import.meta.url` 已是
 * realpath，必须比较 realpath，否则会「没跑 main 却 exit 0」（静默假绿）；
 * realpath 失败退回 inode / 字符串比较。
 */
function isDirectRun() {
  const invoked = process.argv[1]
  if (invoked === undefined) return false
  const self = fileURLToPath(import.meta.url)
  try {
    return realpathSync(invoked) === realpathSync(self)
  } catch {
    try {
      const [a, b] = [statSync(invoked), statSync(self)]
      return a.dev === b.dev && a.ino === b.ino
    } catch {
      return path.resolve(invoked) === path.resolve(self)
    }
  }
}

if (isDirectRun()) process.exitCode = main(process.argv.slice(2))
