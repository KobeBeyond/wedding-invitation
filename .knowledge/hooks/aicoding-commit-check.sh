#!/bin/sh
# =============================================================================
# aicoding-commit-check.sh — AICoding commit-message 规范校验（可复用核心）
# =============================================================================
# 用法：sh aicoding-commit-check.sh <commit-msg-file>
#
# 规范来源（单一真源）：.knowledge/constraints/ai-commit-spec.md
#
# 校验规则：
#   1. 标题必须含且仅含 [AI Generated] 或 [Human Coded] 之一（大小写不敏感）
#   2. 自动生成消息跳过（Merge / Revert / fixup! / squash! / amend! 开头）
#   3. AI 分支：
#      - 标题匹配 ^[0-9]{5,} \[AI Generated\] .+
#      - body 含 ^Generated-By: .+$
#      - body 含 ^Turns: [1-9][0-9]*$（正整数，不允许 0）
#   4. Human 分支：
#      - 标题匹配 ^[0-9]{5,} \[Human Coded\] .+
#      - body 含 ^Reason: .+$
# =============================================================================

set -u

# --- 入参检查 -----------------------------------------------------------------
if [ $# -lt 1 ] || [ -z "$1" ]; then
    printf '\033[0;31m✗ 用法：sh aicoding-commit-check.sh <commit-msg-file>\033[0m\n' >&2
    exit 1
fi

COMMIT_MSG_FILE="$1"

if [ ! -f "$COMMIT_MSG_FILE" ]; then
    printf '\033[0;31m✗ 找不到 commit message 文件：%s\033[0m\n' "$COMMIT_MSG_FILE" >&2
    exit 1
fi

# --- 颜色定义 -----------------------------------------------------------------
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# --- 打印"期望格式"帮助块 -------------------------------------------------------
print_format_help() {
    printf '\n'
    printf "${BOLD}${CYAN}══════════════════════════════════════════════════════${NC}\n"
    printf "${BOLD}  AICoding Commit Message 格式要求${NC}\n"
    printf "${CYAN}══════════════════════════════════════════════════════${NC}\n"
    printf '\n'
    printf "${BOLD}▶ AI 提交（代码主要由 AI 生成）：${NC}\n"
    printf "${GREEN}"
    printf '    <ONES_ID> [AI Generated] <描述>\n'
    printf '\n'
    printf '    Generated-By: <工具名>\n'
    printf '    Turns: <正整数，不能为0>\n'
    printf "${NC}"
    printf '\n'
    printf "${DIM}  示例：${NC}\n"
    printf "${DIM}    94480744 [AI Generated] 补充医药搜索双列瀑布流框架${NC}\n"
    printf "${DIM}    ${NC}\n"
    printf "${DIM}    Generated-By: CatDesk${NC}\n"
    printf "${DIM}    Turns: 7${NC}\n"
    printf '\n'
    printf "${BOLD}▶ Human 提交（代码由人手写）：${NC}\n"
    printf "${GREEN}"
    printf '    <ONES_ID> [Human Coded] <描述>\n'
    printf '\n'
    printf '    Reason: <原因，不能为空>\n'
    printf "${NC}"
    printf '\n'
    printf "${DIM}  示例：${NC}\n"
    printf "${DIM}    94480744 [Human Coded] 修复支付极端机型崩溃${NC}\n"
    printf "${DIM}    ${NC}\n"
    printf "${DIM}    Reason: AI 多次尝试无法定位原生 crash 根因，改人工调试${NC}\n"
    printf '\n'
    printf "${YELLOW}  规范文档：.knowledge/constraints/ai-commit-spec.md${NC}\n"
    printf "${CYAN}══════════════════════════════════════════════════════${NC}\n"
    printf '\n'
}

# --- 读取 commit message（剔除注释行）-----------------------------------------
# TITLE：第一条非空、非注释行
# BODY 检查：直接对文件进行 grep（保持行结构，避免变量截断问题）

TITLE=$(grep -v '^#' "$COMMIT_MSG_FILE" | grep -v '^[[:space:]]*$' | head -1)

# 标题为空时直接拒绝
if [ -z "$TITLE" ]; then
    printf "${RED}✗ commit message 不能为空${NC}\n" >&2
    print_format_help >&2
    exit 1
fi

# --- 跳过自动生成的 commit 类型 ------------------------------------------------
# Merge / Revert / fixup! / squash! / amend! 开头的消息由 git 自动生成，跳过检查
case "$TITLE" in
    Merge\ *|Revert\ *|"fixup! "*|"squash! "*|"amend! "*)
        exit 0
        ;;
esac

# --- 检测标签存在性（大小写不敏感）---------------------------------------------
HAS_AI=0
HAS_HUMAN=0

if echo "$TITLE" | grep -qi '\[AI Generated\]'; then
    HAS_AI=1
fi
if echo "$TITLE" | grep -qi '\[Human Coded\]'; then
    HAS_HUMAN=1
fi

# 两者都缺失
if [ "$HAS_AI" -eq 0 ] && [ "$HAS_HUMAN" -eq 0 ]; then
    printf "${RED}✗ 标题中缺少标记：必须包含 [AI Generated] 或 [Human Coded] 之一${NC}\n" >&2
    printf "${DIM}  当前标题：%s${NC}\n" "$TITLE" >&2
    print_format_help >&2
    exit 1
fi

# 两者同时存在（互斥）
if [ "$HAS_AI" -eq 1 ] && [ "$HAS_HUMAN" -eq 1 ]; then
    printf "${RED}✗ [AI Generated] 与 [Human Coded] 互斥，标题中只能出现其中一个${NC}\n" >&2
    printf "${DIM}  当前标题：%s${NC}\n" "$TITLE" >&2
    print_format_help >&2
    exit 1
fi

# =============================================================================
# AI 分支校验
# =============================================================================
if [ "$HAS_AI" -eq 1 ]; then

    # 标题格式：^[0-9]{5,} \[AI Generated\] .+  （大小写不敏感）
    if ! echo "$TITLE" | grep -qiE '^[0-9]{5,} \[AI Generated\] .+'; then
        printf "${RED}✗ [AI Generated] 标题格式不正确${NC}\n" >&2
        printf "${YELLOW}  期望：<≥5位数字 ONES ID> [AI Generated] <描述>${NC}\n" >&2
        printf "${DIM}  当前：%s${NC}\n" "$TITLE" >&2
        printf "${YELLOW}  常见问题：ONES ID 不足 5 位，或 [AI Generated] 后缺少描述${NC}\n" >&2
        print_format_help >&2
        exit 1
    fi

    # body 必须包含 Generated-By: <工具>
    if ! grep -v '^#' "$COMMIT_MSG_FILE" | grep -qE '^Generated-By: .+'; then
        printf "${RED}✗ [AI Generated] 提交缺少必填字段 Generated-By${NC}\n" >&2
        printf "${YELLOW}  请在 body 中添加一行：Generated-By: <工具名，如 CatDesk / Claude Code / CatPaw>${NC}\n" >&2
        print_format_help >&2
        exit 1
    fi

    # body 必须包含 Turns: <正整数>（不允许 0）
    if ! grep -v '^#' "$COMMIT_MSG_FILE" | grep -qE '^Turns: [1-9][0-9]*$'; then
        # 判断是 "Turns 行缺失" 还是 "Turns 值非法"（0 / 非整数）
        if grep -v '^#' "$COMMIT_MSG_FILE" | grep -qiE '^Turns:'; then
            printf "${RED}✗ Turns 值不合法：必须为正整数（≥1），不允许 0 或非数字${NC}\n" >&2
        else
            printf "${RED}✗ [AI Generated] 提交缺少必填字段 Turns${NC}\n" >&2
            printf "${YELLOW}  请在 body 中添加一行：Turns: <本次提交的人机有效轮次，≥1>${NC}\n" >&2
        fi
        print_format_help >&2
        exit 1
    fi

    exit 0
fi

# =============================================================================
# Human 分支校验
# =============================================================================
if [ "$HAS_HUMAN" -eq 1 ]; then

    # 标题格式：^[0-9]{5,} \[Human Coded\] .+  （大小写不敏感）
    if ! echo "$TITLE" | grep -qiE '^[0-9]{5,} \[Human Coded\] .+'; then
        printf "${RED}✗ [Human Coded] 标题格式不正确${NC}\n" >&2
        printf "${YELLOW}  期望：<≥5位数字 ONES ID> [Human Coded] <描述>${NC}\n" >&2
        printf "${DIM}  当前：%s${NC}\n" "$TITLE" >&2
        printf "${YELLOW}  常见问题：ONES ID 不足 5 位，或 [Human Coded] 后缺少描述${NC}\n" >&2
        print_format_help >&2
        exit 1
    fi

    # body 必须包含 Reason: <原因>
    if ! grep -v '^#' "$COMMIT_MSG_FILE" | grep -qE '^Reason: .+'; then
        printf "${RED}✗ [Human Coded] 提交缺少必填字段 Reason${NC}\n" >&2
        printf "${YELLOW}  请在 body 中添加一行：Reason: <本次为何走人工提交的原因>${NC}\n" >&2
        print_format_help >&2
        exit 1
    fi

    exit 0
fi

# 理论上不会到这里（上面的 HAS_AI / HAS_HUMAN 必有一个为 1）
exit 1
