/**
 * `dsh-agent-pm` 包入口：导出 Cordis 插件三要素与 `pm` 领域数据。
 *
 * `package.json` 的 `exports["."]` 指向本文件的编译产物
 * （`dist-server/index.js`）。
 */
export { name, apply, inject } from './plugin.js'
export { PM_DOMAIN, type PMDomain, type PMSkill } from './domain.js'
export { PM_PERSONA } from './persona.js'
