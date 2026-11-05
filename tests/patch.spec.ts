/**
 * `cordis.patch.yml` 的结构契约（任务-04 强化版）。
 *
 * 断言分三层：
 *   1. 外层形状：恰好一个 `insert` 条目，且**没有任何**直接挂在外层的覆盖条目；
 *   2. 插入顺序与身份：领域插件 / preset 注册表 / 唯一 preset，id 顺序固定；
 *   3. 工具面：恰好 5 个工具，顺序固定，逐项核验 name、tool-todo 参数与禁用项。
 *
 * 结构断言一律走真实 YAML 解析（`yaml` 包），不用正则猜结构；只有「全文禁词」
 * 用源码扫描，因为它要覆盖注释等非结构位置。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { inject as pluginInject, name as pluginName } from '../src/plugin'

const ROLE = 'pm'
const DOMAIN_ID = 'pm-domain'
const PACKAGE_NAME = 'dsh-agent-pm'
const REGISTRY_ID = 'agent-preset-registry'
const PRESET_ID = 'preset-pm'
const REGISTRY_PACKAGE = '@deepseek-ai/dsh-agent-preset-registry'
const PRESET_PACKAGE = '@deepseek-ai/dsh-agent-preset'

/** 工具面契约：顺序、id、npm 包名都固定，不多不少。 */
const EXPECTED_PLUGINS = [
  { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
  { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash' },
  { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
  { id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo' },
  { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web' },
] as const

interface PatchPlugin {
  id?: string
  name?: string
  inject?: string[]
  config?: Record<string, unknown>
}

interface PatchEntry {
  insert?: PatchPlugin[]
  id?: string
  [key: string]: unknown
}

const PATCH_FILE = fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))
const SOURCE = readFileSync(PATCH_FILE, 'utf8')
const PARSED: unknown = parse(SOURCE)
const PATCH: PatchEntry[] = Array.isArray(PARSED) ? (PARSED as PatchEntry[]) : []

const isInsertEntry = (entry: unknown): entry is PatchEntry =>
  entry !== null && typeof entry === 'object' && Array.isArray((entry as PatchEntry).insert)

const INSERTED: PatchPlugin[] = PATCH.flatMap((entry) =>
  isInsertEntry(entry) ? (entry.insert as PatchPlugin[]) : [],
)

const byId = (id: string): PatchPlugin => {
  const found = INSERTED.find((item) => item.id === id)
  expect(found, `cordis.patch.yml 缺少 insert 项 "${id}"`).toBeDefined()
  return found as PatchPlugin
}

const configOf = (entry: PatchPlugin): Record<string, unknown> => {
  expect(entry.config, `"${String(entry.id)}" 缺少 config`).toBeDefined()
  return (entry.config ?? {}) as Record<string, unknown>
}

const presetPlugins = (): PatchPlugin[] => {
  const plugins = configOf(byId(PRESET_ID)).plugins
  expect(Array.isArray(plugins), 'preset.config.plugins 必须是数组').toBe(true)
  return plugins as PatchPlugin[]
}

describe('cordis.patch.yml 外层形状', () => {
  it('恰好一个 insert 条目', () => {
    expect(Array.isArray(PARSED), 'cordis.patch.yml 顶层必须是数组').toBe(true)
    expect(PATCH.filter(isInsertEntry)).toHaveLength(1)
    expect(PATCH).toHaveLength(1)
  })

  it('没有任何顶层覆盖条目（不允许把 id 直接挂在外层）', () => {
    const overrides = PATCH.filter((entry) => !isInsertEntry(entry))
    expect(overrides, '角色包只做 insert，不允许顶层覆盖条目').toEqual([])
    expect(PATCH.filter((entry) => entry.id !== undefined)).toEqual([])
  })

  it('insert 恰好三条，id 顺序固定（领域 / 注册表 / preset）', () => {
    expect(INSERTED).toHaveLength(3)
    expect(INSERTED.map((item) => item.id)).toEqual([DOMAIN_ID, REGISTRY_ID, PRESET_ID])
  })
})

describe('cordis.patch.yml 插件身份', () => {
  it(`${DOMAIN_ID} 条目的 id / name / inject 与 src/plugin.ts 逐项一致，且无 config`, () => {
    const entry = byId(DOMAIN_ID)

    // 单一真源：plugin 导出即契约，patch 必须逐项照抄。
    expect(pluginName).toBe(DOMAIN_ID)
    expect(pluginInject).toEqual(['skills', 'agents'])

    // patch 的 `id` 是插件实例 id，对应 plugin 导出的 name；
    // `name` 是 npm 包名，用于解析模块，两者不是同一个字段。
    expect(entry.id).toBe(pluginName)
    expect(entry.name).toBe(PACKAGE_NAME)
    expect(entry.inject).toEqual(pluginInject)
    expect(entry.config).toBeUndefined()
  })

  it('恰好一个 agent-preset-registry，且 name 正确', () => {
    const registries = INSERTED.filter((item) => item.id === REGISTRY_ID)
    expect(registries).toHaveLength(1)
    expect(registries[0]?.name).toBe(REGISTRY_PACKAGE)
  })

  it('恰好一个 @deepseek-ai/dsh-agent-preset 条目（即 preset-pm）', () => {
    const presets = INSERTED.filter((item) => item.name === PRESET_PACKAGE)
    expect(presets).toHaveLength(1)
    expect(presets[0]?.id).toBe(PRESET_ID)
  })

  it('agent-preset-registry.default 是本角色 preset（主会话路径）', () => {
    expect(configOf(byId(REGISTRY_ID)).default).toBe(ROLE)
  })
})

describe('cordis.patch.yml preset 配置', () => {
  it('preset-pm 的 id / order / name / description 合规', () => {
    const config = configOf(byId(PRESET_ID))

    expect(config.id).toBe(ROLE)
    expect(config.order).toBe(10)
    expect(typeof config.name).toBe('string')
    expect((config.name as string).trim()).not.toBe('')
    expect(typeof config.description).toBe('string')
    expect((config.description as string).trim()).not.toBe('')
  })

  it('preset.plugins 恰好 5 项，id / name 顺序与契约一致', () => {
    const plugins = presetPlugins()
    expect(plugins).toHaveLength(5)
    expect(plugins.map((item) => item.id)).toEqual(EXPECTED_PLUGINS.map((item) => item.id))
    expect(plugins.map((item) => item.name)).toEqual(EXPECTED_PLUGINS.map((item) => item.name))
  })

  it('数量守卫：preset.plugins 少于 5 项或多于 5 项都失败', () => {
    const plugins = presetPlugins()
    expect(plugins.length, `工具数不足 5（当前 ${plugins.length} 项）`).toBeGreaterThanOrEqual(5)
    expect(plugins.length, `工具数超过 5（当前 ${plugins.length} 项）`).toBeLessThanOrEqual(5)
  })

  it('tool-todo 固定 allowParallelInProgress: false', () => {
    const todo = presetPlugins().find((item) => item.id === 'tool-todo')
    expect(todo, 'preset.plugins 缺少 tool-todo').toBeDefined()
    expect(configOf(todo as PatchPlugin).allowParallelInProgress).toBe(false)
  })

  it('工具面必须含 tool-web，且不得出现 tool-subagent', () => {
    const ids = presetPlugins().map((item) => item.id)
    expect(ids).toContain('tool-web')
    expect(ids).not.toContain('tool-subagent')
    expect(presetPlugins().map((item) => item.name)).not.toContain('@deepseek-ai/dsh-tool-subagent')
  })
})

describe('cordis.patch.yml 禁词', () => {
  it('全文不出现 rsi-agent / complete / tool-subagent', () => {
    expect(SOURCE).not.toMatch(/rsi-agent/)
    expect(SOURCE).not.toMatch(/complete/)
    expect(SOURCE).not.toMatch(/tool-subagent/)
  })
})
