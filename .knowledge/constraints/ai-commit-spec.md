# Commit Message 规范（单一真源）

> 📅 last_verified: 2026-05-20 | ttl: 180d | owner: huangweiren
>
> **本文是本仓库 commit message 的唯一权威规范**。`AGENTS.md` / `CLAUDE.md` / `.knowledge/constraints/rules.md` / `.husky/commit-msg` 均引用本文，**修改规范请只改本文**，再让其它文件保持引用关系。

---

## 总览：每条 commit 必须二选一

本仓库**所有提交**的 title 必须显式带上以下标记**之一**，缺失则 `commit-msg` hook 直接拒绝。**hook 不会自动补标记**。

| 分支 | 适用场景 | 标题前缀 | body 必填字段 | body 可选字段 |
|------|----------|----------|----------------|----------------|
| **AI 提交** | 代码主要由 AI 生成 / 修改 | `[AI Generated]` | `Generated-By:`、`Turns:` | — |
| **Human 提交** | 代码由人手写或人工修改（“人工 Coding”），AI 仅负责执行 git 命令也算这一支 | `[Human Coded]` | `Reason:` | — |

> 判定原则：**看代码改动是谁产出的，不看 git 命令是谁敲的**。
> AI 工具被叫去 `git commit` 但本次代码改动是用户手改的 → 走 **Human Coded** 流程，并主动询问/补全 `Reason`。
>
> 本规范里所有 TAG 的大小写在 hook 校验中不敏感（`[Human Coded]` / `[Human coded]` / `[human coded]` 均可），但**以本文字面表述为准**写成 Title Case。

---

## AI 提交（`[AI Generated]`）

### 格式

```
<ONES ID> [AI Generated] <描述>

Generated-By: <工具>
Turns: <人机轮次>            # 必填，正整数（hook 强校验）
```

### 字段约束

| 字段 | 必填 | 规则 | 示例 |
|------|------|------|------|
| `<ONES ID>` | ✅ | 纯数字，长度 ≥ 5（正则 `\d{5,}`），从分支名 `feature/<mis>-<onesId>/<desc>` 中提取 | `94480744` |
| `[AI Generated]` | ✅ | 固定字面量（大小写不敏感），推荐 Title Case | `[AI Generated]` |
| `<描述>` | ✅ | 一句话中/英文描述，建议 ≤ 72 字符 | `补充双列瀑布流框架并修复 renderItem 崩溃` |
| `Generated-By` | ✅ | 本次生成所使用的工具名 | `CatPaw` / `Claude Code` / `CatDesk` / `Catclaw` / `Codex` |
| `Turns` | ✅ | 本次 commit 对应的人机轮次（B 口径，详见下节），正整数（`\d` 且 ≥ 1，不允许 0）；hook 强校验 | `Turns: 7` |

### `Turns` 详解：「本次 commit 有效人机轮次」怎么算

- **轮次定义**：一个 `user 说话 → assistant 回应`即 1 轮（以 user 消息数为准）。
- **口径（B）**：计算「上一次 commit 之后 → 本次 commit 之前」这段区间内的轮数，反映「为了完成本次提交 AI 与用户来回了几次」。
- **只算「有效轮次」**：过滤掉无实质内容的承接/确认/控制语（见下方排除清单），只统计携带新需求、新约束、新信息或会触发动作的指令。
- **不跨多个 commit 累加**，也不含本次 commit 以后发生的交互。
- **必填，且为正整数**：`Turns:` 是 AI 提交的必填字段，hook 会校验其存在与格式（`^Turns: [1-9][0-9]*$`）。不要猜、不要填 0；确实算不出时宁可问用户，也不要留空（留空会被 hook 拒绝）。

#### 有效轮次判定：语义判定为主，词表兜底为辅

`Turns` 由 **AI agent 在提交前计算**（hook 不参与），因此应**用语义理解逐条判断**，而非死板匹配关键词——词表只能覆盖固定说法，遇到「那就这样吧」「可以了你弄吧」「嗯嗯辛苦了」「下一步呢」这类同义变体必然漏判。

**核心判据（唯一标准）——这条 user 消息是否「引入了新意图」？**

> 新意图 = 新需求 / 新约束 / 新信息 / 新反馈 / 一个会触发新动作的明确指令。

- **无效轮次（不计入）**：消息**仅**起承接、确认、催促、闲聊作用，**不携带任何新意图**。
  - 语义示例：`继续`、`OK`、`好的就这样`、`那就这样吧`、`可以了你弄`、`嗯嗯辛苦了`、`下一步呢`、`中断了？`、`怎么样了`、对选择题的纯选项回应（`A` / `2`）。
- **有效轮次（计入）**：消息携带新意图，**即使很短**。
  - 语义示例：`提交`、`回滚`、`改成蓝色`、`这个也同步到引导页`、`继续，但顺便把 X 改了`（含"继续"但引入新需求 → 有效）。

**判定原则**：
- **看语义、不看字面**：同一意图的不同说法都应识别（`继续`≈`接着弄`≈`往下`≈`go on`）。
- **混合消息按「是否含新意图」判**：哪怕开头是"好的"，只要后半句有新需求就算**有效**。
- **拿不准时倾向计入**（宁可多算 1，也不要漏掉真实需求）。

**降级兜底（仅当无法做语义判断时，例如脚本化批处理）**：可退化为关键词**完全匹配**清单：承接继续类（`继续`/`接着`/`往下`/`go on`/`continue`）、确认应答类（`OK`/`好`/`好的`/`嗯`/`可以`/`行`/`是`/`对`/`yes`/`y`/`👍`）、纯单字母数字选项（`A`/`B`/`1`/`2`…）、状态催促类（`中断了？`/`怎么了`/`?`/`？`）。**注意：词表是兜底，不是主路径**；能语义判断时一律以语义为准。

#### 各工具取值方式：基于会话 transcript 的内容锚点切割（推荐，已验证可行）

会话 transcript 通常**不带逐条时间戳**，无法直接用 `%ct` 时间切割，故采用**内容锚点**切割区间：

1. 定位 transcript 路径（CatPaw 在系统上下文/`agent-transcripts/transcript.txt`；Claude Code 在 `~/.claude/projects/<repo>/...`）。
2. 取**上一次提交动作**在 transcript 中的锚点行（如 `git commit -F` 命令行、或上次 commit message 首行文案），作为区间下界。
3. 取**本次提交动作**位置作为区间上界（即"现在"）。
4. 统计该区间内的 user 轮次（按 `^user:` 或各工具的 user 标记），提取每条 `<user_query>` 正文。
5. 对每条正文按上方**语义判定**（核心判据：是否引入新意图）逐条判断有效性，**有效条数即** `Turns`。

参考命令（CatPaw transcript，`$F`=transcript，`$LO`/`$HI`=锚点行号）——仅用于**列出**区间内每条 user 正文，**有效性仍由 AI 逐条语义判断**：

```bash
# 列出区间内每条 user 的真实内容，交给 AI 逐条做语义有效性判定
for n in $(awk -v lo="$LO" -v hi="$HI" 'NR>lo && NR<hi && /^user:/{print NR}' "$F"); do
  awk -v s="$n" 'NR>s && /<user_query>/{getline; print; exit}' "$F"
done
```

| 工具 | 取值方式 |
|------|----------|
| **CatPaw** | 用上方内容锚点法读 `agent-transcripts/transcript.txt` 列出 user 正文，再逐条语义判定有效性后计数 |
| **Claude Code** | 读 session JSONL，取上次 commit 锚点之后、本次之前的 `type:user` 条目，逐条语义判定后计数 |
| **CatDesk / Codex** | 同理，从各自会话记录文件取 |
| **人工手填** | 不推荐，宁可省略 |

> `Turns` 为 AI 提交必填，hook 会拦截缺失或非正整数的提交。拿不到准确轮次时宁可问用户确认，不要填估计值、也不要留空。

### 完整示例

```
94480744 [AI Generated] 补充医药搜索结果页双列瀑布流框架

Generated-By: CatPaw
Turns: 7
```

### 校验正则（与 hook 一致）

- 标题：`^[0-9]{5,} \[AI Generated\] .+`（大小写不敏感）
- body 必含：`^Generated-By: .+$`
- body 必含：`^Turns: [1-9][0-9]*$`（正整数，不允许 0）

---

## Human 提交（`[Human Coded]`）

> 用于「代码不是 AI 写的」提交，也就是本仓库需要重点追踪的 “人工 Coding” 场景。**必须说明本次为何不能/没有用 AI 生成**，便于沉淀 AI 失败/盲区，反向迭代规范与工具。

### 格式

```
<ONES ID> [Human Coded] <描述>

Reason: <不能/没有用 AI 提交的原因>
```

### 字段约束

| 字段 | 规则 | 示例 |
|------|------|------|
| `<ONES ID>` | 纯数字，长度 ≥ 5（正则 `\d{5,}`），从分支名 `feature/<mis>-<onesId>/<desc>` 中提取 | `94480744` |
| `[Human Coded]` | 固定字面量（大小写不敏感），推荐 Title Case | `[Human Coded]` |
| `<描述>` | 一句话中/英文描述，建议 ≤ 72 字符 | `修复支付下单极端机型崩溃` |
| `Reason` | **不能为空**，说明本次为何走人工，常见原因见下 | `AI 多次尝试无法定位原生 crash 根因，改人工 attach 调试` |

### `Reason` 推荐用语（任选其一并补充上下文）

- `AI 工具暂不可用 / 无网络`
- `涉及隐私/合规代码，不便交给云端 AI`
- `AI 多次尝试方案均不收敛，人工介入`
- `紧急线上回滚，需即时处理`
- `仅手工合并冲突 / cherry-pick`
- `AI 不熟悉的领域（特定原生模块/底层动画等）`

### 完整示例

```
94480744 [Human Coded] 修复支付下单极端机型崩溃

Reason: AI 多次尝试方案均不收敛，且涉及 iOS 原生层 crash，需 attach Xcode 人工调试
```

### 校验正则（与 hook 一致，大小写不敏感）

- 标题：`^[0-9]{5,} \[Human Coded\] .+`（hook 用 `grep -i` 匹配）
- body 必含：`^Reason: .+$`

---

## AI 工具的判定与执行流程

> **核心规则**：AI 是「代码作者」时走 AI 流程；AI 只是「代提交执行者」、代码是用户手写时走 Human 流程。

### 判定流程

1. 提交前先看 `git diff --staged`，问自己：
   - **本次 staged 的改动里，是否有 AI 在本会话产出/修改的代码？**
     - **是** → 走 [AI 提交流程](#ai-提交流程)。
     - **否（用户手改、cherry-pick、合并冲突等）** → 走 [Human 提交流程](#human-提交流程)。
2. 模糊场景（既有 AI 改动也有用户手改）按主要贡献判定，建议**优先标 `[AI Generated]`** 并在描述中说明。

### ONES ID 解析规则（AI/Human 流程共用）

1. **优先从当前分支名提取**：分支形如 `feature/<mis>-<onesId>/<desc>`，取 `<onesId>`。
   - 提取命令参考：

     ```bash
     git rev-parse --abbrev-ref HEAD | sed -nE 's|^[^/]+/[^/-]+-([0-9]{5,})/.*|\1|p'
     ```

   - 例：`feature/huangweiren-94480744/search_msc2mrn` → `94480744`
2. **解析失败必须问用户拿**，不得继续推进，禁止以下做法：
   - ❌ 用其它分支段、commit hash、当前日期等凑数
   - ❌ 写 `00000` / `99999` / `12345` 等占位 ID
   - ❌ 偷偷用上一条 commit 的 ID
3. 解析失败时的标准追问话术：

   > 当前分支 `<branch>` 不符合 `feature/<mis>-<onesId>/<desc>` 规范，无法提取 ONES ID。请提供本次提交对应的 ONES 工单 ID（≥5 位纯数字）。

4. 用户提供后，本会话内可缓存复用，无需每次重复询问；但 ID 必须仍满足 `\d{5,}` 才允许写入 commit。

### AI 提交流程

1. 按 [ONES ID 解析规则](#ones-id-解析规则aihuman-流程共用) 拿到 `<ONES ID>`。
2. 填写 `Generated-By`（如 `CatPaw`）。
3. **【每次提交必做】自动计算 `Turns`（B 口径 + 有效轮次）**：AI 在每次 commit 前**默认主动执行**，无需用户提醒。
   - 用 [基于会话 transcript 的内容锚点切割](#各工具取值方式基于会话-transcript-的内容锚点切割推荐已验证可行) 定位「上次提交锚点 → 本次提交」区间，列出区间内每条 user 正文。
   - 对每条正文按 [语义判定](#有效轮次判定语义判定为主词表兜底为辅)（核心判据：是否引入新意图）逐条判断，**有效条数**即 `Turns`，写入 body。
   - `Turns` 为**必填**（hook 强校验 `^Turns: [1-9][0-9]*$`）：确实无法定位 transcript / 无法可靠计算时，**向用户确认轮次**后再填，不要猜、不要填估计值、也不要留空（留空会被 hook 拒绝）。
   - 仓库首次提交（无上一条 commit 锚点）：至少计本次需求的 1 轮，按实际有效轮次填正整数。
4. 执行（推荐用临时文件传入，避免 shell 转义问题）：

   ```bash
   # 写临时文件 → git commit -F
   cat > /tmp/commit-msg.txt <<'EOF'
   <ONES ID> [AI Generated] <描述>

   Generated-By: <工具>
   Turns: <轮次>
   EOF
   git commit -F /tmp/commit-msg.txt
   rm /tmp/commit-msg.txt
   ```

   > 不推荐 `git commit -m $'...\n...'`：zsh 下 `$'\u4e2d\u6587'` 会报 `character not in range`，是此仓库实际踩过的坑。若必须用 `-m`，请使用多个 `-m` 拼接：`git commit -m '<title>' -m 'Generated-By: ...' -m 'Turns: ...'`。

### Human 提交流程

1. 按 [ONES ID 解析规则](#ones-id-解析规则aihuman-流程共用) 拿到 `<ONES ID>`。
2. **必须主动询问用户原因**（"本次为什么不让我直接生成代码 / 为何走人工提交？"），把答案放进 `Reason:`。用户已说明过的不必重复询问。
3. 执行（推荐用临时文件传入，避免 shell 转义问题）：

   ```bash
   cat > /tmp/commit-msg.txt <<'EOF'
   <ONES ID> [Human Coded] <描述>

   Reason: <原因>
   EOF
   git commit -F /tmp/commit-msg.txt
   rm /tmp/commit-msg.txt
   ```

   > 同样不推荐 `git commit -m $'...'`，原因见 AI 提交流程。

4. 严禁臆造 `Reason`，也禁止用 `Reason: -` / `Reason: N/A` 等敷衍内容。

---

## hook 校验逻辑（`.husky/commit-msg`）

每次 `git commit` 触发时，hook 执行：

1. 读取 commit message，跳过注释行后取首行作为 title。
2. 判定标题分支（TAG 大小写不敏感，`grep -i`）：
   - title 含 `[AI Generated]` → 走 **AI 校验**
   - title 含 `[Human Coded]` → 走 **Human 校验**
   - 两者都没有 → **直接拒绝**，提示必须二选一。
3. AI 校验：
   - title 必须匹配 `^[0-9]{5,} \[AI Generated\] .+`（大小写不敏感）
   - body 必含 `^Generated-By: .+$`
   - body 必含 `^Turns: [1-9][0-9]*$`（正整数，不允许 0）
4. Human 校验：
   - title 必须匹配 `^[0-9]{5,} \[Human Coded\] .+`（大小写不敏感）
   - body 必含 `^Reason: .+$`
5. 任一规则不通过 → 拒绝提交并打印对应分支的期望格式与示例。

> hook **不做交互式输入**、**不自动补标记**，所有信息由提交者（人或 AI）在 commit message 中自行写入，保证非交互场景（CI / amend / rebase）也一致。

---

## 设计动机

- **每条提交都被标注**：沉淀「哪些代码是 AI 写的、哪些是人写的」，便于质量回溯、归因与风险评估。
- **TAG 语义以「代码作者」为准**：`[AI Generated]` = AI 写的代码；`[Human Coded]` = 人写的代码（即「人工 Coding」场景）。不跟 git 命令是谁执行走。
- **去掉 `Model` 字段**：AI 自己难以稳定识别底层模型 ID，强制填写反而引入噪声；保留 `Generated-By` 工具名足以做粗粒度统计。
- **`Turns` 必填字段量化「交互成本」**：记录为完成本次提交的人机轮次，用来分析哪类任务 AI 一轮就能交付、哪类任务需要多轮拉扯。AI 提交时由 hook 强校验（正整数、不允许 0），确保数据完整；算不出时应向用户确认而非省略。
- **`Reason` 字段反向驱动 AI 进化**：把「AI 没接住的场景」显式记录下来，沉淀成 AI 工具与本规范的迭代输入。

---

## 引用关系

| 文件 | 作用 |
|------|------|
| **`.knowledge/constraints/ai-commit-spec.md`**（本文） | 唯一真源，规范本体 |
| `AGENTS.md` / `CLAUDE.md` | AI 入口文档，链接到本文 |
| `.knowledge/constraints/rules.md` 第 9 条 | 仓库强制规则索引，链接到本文 |
| `.husky/commit-msg` | 实际校验脚本，注释中链接到本文 |

修改规范时请遵守：**只改本文 → 其它位置保持「指向本文」即可**。
