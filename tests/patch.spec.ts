/**
 * `cordis.patch.yml` 的结构契约。
 *
 * 任务-01 只断言「结构正确」：一个 insert 块、恰好三条插入项、领域插件条目与
 * `src/plugin.ts` 对齐、`agent-preset-registry.default` 指向本角色 preset。
 * preset 内工具面、双装冲突等细节断言由任务-04 补齐。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { inject as pluginInject, name as pluginName } from '../src/plugin'

const PATCH_FILE = fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))
const SOURCE = readFileSync(PATCH_FILE, 'utf8')

interface PatchPlugin {
  id?: string
  name?: string
  inject?: string[]
  config?: Record<string, unknown>
}

interface PatchEntry {
  insert?: PatchPlugin[]
}

const PATCH = parse(SOURCE) as PatchEntry[]
const INSERTED: PatchPlugin[] = PATCH.flatMap((entry) => entry.insert ?? [])

const byId = (id: string): PatchPlugin => {
  const found = INSERTED.find((item) => item.id === id)
  expect(found, `cordis.patch.yml 缺少 insert 项 "${id}"`).toBeDefined()
  return found as PatchPlugin
}

describe('cordis.patch.yml 结构', () => {
  it('只有一个 insert 块，恰好三条插入项（领域 / 注册表 / preset）', () => {
    expect(PATCH.filter((entry) => entry.insert !== undefined)).toHaveLength(1)
    expect(INSERTED.map((item) => item.id)).toEqual([
      'pm-domain',
      'agent-preset-registry',
      'preset-pm',
    ])
  })

  it('pm-domain 条目的 name / inject 与 src/plugin.ts 逐项一致（且无 config）', () => {
    const entry = byId('pm-domain')

    // 单一真源：plugin 导出即契约，patch 必须逐项照抄。
    expect(pluginName).toBe('pm-domain')
    expect(pluginInject).toEqual(['skills', 'agents'])

    // patch 的 `id` 是插件实例 id，对应 plugin 导出的 name；
    // `name` 是 npm 包名，用于解析模块，两者不是同一个字段。
    expect(entry.id).toBe(pluginName)
    expect(entry.name).toBe('dsh-agent-pm')
    expect(entry.inject).toEqual(pluginInject)
    expect(entry.config).toBeUndefined()
  })

  it('agent-preset-registry.default 是本角色 preset（主会话路径）', () => {
    const config = byId('agent-preset-registry').config as { default?: string }
    expect(config.default).toBe('pm')
  })

  it('preset-pm 的 id 与角色一致', () => {
    const config = byId('preset-pm').config as { id?: string }
    expect(config.id).toBe('pm')
  })

  it('角色包不做编排：不出现 tool-subagent，也不做 complete 覆盖', () => {
    expect(SOURCE).not.toMatch(/tool-subagent/)
    expect(SOURCE).not.toMatch(/complete\s*:\s*true/)
  })
})
