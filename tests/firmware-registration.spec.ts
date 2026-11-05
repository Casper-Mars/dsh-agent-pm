/**
 * 固件 Skill 的**纯逻辑**契约：frontmatter 解析、注册参数构造、重名 / 非法名
 * 校验、注册计划查重。
 *
 * `src/firmware.ts` 与 `dsh-agent-dev/src/firmware.ts @ bc78f02` 同源；本文件只
 * 覆盖不依赖 `src/domain.ts` 声明的部分。真实 core 集成用例与「全部领域
 * Skill 注册参数合规」由任务-02 / 任务-03 补齐。
 */
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildFirmwareSkillRegistration,
  parseFirmwareSkillMarkdown,
  planFirmwareSkillRegistrations,
  type FirmwareSkill,
} from '../src/firmware'

/** 构造一个 frontmatter 完整的临时 Skill。 */
function sample(name: string): FirmwareSkill {
  return {
    name,
    markdown: ['---', `name: ${name}`, 'description: 描述', 'whenToUse: 何时使用', '---', '# 正文'].join('\n'),
  }
}

/* ------------------------------------------------------------------ *
 * 1. frontmatter 解析
 * ------------------------------------------------------------------ */

describe('parseFirmwareSkillMarkdown', () => {
  it('解析三字段并剥离 frontmatter（正文不含元数据）', () => {
    const markdown = [
      '---',
      'name: demo-skill',
      'description: 一句话说明',
      'whenToUse: 什么时候用',
      '---',
      '',
      '# 正文',
      '',
      '细节。',
    ].join('\n')

    const parsed = parseFirmwareSkillMarkdown(markdown, 'demo')
    expect(parsed.name).toBe('demo-skill')
    expect(parsed.description).toBe('一句话说明')
    expect(parsed.whenToUse).toBe('什么时候用')
    expect(parsed.content.startsWith('---')).toBe(false)
    expect(parsed.content).not.toContain('whenToUse')
    expect(parsed.content.trimStart().startsWith('# 正文')).toBe(true)
  })

  it('支持成对引号与 CRLF', () => {
    const markdown = [
      '---',
      'name: "quoted-skill"',
      "description: '单引号描述'",
      'whenToUse: 用',
      '---',
      '正文',
    ].join('\r\n')

    const parsed = parseFirmwareSkillMarkdown(markdown, 'quoted')
    expect(parsed.name).toBe('quoted-skill')
    expect(parsed.description).toBe('单引号描述')
  })

  it('缺 frontmatter → 抛错并点名来源', () => {
    expect(() => parseFirmwareSkillMarkdown('# 没有 frontmatter', 'demo')).toThrowError(
      /demo[\s\S]*frontmatter/,
    )
  })

  it.each(['name', 'description', 'whenToUse'])('缺字段 %s → 抛错并点名字段', (field) => {
    const lines = ['---']
    if (field !== 'name') lines.push('name: demo')
    if (field !== 'description') lines.push('description: 描述')
    if (field !== 'whenToUse') lines.push('whenToUse: 用')
    lines.push('---', '正文')

    expect(() => parseFirmwareSkillMarkdown(lines.join('\n'), 'demo')).toThrowError(
      new RegExp(field),
    )
  })
})

/* ------------------------------------------------------------------ *
 * 2. 注册参数构造
 * ------------------------------------------------------------------ */

describe('buildFirmwareSkillRegistration', () => {
  it('注册参数合规：runtime / directory / 双端可调用 / 正文去 frontmatter', () => {
    const registration = buildFirmwareSkillRegistration(sample('demo-skill'))

    expect(registration.name).toBe('demo-skill')
    expect(registration.source).toBe('runtime')
    expect(registration.invocation).toEqual({ modelInvocable: true, userInvocable: true })
    expect((registration.description as string).length).toBeGreaterThan(0)
    expect((registration.whenToUse as string).length).toBeGreaterThan(0)

    const path = registration.path as string
    expect(path.startsWith('/')).toBe(true)
    expect(path.endsWith(join('skills', 'demo-skill', 'SKILL.md'))).toBe(true)
    expect(registration.resourceBase).toEqual({ kind: 'directory', path: dirname(path) })

    expect(registration.content.startsWith('---')).toBe(false)
    expect(registration.content).not.toContain('name: demo-skill')
    expect((registration.content as string).trim().length).toBeGreaterThan(0)
  })

  it('声明名与 frontmatter.name 不一致（非法声明）→ 抛错且消息含两者', () => {
    const broken: FirmwareSkill = {
      name: 'declared-name',
      markdown: sample('frontmatter-name').markdown,
    }
    expect(() => buildFirmwareSkillRegistration(broken)).toThrowError(/declared-name/)
    expect(() => buildFirmwareSkillRegistration(broken)).toThrowError(/frontmatter-name/)
  })

  it('声明侧 description 可覆盖 frontmatter.description', () => {
    const registration = buildFirmwareSkillRegistration({
      ...sample('override-skill'),
      description: '声明侧描述',
    })
    expect(registration.description).toBe('声明侧描述')
  })

  it.todo('domain 声明接入后：全部领域 Skill 的注册参数逐项合规（任务-02）')
})

/* ------------------------------------------------------------------ *
 * 3. 注册计划查重
 * ------------------------------------------------------------------ */

describe('planFirmwareSkillRegistrations', () => {
  it('声明内重名只注册一次，其余记为 duplicate-declaration', () => {
    const plan = planFirmwareSkillRegistrations([sample('a-skill'), sample('a-skill')])
    expect(plan.registrations.map((item) => item.name)).toEqual(['a-skill'])
    expect(plan.skipped).toEqual([{ name: 'a-skill', reason: 'duplicate-declaration' }])
  })

  it('skip 回调命中 → 跳过并记为 already-registered', () => {
    const plan = planFirmwareSkillRegistrations([sample('a-skill'), sample('b-skill')], {
      skip: (name) => name === 'b-skill',
    })
    expect(plan.registrations.map((item) => item.name)).toEqual(['a-skill'])
    expect(plan.skipped).toEqual([{ name: 'b-skill', reason: 'already-registered' }])
  })

  it('空声明 → 空计划（不抛错）', () => {
    expect(planFirmwareSkillRegistrations(undefined)).toEqual({ registrations: [], skipped: [] })
    expect(planFirmwareSkillRegistrations([])).toEqual({ registrations: [], skipped: [] })
  })
})
