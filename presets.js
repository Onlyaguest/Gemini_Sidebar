if (typeof globalThis.PRESET_GROUPS === "undefined") {
  globalThis.PRESET_GROUPS = [
  {
    id: "consulting-delivery",
    title: "会议记录处理",
    items: [
      {
        id: "del-step1-summary",
        label: "1. 📝 全量细节回顾",
        template:
          "请重新审视会议记录，不要遗漏任何细节，总结这次会议讨论的所有话题。这一步我们只做信息同步，确保没有遗漏。"
      },
      {
        id: "del-step2-profile-risk",
        label: "2. 🎭 画像与风险博弈",
        template:
          "基于上述内容，请进行深度博弈分析：\n1. **画像侧写**：Speaker 1 (我方) 和 Speaker 2 (对方) 分别是什么样的人？\n2. **局势判断**：站在 Speaker 1 的利益角度，这次交流是良性的吗？\n3. **风险嗅探**：有什么对方没明说但存在的隐患？对我方有什么潜在风险？"
      },
      {
        id: "del-step3-strategy",
        label: "3. 💰 商业化与定价策略",
        template:
          "请围绕商业化/产品化能力自由讨论这次会议内容：\n- 这次沟通体现出的核心价值与可复制能力是什么\n- 可以发展成哪些服务/产品形态或交付方式\n- 潜在付费点、试点方式与定价边界的思路\n- 需要验证的关键假设或可能风险\n表达无需严格分点，尽量给出可执行的方向。"
      },
      {
        id: "del-step4-synthesis",
        label: "4. 🔗 确认结案",
        template:
          "很好。基于之前的会议记录，加上我们刚刚几轮对话分析出来的所有内容（画像、风险、产品化策略等），是否可以共同构成一个完整的会议与讨论复盘结论？准备好整合了吗？"
      },
      {
        id: "del-step5-card-factory",
        label: "5. 🗃️ 生成交付卡片",
        template:
          "我们刚刚聊的东西，都可以根据项目、客户、人和方法论、洞察抽象成OB里面的卡片。\n请严格按以下要求输出 Obsidian 卡片：\n\n## 总规则（必须）\n\n1. 只输出 Markdown 代码块，不要任何解释文字。\n2. 每张卡片必须用单独的代码块包裹（```````markdown` ... ```）。\n3. 代码块第一行必须写：`<!-- filename: <文件名>.md -->`\n4. 所有卡片都必须包含 YAML frontmatter。\n5. `Gemini` 字段必须存在且不为空，请填写当前对话 URL。\n6. 在每张卡片中记录生成时间（ISO 8601），可写入 frontmatter 或正文。\n7. 禁止输出任何 `[cite_*]` 这类引用标记。\n8. 仅使用 Obsidian 双链 `[[...]]`，不要用路径型链接。\n9. 若需要新建关联对象，请用标准命名前缀（Who/Project/Solution/Card/Meeting）。\n\n---\n\n## 1) Meeting 卡（会议总结）\n\n**文件名规则**：`YYYY-MM-DD Meeting-<Host>-<Topic>.md`\n\n**必填 frontmatter**：\n- `type: MeetingSum`\n- `created: YYYY-MM-DD`\n- `Gemini: <url 或 待补充>`\n- `tags` 包含 `MeetingSum`\n- `participants` 至少 1 个 `[[Who-...]]`\n- `projects` 可选（`[[Project-...]]`）\n\n**结构模板**（示例格式）：\n\n```markdown\n<!-- filename: 2026-01-27 Meeting-Jessica-AI项目与二次元周边合作.md -->\n---\ntype: MeetingSum\ntags:\n  - MeetingSum\ncreated: 2026-01-27\nGemini: 待补充\nparticipants:\n  - \"[[Who-Jessica]]\"\nprojects:\n  - \"[[Project-趣圈内部AIGC工作流]]\"\n---\n\n### 🧩 Graph (Edges/Payload)\n\n**Edges**\n1. [[Project-趣圈内部AIGC工作流]] → 解决方案 → [[Solution-AIGC安全合规部署包]]\n\n**Payload**\n1. [[Card-Consulting-Productization]]：简短要点。\n\n---\n\n### 📝 会议记录：<一句话主题>\n\n> [!abstract] 核心共识\n> - 要点 1\n> - 要点 2\n\n### ✅ 待办事项 (Action Items)\n- [[Who-...]] 行动 1\n- [[Who-...]] 行动 2\n```\n\n---\n\n## 2) Who 卡（人物画像）\n\n**文件名规则**：`Who-<Name>.md`\n\n**必填 frontmatter**：\n- `type: Person`\n- `aliases` 至少 1 个（建议同时写有空格版本与无空格版本）\n- `created: YYYY-MM-DD`\n- `updated: YYYY-MM-DD`\n- `Gemini: <url 或 待补充>`\n- `org` / `role` 可以为空，但字段必须存在\n\n**结构模板**（示例格式）：\n\n```markdown\n<!-- filename: Who-Jessica.md -->\n---\ntype: Person\naliases:\n  - Jessica\n  - JessicaWang\ntags:\n  - Person\ncreated: 2026-01-27\nupdated: 2026-01-27\nGemini: 待补充\norg: 待补充\nrole: 待补充\n---\n\n##### 👤 Jessica (Title)\n\n> [!abstract] **一句话人设 (Persona)**\n> 简述一句话。\n\n---\n\n##### 🛡️ 合作者视角 (Partner's View)\n- **要点**：...\n\n---\n##### 🧾 相关会议与项目（自动）\n\n> [!info] **参与会议 (MeetingSum)**\n```dataview\nLIST\nFROM \"4_Source/MeetingSum\"\nWHERE contains(participants, this.file.link) OR contains(file.outlinks, this.file.link)\nSORT file.name desc\n```\n\n> [!tip] **相关项目 (Projects)**\n```dataview\nLIST\nFROM \"1_Projects\"\nWHERE contains(file.outlinks, this.file.link)\nSORT file.name asc\n```\n```\n\n---\n\n## 3) Project 卡（项目需求）\n\n**文件名规则**：`Project-<Name>.md`\n\n**建议 frontmatter**：\n- `tags` 包含 `Project`\n- `created: YYYY-MM-DD`\n- `status: active`\n- `Gemini: <url 或 待补充>`\n\n**结构模板**：\n\n```markdown\n<!-- filename: Project-趣圈内部AIGC工作流.md -->\n---\ntags:\n  - Project\ncreated: 2026-01-27\nstatus: active\nGemini: 待补充\n---\n\n# Project-趣圈内部AIGC工作流\n\n## 项目背景\n- 简述需求与场景。\n\n## 目标与范围\n- 目标 1\n- 目标 2\n\n## 当前状态\n- [ ] 事项 1\n\n## 关联\n- 相关人：[[Who-...]]\n- 相关会议：[[2026-01-27 Meeting-...]]\n- 方案：[[Solution-...]]\n```\n\n---\n\n## 4) Solution 卡（标准化产品）\n\n**文件名规则**：`Solution-<Name>.md`\n\n**建议 frontmatter**：\n- `tags` 包含 `Solution`\n- `created: YYYY-MM-DD`\n- `source: [[<Meeting>]]`（可选）\n- `Gemini: <url 或 待补充>`\n\n**结构模板**：\n\n```markdown\n<!-- filename: Solution-AIGC安全合规部署包.md -->\n---\ntags:\n  - Solution\n  - Product\ncreated: 2026-01-27\nsource: \"[[2026-01-27 Meeting-...]]\"\nGemini: 待补充\n---\n\n# Solution-AIGC安全合规部署包\n\n## 核心定位 (Product Definition)\n一句话定位。\n\n## 交付内容 (Deliverables)\n1. ...\n2. ...\n\n## 价值与定价 (Value & Pricing)\n- 价值：...\n- 定价：...\n\n## 关联\n- 关联项目：[[Project-...]]\n```\n\n---\n\n## 5) Insight 卡（核心认知 / Payload）\n\n**文件名规则**：`Card-<Name>.md`\n\n**必填 frontmatter**：\n- `tags` 至少 1 个（建议包含 `Card`）\n- `created: YYYY-MM-DD`\n- `Gemini: <url 或 待补充>`\n\n**硬性要求**：正文必须至少包含 1 个 `[[...]]` 双链。\n\n**结构模板**：\n\n```markdown\n<!-- filename: Card-Consulting-Productization.md -->\n---\ntags:\n  - Card\n  - Insight\ncreated: 2026-01-27\nGemini: 待补充\nsource: \"[[2026-01-27 Meeting-...]]\"\n---\n\n# 咨询产品化 (Consulting Productization)\n\n## 核心观点\n- 关键结论 1\n- 关键结论 2\n\n## 应用\n- 如何用在 [[Project-...]]\n```\n"
      },
      {
        id: "del-step6-obsidian",
        label: "6. 📥 推送到 Obsidian",
        action: "obsidian-push"
      }
    ]
  },
  {
    id: "deep-questioning",
    title: "持续追问",
    items: [
      {
        id: "first-principles",
        label: "第一性原理拆解",
        template:
          "请用第一性原理拆解以下问题：\n1) 列出当前所有假设\n2) 剥离假设后剩余的基本事实/硬约束\n3) 关键变量与不确定性（如何验证）\n4) 基于事实重建可行解路径\n\n问题：{{problem}}\n背景：{{context}}"
      },
      {
        id: "second-order-thinking",
        label: "二阶思维追问",
        template:
          "请用二阶思维分析以下问题，输出：\n- 直接后果（1阶）\n- 后果的后果（2阶）\n- 可能的三阶效应（3阶，若有）\n- 为什么大资本/更强玩家可能不进场？\n- 合规/品牌/长期成本上的潜在代价\n\n问题：{{problem}}\n背景：{{context}}"
      },
      {
        id: "inversion-premortem",
        label: "逆向思考/事前尸检",
        template:
          "请用逆向思考（Pre-mortem）分析：\n- 假设项目失败/亏损/关系破裂，最可能的3-5个原因\n- 早期预警信号是什么\n- 针对每个原因的预防与对冲措施\n\n问题：{{problem}}\n背景：{{context}}"
      },
      {
        id: "five-whys",
        label: "5 Whys 追问",
        template: "请用 5 Whys 方法逐层追问直到找到根因。\n\n问题：{{problem}}\n背景：{{context}}"
      },
      {
        id: "evidence-chain",
        label: "证据链验证",
        template:
          "请对以下结论做证据链验证：\n1) 区分事实(Fact)/观点(Opinion)/传言(Hearsay)\n2) 每一条需要哪些证据支持\n3) 证据来源与可信度等级\n4) 证据不足时的替代验证方案\n\n结论：{{conclusion}}\n背景：{{context}}"
      },
      {
        id: "counterfactuals",
        label: "反事实推演",
        template:
          "请提出 3 个反事实假设，分析条件改变时结果会如何不同，并说明如何验证：\n- 反事实假设\n- 影响路径\n- 需要的数据/证据\n- 若成立/不成立对决策的影响\n\n结论：{{conclusion}}\n背景：{{context}}"
      }
    ]
  },
  {
    id: "writing-polish",
    title: "写作与改写",
    items: [
      {
        id: "rewrite-wechat-viral",
        label: "改写成公众号爆款",
        template:
          "请把以下内容改写成“微信公众号爆款”风格，要求：\n- 保留事实，不虚构数据或案例\n- 开头强钩子（痛点/反差/结果预告）\n- 正文分段清晰，适当小标题\n- 结尾给出行动号召或问题引导\n- 语气贴合我的账号人设\n\n我的账号人设卡片：\n{{persona}}\n\n原文：\n{{text}}"
      },
      {
        id: "rewrite-xhs-viral",
        label: "改写成小红书爆款",
        template:
          "请把以下内容改写成“小红书爆款笔记”风格，要求：\n- 保留事实，不虚构数据或案例\n- 输出结构：标题（1条）/开头3行/正文/结尾总结+互动提问\n- 正文用短句+清单/编号，适度表情符号\n- 给出 5-8 个话题标签\n- 语气贴合我的账号人设\n\n我的账号人设卡片：\n{{persona}}\n\n原文：\n{{text}}"
      },
      {
        id: "rewrite-clear",
        label: "改写成清晰要点",
        template: "请将以下内容改写为简洁清晰的要点列表：\n\n{{text}}"
      },
      {
        id: "tone-professional",
        label: "专业语气",
        template: "请将以下内容改写为专业、克制、可信的语气：\n\n{{text}}"
      },
      {
        id: "translate-cn",
        label: "翻译成中文",
        template: "请把以下内容翻译成中文，保持专业术语准确：\n\n{{text}}"
      }
    ]
  }
  ];
}

var PRESET_GROUPS = globalThis.PRESET_GROUPS;

if (typeof module !== "undefined" && module.exports) {
  module.exports = PRESET_GROUPS;
}
