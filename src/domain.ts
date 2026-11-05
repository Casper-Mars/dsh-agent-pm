/**
 * `pm` 领域数据：Skill 元数据与 PM 人设，不依赖任何外部领域包。
 *
 * 单包只声明自己的 Skill：本包仅 `pm-prd` 一个。{@link PMSkill} 只存元数据
 * （name / description / dir），SKILL.md 正文由加载器从 `dir/SKILL.md` 读取，
 * 正文不内联进 `src/`。
 *
 * `dir` 一律由 `import.meta.url` 推导为**绝对路径**：源码态 `src/domain.ts`
 * 与编译态 `dist-server/domain.js` 都解析到包根的 `skills/<name>`。
 */
import { fileURLToPath } from 'node:url'
import { PM_PERSONA } from './persona.js'

/** 领域内单个 Skill 的元数据（正文不入库，由加载器从 `dir/SKILL.md` 读取）。 */
export interface PMSkill {
  /** Skill 名，必须与目录名及 frontmatter.name 一致。 */
  readonly name: string
  /** 模型侧可见的一句话描述（与 frontmatter.description 一致）。 */
  readonly description: string
  /** Skill 目录的绝对路径。 */
  readonly dir: string
}

/** `pm` 领域数据。 */
export interface PMDomain {
  /** 领域标识。 */
  readonly id: 'pm'
  /** 领域版本（与 package.json 版本解耦，随领域契约变更递增）。 */
  readonly version: string
  /** 展示名。 */
  readonly displayName: string
  /** PM 人设正文（主会话常驻）。 */
  readonly personaMarkdown: string
  /** 领域提供的全部 Skill（单一列表，顺序稳定便于 review diff）。 */
  readonly skills: readonly PMSkill[]
}

/** Skill 目录绝对路径：`<包根>/skills/<name>`（源码态 / 编译态同一语义）。 */
function skillDir(name: string): string {
  return fileURLToPath(new URL(`../skills/${name}`, import.meta.url))
}

/** 声明一个 Skill：name / description / dir 一次写全，dir 不允许调用方手拼。 */
function skill(name: string, description: string): PMSkill {
  return { name, description, dir: skillDir(name) }
}

/** `pm` 领域：1 个只读 Skill + PM 人设。 */
export const PM_DOMAIN: PMDomain = {
  id: 'pm',
  version: '0.1.0',
  displayName: 'PM Domain',
  personaMarkdown: PM_PERSONA,
  skills: [
    skill('pm-prd', '为一个需求编写或修订 PRD：判断值不值得做，逼清目标与非目标、角色与场景、范围、AC 与指标。只要用户提到写或改 PRD、澄清模糊需求、评估一个想法、补或评审 AC、排优先级，或从 V2EX / Hacker News / Product Hunt 挖需求证据，就使用本技能，即使用户没有说「PRD」。不用于技术选型、架构决策或实施级技术方案设计。'),
  ],
}
