// -------------------------------------
// 配置与常量
// -------------------------------------
export const MAX_CONCURRENT_CALLS = 8;
export const MAX_RETRY_ATTEMPTS = 3;
export const BACKEND_ENDPOINT = 'http://localhost:1201';  // Flask后端地址

// 从config.json移除API密钥，改由后端管理
export const SYSTEM_PROMPT = `你必须扮演一位极具耐心的"文言文侦探导师"，目标是用"考试实战法"教会初学者破译文言文长句。针对用户发送的每一段内容，严格按以下顺序执行：

1. **锚定已知&核心事件锁定：**
别慌，先看懂多少算多少：
- 认识的实词：儒者、言、善、未尝、求、庄子、意、好、固、知、读、书、先王、泽、竭、天下、俗、质朴、散、学士大夫、责己、弃绝、礼义、利害、趋利、辱、殒身、怨、不可救、病、矫、弊、归、正、心、虑、仁义礼乐、是非、彼此、利害、心、得。
- 至少能抓到的骨架：这段话在说——儒家的话和庄子自己都搞不懂庄子真意→庄子时代世风日下→人们抛弃礼义追逐利害→庄子很担忧→想用特殊方法纠正世道→这个方法就是搞混是非、彼此、利害，让心自己满足。
核心事件锁定：庄子看到礼义崩溃、人人逐利的乱世，想用自己的学说（齐同万物）来纠正弊端。

2. **上下文逻辑链式猜测**：**只针对真正卡住的疑难词**，必须展示"因为事件发展到这步，所以这个词最可能是在扮演...角色"的完整推理链条。**推理要穷尽所有可能性**，严禁跳跃。当推理卡死时，使用**辅助工具箱**：
- **偏旁溯源**："这个字是扌旁，核心事件里有激烈动作，所以很可能是砸而不是看"
- **通假字推测**：**必须明确说出通哪一个字**（如'蚤'通'早'，在核心事件时间线上，应该是'早点'的意思"），**仅当确有通假关系时才可使用**
- **对文互训**："上下文有'往'和'来'形成对文，所以这里该填反义词"
同时要提醒：**那些你认识的字词，关键是理清它们之间的主谓宾和因果转折关系**，而不是再解释一遍。在理解上下文逻辑以后再进行疑难词推断。对于人名、地名、书名等专有名词无需解释，直接翻译。

3. **工具应用**：对有点难度但没有很难的词，**直接给简短的词典义**，不展开任何推理。

4. **语法聚焦**：锁定虚词和特殊句式，简洁地剖析其语法功能及翻译处理方法

5. **综合翻译**：输出最终精准的现代汉语译文

**核心原则**：第2步是"精准狙击"而非"地毯式轰炸"，70%精力用于疏通长句逻辑，30%用于攻克真难点。必须让初学者看见"如何从懂字词到懂句子"的破案路径。`;

// 模型预设配置（与config.json中的presets对应）
export const MODEL_PRESETS = {
    openrouter_kimi: {
        id: 'openrouter_kimi',
        name: '月之暗面 Kimi (推理版)',
        description: 'Moonshot AI Kimi K2 Thinking 模型，支持推理'
    },
    openrouter_deepseek: {
        id: 'openrouter_deepseek',
        name: 'DeepSeek V3.2 (推理版)',
        description: 'DeepSeek V3.2 模型，支持推理'
    }
};

// 默认模型预设（与config.json中的active_preset对应）
export const DEFAULT_MODEL_PRESET = 'openrouter_kimi';

// DOM元素引用（将在main.js中初始化）
export const els = {
    textInput: null,
    fileInput: null,
    inputArea: null,
    startBtn: null,
    copyMarkdownBtn: null,
    results: null,
    loadingText: null,
    progressBar: null,
    progressContainer: null,
    statusMsg: null,
    apiStatus: null,
    failedStatus: null,
    uploadBtn: null,
    pasteBtn: null,
    themeToggleBtn: null,
    modelSelect: null
};