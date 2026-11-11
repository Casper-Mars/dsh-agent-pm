# 事件路由

| event / action | 进入 | 主要动作 |
|---|---|---|
| issues.opened / reopened | issue-opened | 去重、五道判定、标签、评论 |
| issues.edited | issue-edit | 仅实质变化时重判 |
| issues.labeled / unlabeled | issue-label | 尊重人工覆盖，P0 通知 CTO |
| issues.closed | issue-closed | 校验关闭理由，不重复评论 |
| issue_comment.created（issue） | issue-comment | 分类后回复或补证 |
| issue_comment.created（PR） | pr-comment | 只做产品侧回应 |
| pull_request.opened / ready_for_review | pr-opened | 关联 issue、AC、用户影响、文档、范围 |
| pull_request_review.submitted | pr-review | AC / 用户影响是否变化 |
| pull_request.closed（merged） | pr-merged | 关 issue、写 release note 条目、感谢 |
| release.published | release | 用户语言发布说明 |
| discussion.* | community | 问答、引导开 issue |
| security_advisory.* | security | 不公开，转私密，通知 CTO |

## 忽略清单

- bot、自己（评论带 `<!-- repo-ops:`）
- draft PR 的 opened
- push 到 feature 分支
- star / watch / fork
- 纯代码行内 review comment

## 规则

- 一条事件只处理主对象，不顺手处理其它 issue。
- 规则模块只做过滤与分类，判断留给技能。
- 不确定时进 issue-comment，不猜 workflow。
