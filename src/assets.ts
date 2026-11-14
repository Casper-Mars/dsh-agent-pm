/**
 * `pm-assets`：PM 的角色资产，挂在 **preset 层**而不是宿主层。
 *
 * dsh 的 Skill 注册表是 host + per-scope 分层：「由某个 preset 的常驻组合挂载的
 * 插件」注册进该 preset 的层，读取时合并 global 层 + 当前 scope 链、同名就近层
 * 覆盖。把领域 Skill 留在宿主层，单 host 装多个角色包时三种角色的技能会并成
 * 一份；放进 preset 后，每个会话只看得到自己那一份。
 *
 * 本插件只做一件事：把 `PM_DOMAIN.skills` 注册进调用它的 agent scope。
 * persona 由宿主层的 `pm-domain` 注入（那里才拿得到 Agent 与委托深度），
 * 但按 preset id 门控，效果等价。
 *
 * 降级语义与宿主插件一致：`ctx.skills` 缺失或不可注册时只 warn，不阻断装配。
 */
import type { Context } from '@deepseek-ai/cordis'
import { PM_DOMAIN } from './domain.js'
import { createDomainLogger, readService, registerDomainFirmwareSkills } from './plugin.js'

/** 插件唯一标识（必须与 `cordis.patch.yml` 中的 `pm-assets` 一致）。 */
export const name = 'pm-assets'

/**
 * 不声明 `inject`：Skill 注册走 `peekService` 的非严格探测，
 * 服务缺失时降级为一条 warn，而不是让整个 preset 挂载失败。
 */
export const inject: string[] = []

/** 插件装配入口：注册领域 Skill，卸载时按 LIFO 反注册。 */
export function apply(ctx: Context): void {
  const logger = createDomainLogger(readService(ctx, 'logger'), 'pm-assets')

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
