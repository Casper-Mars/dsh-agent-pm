# dsh-agent-pm

> 在本仓库工作的 agent 请先读 [AGENTS.md](./AGENTS.md)。

`dsh-agent-pm` 是 dsh 的**市场部经理（产品经理）领域原生单包**：装这一个包，就能得到

- **PM persona**：注入主会话（depth 0 根 agent）的常驻 system prompt；
- **1 个只读领域 Skill**：`pm-prd`，随包发布在 `skills/`，运行时由插件注册进 `ctx.skills`；
- **1 个 agent preset**：`pm`，由 `cordis.patch.yml` 装配。

覆盖范围：需求洞察 → 需求诊断 → 定义范围与 AC → 交接技术与开发。不做技术选型、不写实施方案、
不承诺排期与人日。零外部核心依赖：`peerDependencies` 里的 `@deepseek-ai/*` 只提供类型与运行时
服务契约，由 dsh 侧提供，用户无需单独安装。Skill 为**原生只读**：正文只来自包内 `skills/`，
不写盘、不被改写。

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

| 技能 | 触发场景 | 产物 |
|------|----------|------|
| `pm-prd` | 写 / 改 PRD、评估一个想法、澄清模糊需求、补或评审 AC、排优先级、从 V2EX / Hacker News / Product Hunt 挖需求证据 | PRD：目标与非目标、角色与场景、范围、AC、指标；弱信号时交诊断卡片（等级 / 理由 / 证伪条件 / 下一步） |

Skill 的 `description` 与 `whenToUse` 只描述本技能边界，不点名其它领域技能，避免路由串线。
随包 `references/` 与 `assets/` 的每个文件都必须在 `SKILL.md` 正文被点名（`tests/domain.spec.ts`
双向校验）。

## 自检

全部在仓库根目录执行：

```bash
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run：5 个 spec、67 个用例
pnpm build            # 产出 dist-server/（含 cordis.patch.yml 副本）
pnpm verify:install   # 11/11 PASS：1 个 SKILL.md + 1 个 asset + 9 个 references
make check            # build → test → verify → pack
```

| 命令 | 成功判据 |
|------|----------|
| `pnpm typecheck` | 退出码 0，无类型错误 |
| `pnpm test` | **67 passed**、0 failed、0 skipped，退出码 0 |
| `pnpm build` | 退出码 0，产出 `dist-server/index.js` 与 `dist-server/cordis.patch.yml` |
| `pnpm verify:install` | 11 行 `PASS`、退出码 0；任一 `FAIL` 退出码 1；目录 / 参数错误退出码 2 |
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
│  ├─ domain.ts                  # PM_DOMAIN：id / version / displayName / persona / 1 个 Skill 元数据
│  ├─ persona.ts                 # PM_PERSONA：PM 的全部行为规则（人设唯一来源，≤ 70 行）
│  └─ firmware.ts                # SKILL.md 读取 / frontmatter 解析 / SkillRegistration 构造
├─ dist-server/                  # 构建产物：pnpm build 生成，git 忽略，不手工编辑
├─ skills/pm-prd/                # 唯一的 Skill 源（只读，随包发布）
│  ├─ SKILL.md
│  ├─ assets/prd-template.md
│  └─ references/                # 9 个：ac-examples / checklists / diagnosis / doc-checks /
│                                #        hackernews / language / mining / producthunt / v2ex
├─ scripts/
│  ├─ copy-assets.mjs            # 把 cordis.patch.yml 复制进 dist-server/
│  └─ verify-install.mjs         # 11 项包内自检（CLI + 导出纯函数）
├─ tests/                        # 5 个 spec：domain / plugin / patch / firmware-registration / verify-install
├─ AGENTS.md
└─ README.md
```

### 运行时装配

1. `cordis.patch.yml` 插入 `pm-domain` 插件、`agent-preset-registry`（default=`pm`）与 preset `pm`；
2. 插件 `apply()` 从 `ctx.skills` 注册 `pm-prd`（正文读 `skills/pm-prd/SKILL.md`），注册中途失败
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

## 验收记录

> 验收记录占位：L3 / L3' / L4 / L4' 的实测证据（命令、输出、结论、残余风险）由验收阶段填写。
> 本仓库不预填验收结果；未实测的内容不得写入本节。
