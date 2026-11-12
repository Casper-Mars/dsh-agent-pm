# dsh-agent-pm

> 在本仓库工作的 agent 请先读 [AGENTS.md](./AGENTS.md)。

`dsh-agent-pm` 是 dsh 的**市场部经理（产品经理）领域原生单包**：装这一个包，就能得到

- **PM persona**：注入主会话（depth 0 根 agent）的常驻 system prompt；
- **10 个只读领域 Skill**：覆盖洞察、定义、排序、交接、发布、度量、复盘、市场、仓库运营与组织沟通；
- **1 个 agent preset**：`pm`，由 `cordis.patch.yml` 装配。

覆盖范围：机会发现 → 需求定义 → 优先级 → 交接与验收。发布说明、指标口径、复盘材料作为
被动支援能力提供，**不承担发布后结果责任**（发布执行、线上监控与结果复盘由人类或其他角色负责）。
不做技术选型、不写实施方案、不评审代码、不承诺排期与人日。零外部核心依赖：`peerDependencies` 里的
`@deepseek-ai/*` 只提供类型与运行时服务契约，由 dsh 侧提供，用户无需单独安装。
Skill 为**原生只读**：正文只来自包内 `skills/`，不写盘、不被改写。

## 安装

前置：dsh `0.2.1-rc.2`、Node ≥ `22.19.0`、pnpm ≥ `11.7.0`。

```bash
# 在仓库根目录：安装依赖并编译（产出 dist-server/）
pnpm install
pnpm build

# 装进指定 profile（首次使用会自动初始化 profile）
dsh plugin --profile <p> add link:$PWD
```

`link:` 安装的是当前目录，改动后需要 `pnpm build` 重新生成 `dist-server/`；`main` 指向
`dist-server/index.js`，不编译则加载失败。

### 装完核对组合树

```bash
dsh --profile <p> --dump-config | grep -E "pm-domain|preset-pm"
```

应能看到 `pm-domain`（`inject: ['skills', 'agents']`）、`agent-preset-registry.default: pm`，
以及唯一的 preset `pm`。

## 技能

| 技能 | 触发场景 | 核心产物 |
|------|----------|----------|
| `pm-discovery` | 评估想法、设计访谈、挖需求证据、判断信号强弱、画机会树 | 诊断卡片、访谈快照、机会树 |
| `pm-prd` | 写/改 PRD、写 PR-FAQ、评审需求文档、补或评审 AC | PRD / PR-FAQ |
| `pm-prioritize` | 排优先级、砍范围、做路线图、需求池分层 | 排序表、Now-Next-Later |
| `pm-handoff` | 交接开发、解释边界、处理变更、切故事、UAT | 交接包、变更单、验收记录 |
| `pm-metrics` | 定指标与口径、设计实验、上线读数 | 指标定义、实验方案、readout |
| `pm-competitive` | 竞品分析、市场地图、定位、定价 | 竞品矩阵、定位陈述 |
| `pm-launch` | 发布说明、发布检查、灰度回滚、发布赋能 | 发布清单、release notes |
| `pm-repo-ops` | GitHub 事件、issue/PR 处理、社区回复、标签维护 | 四段评论 + 标签 |
| `pm-stakeholder` | 决策材料、周报、跨部门冲突、评审会 | 决策备忘录、周报 |
| `pm-retro` | 上线复盘、假设验证、结论回填 | 复盘摘要、readout |

Skill 的 `description` 与 `whenToUse` 只描述本技能边界，不点名其它领域技能，避免路由串线。
每个技能都有至少一个 `assets/` 模板与一个 `references/` 参考文档，且每个文件都在对应
`SKILL.md` 正文被点名（`tests/domain.spec.ts` 双向校验）。

## 自检

全部在仓库根目录执行：

```bash
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run：5 个 spec、130 个用例
pnpm build            # 产出 dist-server/（含 cordis.patch.yml 副本）
pnpm verify:install   # 56/56 PASS：10 个 SKILL.md + 14 个 asset + 32 个 reference
make check            # build → test → verify → pack
```

| 命令 | 成功判据 |
|------|----------|
| `pnpm typecheck` | 退出码 0，无类型错误 |
| `pnpm test` | **130 passed**、0 failed、0 skipped，退出码 0 |
| `pnpm build` | 退出码 0，产出 `dist-server/index.js` 与 `dist-server/cordis.patch.yml` |
| `pnpm verify:install` | 56 行 `PASS`、退出码 0；任一 `FAIL` 退出码 1；目录 / 参数错误退出码 2 |
| `make check` | 上述 build / test / verify 全通过，且 `npm pack --dry-run` 清单正常 |

`verify:install` 默认检查**包内** `skills/`，不需要安装到 profile；`--assets <dir>` 仅用于手工
核查任意目录下的 `skills/` 布局，不是默认路径：

```bash
node scripts/verify-install.mjs --assets /path/to/skills
```

## 目录

```text
.
├─ .gitignore                    # 忽略 node_modules/ 与构建产物
├─ .npmrc                        # pnpm 安装策略
├─ LICENSE                       # Apache-2.0
├─ Makefile                      # make check / stage-dry / publish
├─ cordis.patch.yml              # bundle patch：pm-domain + 注册表默认值 + preset-pm
├─ package.json                  # dsh.bundle.patch 指向 cordis.patch.yml；files 含 skills/
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ tsconfig.json                 # 类型检查
├─ tsconfig.server.json          # 编译到 dist-server/
├─ vitest.config.ts
├─ src/
│  ├─ index.ts                   # 包入口：re-export 插件三要素与领域数据
│  ├─ plugin.ts                  # Cordis 插件：注入 ['skills','agents']；注册 Skill；depth 0 注入 persona
│  ├─ domain.ts                  # PM_DOMAIN：id / version / displayName / persona / 10 个 Skill 元数据
│  ├─ persona.ts                 # PM_PERSONA：PM 的全部行为规则（人设唯一来源，≤ 70 行）
│  └─ firmware.ts                # SKILL.md 读取 / frontmatter 解析 / SkillRegistration 构造
├─ dist-server/                  # 构建产物：pnpm build 生成，git 忽略，不手工编辑
├─ skills/
│  ├─ pm-discovery/              # 1 asset + 7 references
│  ├─ pm-prd/                    # 2 assets + 5 references
│  ├─ pm-prioritize/             # 1 asset + 2 references
│  ├─ pm-handoff/                # 2 assets + 2 references
│  ├─ pm-metrics/                # 2 assets + 3 references
│  ├─ pm-competitive/            # 1 asset + 2 references
│  ├─ pm-launch/                 # 2 assets + 2 references
│  ├─ pm-repo-ops/               # 1 asset + 4 references
│  ├─ pm-stakeholder/            # 1 asset + 2 references
│  └─ pm-retro/                  # 1 asset + 3 references
├─ scripts/
│  ├─ copy-assets.mjs            # 把 cordis.patch.yml 复制进 dist-server/
│  └─ verify-install.mjs         # 56 项包内自检（CLI + 导出纯函数）
├─ tests/                        # 5 个 spec：domain / plugin / patch / firmware-registration / verify-install
├─ AGENTS.md
└─ README.md
```

### 运行时装配

1. `cordis.patch.yml` 插入 `pm-domain` 插件、`agent-preset-registry`（default=`pm`）与 preset `pm`；
2. 插件 `apply()` 从 `ctx.skills` 注册 10 个 Skill（正文读 `skills/<name>/SKILL.md`），注册中途失败
   原子回滚，卸载按 LIFO 反注册；
3. 插件监听 `agent/created`，只给 **depth 0** 根 agent 注入 `PM_PERSONA`；子 agent 使用各自
   preset 的 persona。

## 硬约束

- **一个 profile 只装一个角色包**：`dsh-agent-pm` 与 `dsh-agent-cto` 都占用
  `agent-preset-registry.default` 与同一个 `deployment:persona-prefix` 槽位，双装必然互相覆盖。
- `src/plugin.ts` / `src/firmware.ts` 与 `dsh-agent-dev`、`dsh-agent-cto` 同源：改注入器或加载器
  必须三仓同改并各自跑测试。
- 角色包不做子 agent 编排，不挂 `tool-subagent`；跨角色协作走驿传派单。
- 本轮不发布 npm，只用本地 `link:` 装配验收。

## 版本

- `0.2.2`：修「完备 = 可计数」问题（issue #1）。非目标的合格判据从「≥3 条」改为「能指出挡住哪次
  具体越界」；「未决」从必填章节/必填段改为条件项（无则写「无」）；模板去掉空槽；新增反凑数红线
  与 `tests/rule-integrity.spec.ts` 回归断言。
- `0.2.1`：按用户决定收窄角色边界，移除「发布后结果」责任；职责回到五件事（洞察、诊断、定义、
  排序、交付），launch / metrics / retro 降为被动支援技能。
- `0.2.0`：从单技能 `pm-prd` 扩展为 10 个技能，覆盖完整产品生命周期；人设扩为六项职责并加入
  强制路由规则；自检从 11 项扩展到 56 项。
- `0.1.0`：初始迁移版，仅 `pm-prd`。
