/**
 * `pm-assets`：PM 的角色资产，挂在 **preset 层**而不是宿主层。
 *
 * dsh 的 Skill 注册表是 host + per-scope 分层：「由某个 preset 的常驻组合挂载的
 * 插件」注册进该 preset 的层，读取时合并 global 层 + 当前 scope 链、同名就近层
 * 覆盖。把领域 Skill 留在宿主层，单 host 装多个角色包时三种角色的技能会并成
 * 一份；放进 preset 后，每个会话只看得到自己那一份。
 *
 * 本插件做两件事，都只作用于调用它的 agent scope：
 *   1. 注册 `PM_DOMAIN.skills`；
 *   2. 注册 PM persona（system prompt 的 `deployment:persona-prefix` 槽位）。
 *
 * persona 放在 preset 层而不是宿主层：它必须和 preset 组合同生共死。宿主层
 * 只在 `agent/created` 时注入一次，用户在首轮前切到别的 preset 会留在旧人设上；
 * 挂在 preset 里，切换时旧 scope 销毁、新人设随新 scope 挂载。
 *
 * 降级语义：`ctx.skills` / `ctx.systemPrompt` 缺失时只 warn，不阻断装配。
 */
import type { Context } from '@deepseek-ai/cordis'
import { PM_DOMAIN } from './domain.js'
import { PM_PERSONA } from './persona.js'
import { createDomainLogger, readService, registerDomainFirmwareSkills } from './plugin.js'

/** 插件唯一标识（必须与 `cordis.patch.yml` 中的 `pm-assets` 一致）。 */
export const name = 'pm-assets'

/**
 * 不声明 `inject`：Skill 注册走 `peekService` 的非严格探测，
 * 服务缺失时降级为一条 warn，而不是让整个 preset 挂载失败。
 */
export const inject: string[] = []

/** PM persona 占用的 system prompt 槽位（与 `@deepseek-ai/dsh-persona` 的 prefix 槽位一致）。 */
const PERSONA_SECTION = 'deployment:persona-prefix'

/** `ctx.systemPrompt` 的最小结构（非严格读取，缺失时降级）。 */
interface SystemPromptLike {
  section(section: { name: string; order: number; text: string }): () => void
  getSectionOrder(name: string): number
}

function readSystemPrompt(ctx: Context): SystemPromptLike | undefined {
  const value = readService(ctx, 'systemPrompt')
  if (
    value !== null
    && typeof value === 'object'
    && typeof (value as SystemPromptLike).section === 'function'
    && typeof (value as SystemPromptLike).getSectionOrder === 'function'
  ) {
    return value as SystemPromptLike
  }
  return undefined
}

/** 插件装配入口：注册 persona 与领域 Skill，卸载时由 scope 统一释放。 */
export function apply(ctx: Context): void {
  const logger = createDomainLogger(readService(ctx, 'logger'), 'pm-assets')

  ctx.effect(() => {
    const prompt = readSystemPrompt(ctx)
    if (prompt === undefined) {
      logger.warn('preset scope 缺少 systemPrompt 服务，PM persona 降级为不注入（Skill 注册不受影响）')
      return () => {}
    }
    return prompt.section({
      name: PERSONA_SECTION,
      order: prompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
      text: PM_PERSONA,
    })
  }, 'pm-assets:persona')

  ctx.effect(() => {
    const unregisters = registerDomainFirmwareSkills(ctx, PM_DOMAIN.skills, logger, {
      // 这里的 ctx 是 agent 的 preset scope：宿主层读不到这些 Skill，
      // 「注册后是否可见」的核验只会产生假告警，关掉。
      verifyWinner: false,
    })

    return () => {
      for (let index = unregisters.length - 1; index >= 0; index -= 1) {
        try {
          unregisters[index]?.()
        } catch (error) {
          logger.warn('领域 Skill 反注册失败', error)
        }
      }
    }
  }, 'pm-assets:register-skills')
}
