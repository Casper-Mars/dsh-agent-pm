/**
 * 兼容巡检第 2 层（patch 组合）期望值的防回归。
 *
 * 背景：`scripts/dsh-compat.sh` 曾把期望值写死成 `id: pm-domain` 之类的字面量，
 * patch 结构一演进（领域插件从宿主层挪到 preset 层），`pnpm compat` 就在组合层
 * 报假红灯——脚本没错、包也没错，错的是脱节的期望值。修法不是换一个写死的新值，
 * 而是让期望值从 `cordis.patch.yml`（唯一真源）派生，并在此钉死这条性质：
 *
 *   1. 真实 patch 派生出的期望值 = 独立解析 patch 得到的 insert id + 注册表默认值；
 *   2. **patch 结构再变，派生出的期望值必须随之改变**——任何退回写死的实现都会先红；
 *   3. patch 结构无法识别时脚本显式失败，不允许第 2 层「零期望」空过；
 *   4. 脚本里不再残留已下线插件名（防把旧 needle 抄回来）。
 *
 * 断言走脚本自身的 `--print-needles` 入口（不发网络、不打包），因此测的就是
 * `pnpm compat` 实际使用的那份派生逻辑，不是另写一份平行的实现。
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCRIPT = join(ROOT, 'scripts', 'dsh-compat.sh')
const PATCH_FILE = join(ROOT, 'cordis.patch.yml')
const REGISTRY_PACKAGE = '@deepseek-ai/dsh-agent-preset-registry'

interface PatchPlugin {
  id?: string
  name?: string
  config?: Record<string, unknown>
}

const readPatch = (file: string): PatchPlugin[] => {
  const parsed: unknown = parse(readFileSync(file, 'utf8'))
  const entries = Array.isArray(parsed) ? parsed : []
  return entries.flatMap((entry) => {
    const insert = (entry as { insert?: PatchPlugin[] } | null)?.insert
    return Array.isArray(insert) ? insert : []
  })
}

const runScript = (args: string[], env: Record<string, string | undefined> = {}) =>
  spawnSync('bash', [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })

const printNeedles = (patchFile: string): string[] => {
  const result = runScript(['--print-needles'], { COMPAT_PATCH_FILE: patchFile })
  expect(result.status, `--print-needles 退出码应为 0，实际 stderr：${result.stderr}`).toBe(0)
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

const withPatch = (content: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'compat-needles-'))
  const file = join(dir, 'cordis.patch.yml')
  writeFileSync(file, content, 'utf8')
  return file
}

describe('组合层期望值派生自 cordis.patch.yml', () => {
  it('派生结果 = insert id + 注册表默认 preset（与真实 patch 一致）', () => {
    const inserted = readPatch(PATCH_FILE)
    const registry = inserted.find((item) => item.name === REGISTRY_PACKAGE)
    expect(registry, `cordis.patch.yml 缺少 ${REGISTRY_PACKAGE}`).toBeDefined()

    const expected = [
      ...inserted.map((item) => `id: ${String(item.id)}`),
      `default: ${String(registry?.config?.default)}`,
    ].sort()
    expect(printNeedles(PATCH_FILE).sort()).toEqual(expected)
  })

  it('真实 patch 的派生结果覆盖注册表默认值与唯一 preset（组合层实际 grep 的三条）', () => {
    const needles = printNeedles(PATCH_FILE)
    expect(needles).toContain('id: agent-preset-registry')
    expect(needles).toContain('default: pm')
    expect(needles).toContain('id: preset-pm')
  })
})

describe('patch 结构变更时的期望值跟随（防写死）', () => {
  it('改 preset id 与默认 preset 后，派生出的期望值随之改变', () => {
    const source = readFileSync(PATCH_FILE, 'utf8')
    const mutated = source
      .replace('- id: preset-pm', '- id: preset-pm-shadow')
      .replace('default: pm', 'default: pm-shadow')
    // 替换必须真的发生，否则这个用例会变成空断言
    expect(mutated).not.toBe(source)
    expect(mutated).toContain('id: preset-pm-shadow')
    expect(mutated).toContain('default: pm-shadow')

    const needles = printNeedles(withPatch(mutated))
    expect(needles).toContain('id: preset-pm-shadow')
    expect(needles).toContain('default: pm-shadow')
    // 写死旧值的实现会在这里先红
    expect(needles).not.toContain('id: preset-pm')
    expect(needles).not.toContain('default: pm')
  })

  it('新增一条 insert 会自动多出一条期望值（不依赖人工同步清单）', () => {
    const source = readFileSync(PATCH_FILE, 'utf8')
    const mutated = `${source.trimEnd()}\n\n- insert:\n    - id: probe-extra\n      name: '@deepseek-ai/dsh-probe-extra'\n`
    const needles = printNeedles(withPatch(mutated))
    expect(needles).toContain('id: probe-extra')
  })
})

describe('结构无法识别时显式失败', () => {
  it('insert 为空时退出码非 0 且给出提示（不允许第 2 层零期望空过）', () => {
    const result = runScript(['--print-needles'], { COMPAT_PATCH_FILE: withPatch('[]\n') })
    expect(result.status).not.toBe(0)
    expect(result.stdout.trim()).toBe('')
    expect(result.stderr).toMatch(/未派生出任何组合层期望值/)
  })

  it('patch 文件缺失时退出码非 0', () => {
    const result = runScript(['--print-needles'], { COMPAT_PATCH_FILE: join(tmpdir(), 'no-such-patch.yml') })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/找不到 patch 文件/)
  })
})

describe('脚本不再硬编码已下线插件', () => {
  it('scripts/dsh-compat.sh 不含 pm-domain（旧 needle 已被派生逻辑取代）', () => {
    expect(readFileSync(SCRIPT, 'utf8')).not.toMatch(/pm-domain/)
  })
})
