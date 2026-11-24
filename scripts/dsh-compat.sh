#!/usr/bin/env bash
#
# dsh 版本兼容性校验：把本包**按发布形态打包**后装进一个全新的 dsh 环境，
# 依次验证「安装准入 → patch 组合 → 运行时装配」三层。
#
#   pnpm compat                # 校验 npm 上的 latest（默认）
#   pnpm compat 0.2.2-rc.2     # 校验指定版本
#   bash scripts/dsh-compat.sh latest 0.2.2-rc.2   # 一次校验多个
#
# 与 CI 完全同一条路径（.github/workflows/dsh-compat.yml），本地能过即 CI 能过。
#
# 三层判据：
#   1. 安装准入：dsh 用包自带的 engines.dsh / peerDependencies 判定兼容性，
#      不满足会直接拒绝安装并打印 requirements（这是 manifest 层）；
#   2. patch 组合：`dsh --profile <p> --dump-config` 能把 preset 注册表与 preset `pm`
#      组进配置树（这是装配层，schema 变更会在这里炸）；期望值**不写死**，
#      由 `cordis.patch.yml` 派生（见 read_needles），patch 结构变则期望自动跟变；
#   3. 运行时装配：冷启动 profile，断言 skills 服务契约与 preset roster
#      （这是运行层，服务契约变更 / 模块解析失败会在这里暴露）。
#
# 调试入口：`bash scripts/dsh-compat.sh --print-needles` 只打印第 2 层派生出的期望值，
# 不发网络请求；`COMPAT_PATCH_FILE=<path>` 可换成别的 patch（tests/compat-needles.spec.ts 用它做防回归）。
#
# 退出码：全部目标通过为 0，任一目标失败为 1，用法错误为 2。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="compat"
FAILED=0
RESULTS=()
PATCH_FILE="${COMPAT_PATCH_FILE:-$ROOT/cordis.patch.yml}"

log() { printf '\n\033[1m[dsh-compat] %s\033[0m\n' "$*"; }
ok() { printf '\033[32m[dsh-compat] PASS %s\033[0m\n' "$*"; }
err() { printf '\033[31m[dsh-compat] FAIL %s\033[0m\n' "$*" >&2; }

if [ "$#" -eq 0 ]; then
  set -- latest
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "需要 node 与 npm 在 PATH 中" >&2
  exit 2
fi

# 第 2 层（patch 组合）的期望值：从 `cordis.patch.yml` 这一份真源派生，
# **不写死** plugin id 与默认 preset —— 写死的期望值会在 patch 结构演进后变成假红灯。
# 派生规则：每个 insert 项的 `id` → `id: <id>`；preset 注册表的 `config.default` → `default: <值>`。
read_needles() {
  (cd "$ROOT" && node --input-type=module -e '
    import { readFileSync } from "node:fs"
    import { parse } from "yaml"

    const [, patchFile] = process.argv
    const entries = parse(readFileSync(patchFile, "utf8")) ?? []
    const inserted = Array.isArray(entries)
      ? entries.flatMap((entry) => (Array.isArray(entry?.insert) ? entry.insert : []))
      : []
    const needles = []
    for (const item of inserted) {
      if (typeof item?.id === "string" && item.id !== "") needles.push(`id: ${item.id}`)
      if (item?.name === "@deepseek-ai/dsh-agent-preset-registry") {
        const value = item?.config?.default
        if (typeof value === "string" && value !== "") needles.push(`default: ${value}`)
      }
    }
    process.stdout.write(needles.length === 0 ? "" : `${needles.join("\n")}\n`)
  ' "$PATCH_FILE")
}

# 派生结果为空说明 patch 结构与派生规则脱节了：宁可报错，也不能让第 2 层空过。
collect_needles() {
  local derived
  if [ ! -f "$PATCH_FILE" ]; then
    err "找不到 patch 文件：$PATCH_FILE"
    return 1
  fi
  if ! derived="$(read_needles)"; then
    err "无法从 $PATCH_FILE 派生组合层期望值（YAML 解析失败？）"
    return 1
  fi
  if [ -z "$derived" ]; then
    err "$PATCH_FILE 未派生出任何组合层期望值（insert 结构无法识别）"
    return 1
  fi
  printf '%s\n' "$derived"
}

# 只打印派生出的期望值，不发网络请求、不打包：给 tests/ 做「结构变了期望是否跟着变」的回归。
if [ "${1:-}" = "--print-needles" ]; then
  collect_needles
  exit $?
fi

# 发布内容依赖 dist-server/：缺了就现编译，避免用旧产物做兼容结论。
if [ ! -f "$ROOT/dist-server/index.js" ]; then
  log "未发现 dist-server/，先执行 pnpm build"
  (cd "$ROOT" && pnpm build) || { err "pnpm build 失败"; exit 1; }
fi

TARBALL="$(cd "$ROOT" && npm pack --silent --pack-destination "${TMPDIR:-/tmp}" | tail -1)"
if [ -z "$TARBALL" ] || [ ! -f "${TMPDIR:-/tmp}/$TARBALL" ]; then
  err "npm pack 未产出 tarball"
  exit 1
fi
TARBALL="${TMPDIR:-/tmp}/$TARBALL"
log "打包完成：$TARBALL"

# 第 2 层的期望值只派生一次，所有目标共用；派生失败直接终止（不带着空期望跑 combo）。
NEEDLES="$(collect_needles)" || exit 1

# 每个目标版本一个完全隔离的 dsh 安装目录 + DSH_HOME，互不污染。
check_one() {
  local target="$1"
  local work
  work="$(mktemp -d "${TMPDIR:-/tmp}/dsh-compat-XXXXXX")"

  log "=== 目标 dsh：$target ==="

  (
    set -e
    cd "$work"
    printf '{"name":"dsh-compat-sandbox","private":true}\n' > package.json

    npm install --no-audit --no-fund --silent "@deepseek-ai/dsh@$target" >/dev/null
    local dsh="$work/node_modules/.bin/dsh"
    [ -x "$dsh" ] || { err "@deepseek-ai/dsh@$target 未提供 dsh 可执行文件"; exit 1; }

    local resolved
    resolved="$("$dsh" --version)"
    echo "[dsh-compat] 解析到的实际版本：$resolved"

    export DSH_HOME="$work/home"
    mkdir -p "$DSH_HOME"

    # 1) 安装准入 + 2) 组合：install 失败会打印 dsh 的兼容性判定细节
    if ! "$dsh" plugin --profile "$PROFILE" add "$TARBALL" > "$work/install.log" 2>&1; then
      err "安装被拒绝（dsh $resolved）"
      sed 's/^/    /' "$work/install.log" >&2
      exit 1
    fi
    echo "[dsh-compat] PASS 插件安装准入（manifest 兼容）"

    if ! "$dsh" --profile "$PROFILE" --dump-config > "$work/dump.yml" 2> "$work/dump.err"; then
      err "profile 组合失败（dsh $resolved）"
      sed 's/^/    /' "$work/dump.err" >&2
      exit 1
    fi

    local missing=0
    local needle
    while IFS= read -r needle; do
      [ -n "$needle" ] || continue
      if ! grep -qF "$needle" "$work/dump.yml"; then
        err "组合结果缺少「$needle」（期望值派生自 $(basename "$PATCH_FILE")）"
        missing=1
      fi
    done <<< "$NEEDLES"
    [ "$missing" -eq 0 ] || exit 1
    echo "[dsh-compat] PASS patch 组合（派生期望全部命中）"

    # 3) 运行时：探针必须从 dsh 安装目录运行，裸导入 @deepseek-ai/dsh 才能解析
    cp "$ROOT/scripts/compat-probe.mjs" "$work/probe.mjs"
    if ! PROBE_PROFILE="$PROFILE" PROBE_TIMEOUT_MS=90000 node "$work/probe.mjs" 2>&1 | sed 's/^/    /' | tee "$work/probe.log"; then
      err "运行时探针失败（dsh $resolved）"
      exit 1
    fi
    if ! grep -q "运行时探针全部通过" "$work/probe.log"; then
      err "运行时探针未通过（dsh $resolved）"
      exit 1
    fi
    echo "[dsh-compat] PASS 运行时装配（skills 服务契约 + preset roster）"
  )

  local status=$?
  rm -rf "$work"
  if [ "$status" -eq 0 ]; then
    ok "dsh $target 兼容"
    RESULTS+=("PASS  $target")
  else
    err "dsh $target 不兼容"
    RESULTS+=("FAIL  $target")
    FAILED=1
  fi
}

for target in "$@"; do
  check_one "$target"
done

printf '\n[dsh-compat] 汇总：\n'
printf '  %s\n' "${RESULTS[@]}"

if [ "$FAILED" -ne 0 ]; then
  exit 1
fi
printf '\n\033[32m[dsh-compat] 全部目标兼容\033[0m\n'
