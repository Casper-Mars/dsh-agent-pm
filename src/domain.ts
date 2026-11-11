/**
 * `pm` 领域数据：Skill 元数据与 PM 人设，不依赖任何外部领域包。
 *
 * 单包声明 10 个只读 Skill，覆盖 PM 完整价值链：洞察 → 定义 → 排序 → 交接 →
 * 发布 → 度量 → 复盘，外加市场、仓库运营与组织沟通。{@link PMSkill} 只存元数据
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

/** `pm` 领域：10 个只读 Skill + PM 人设。 */
export const PM_DOMAIN: PMDomain = {
  id: 'pm',
  version: '0.2.1',
  displayName: 'PM Domain',
  personaMarkdown: PM_PERSONA,
  skills: [
    skill(
      'pm-discovery',
      '评估一个想法是否值得做、设计用户访谈、从社区与反馈中挖需求证据、判断信号强弱并画出机会树时使用。不用于写 PRD、技术选型或实施方案设计。',
    ),
    skill(
      'pm-prd',
      '为一个需求编写或修订 PRD / PR-FAQ、评审需求文档、补或评审验收条件时使用。只要用户提到 PRD、需求文档、验收条件、目标与非目标，就使用本技能。不用于技术选型与实施方案设计。',
    ),
    skill(
      'pm-prioritize',
      '给需求排优先级、砍范围、做路线图、给需求池分层、决定先做什么与不做什么时使用。不用于估算人日或承诺上线日期。',
    ),
    skill(
      'pm-handoff',
      '把需求交接给技术与开发、解释需求边界、处理范围变更、切分故事、做产品侧验收时使用。不用于技术方案设计与代码评审。',
    ),
    skill(
      'pm-metrics',
      '定义产品指标与口径、设计 A/B 实验、做上线读数时使用。只要用户提到指标、北极星、漏斗、实验、留存、转化或 readout，就使用本技能。',
    ),
    skill(
      'pm-competitive',
      '做竞品分析、市场地图、用户分层、定位与定价时使用。不用于技术选型与销售话术。',
    ),
    skill(
      'pm-launch',
      '写发布说明、做发布检查、决定灰度与回滚、准备销售与客服赋能材料时使用。不用于代码发布执行与 CI 配置。',
    ),
    skill(
      'pm-repo-ops',
      '收到 GitHub 仓库事件、处理 issue 与 PR、回复社区、维护需求池标签时使用。不评审代码、不合并 PR、不承诺排期。',
    ),
    skill(
      'pm-stakeholder',
      '准备决策材料、写周报、处理跨部门冲突、组织评审会时使用。不替决策人拍板，不承诺排期。',
    ),
    skill(
      'pm-retro',
      '上线后复盘、验证假设、对比目标与结果、把结论回填机会树时使用。没有数据时不做复盘。',
    ),
  ],
}
