// -------------------------------------
// 1. 配置与全局状态
// -------------------------------------
const MAX_CONCURRENT_CALLS = 8;
const MAX_RETRY_ATTEMPTS = 3;
const BACKEND_ENDPOINT = 'http://localhost:1201';  // Flask后端地址

// 从config.json移除API密钥，改由后端管理
const SYSTEM_PROMPT = "你必须扮演一位极具耐心的\"文言文侦探导师\"，目标是用\"考试实战法\"教会初学者破译文言文长句。针对用户发送的每一段内容，严格按以下顺序执行：\n\n1. **锚定已知&核心事件锁定：**\n别慌，先看懂多少算多少：\n- 认识的实词：儒者、言、善、未尝、求、庄子、意、好、固、知、读、书、先王、泽、竭、天下、俗、质朴、散、学士大夫、责己、弃绝、礼义、利害、趋利、辱、殒身、怨、不可救、病、矫、弊、归、正、心、虑、仁义礼乐、是非、彼此、利害、心、得。\n- 至少能抓到的骨架：这段话在说——儒家的话和庄子自己都搞不懂庄子真意→庄子时代世风日下→人们抛弃礼义追逐利害→庄子很担忧→想用特殊方法纠正世道→这个方法就是搞混是非、彼此、利害，让心自己满足。\n核心事件锁定：庄子看到礼义崩溃、人人逐利的乱世，想用自己的学说（齐同万物）来纠正弊端。\n\n2. **上下文逻辑链式猜测**：**只针对真正卡住的疑难词**，必须展示\"因为事件发展到这步，所以这个词最可能是在扮演...角色\"的完整推理链条。**推理要穷尽所有可能性**，严禁跳跃。当推理卡死时，使用**辅助工具箱**：\n- **偏旁溯源**：\"这个字是扌旁，核心事件里有激烈动作，所以很可能是砸而不是看\"\n- **通假字推测**：**必须明确说出通哪一个字**（如'蚤'通'早'，在核心事件时间线上，应该是'早点'的意思\"），**仅当确有通假关系时才可使用**\n- **对文互训**：\"上下文有'往'和'来'形成对文，所以这里该填反义词\"\n同时要提醒：**那些你认识的字词，关键是理清它们之间的主谓宾和因果转折关系**，而不是再解释一遍。在理解上下文逻辑以后再进行疑难词推断。对于人名、地名、书名等专有名词无需解释，直接翻译。\n\n3. **工具应用**：对有点难度但没有很难的词，**直接给简短的词典义**，不展开任何推理。\n\n4. **语法聚焦**：锁定虚词和特殊句式，简洁地剖析其语法功能及翻译处理方法\n\n5. **综合翻译**：输出最终精准的现代汉语译文\n\n**核心原则**：第2步是\"精准狙击\"而非\"地毯式轰炸\"，70%精力用于疏通长句逻辑，30%用于攻克真难点。必须让初学者看见\"如何从懂字词到懂句子\"的破案路径。";

const els = {
    textInput: document.getElementById('text-input'),
    fileInput: document.getElementById('file-input'),
    inputArea: document.getElementById('input-area'),
    startBtn: document.getElementById('start-button'),
    copyMarkdownBtn: document.getElementById('copy-markdown-btn'),
    results: document.getElementById('results-content'),
    loadingText: document.getElementById('loading-text'),
    progressBar: document.getElementById('progress-bar'),
    progressContainer: document.getElementById('progress-container'),
    statusMsg: document.getElementById('status-message'),
    apiStatus: document.getElementById('api-status'),
    failedStatus: document.getElementById('failed-status'),
    uploadBtn: document.getElementById('upload-btn'),
    pasteBtn: document.getElementById('paste-btn')
};

// 运行状态
let segmentQueue = [];
let totalSegments = 0;
let segmentsCompleted = 0;
let activeWorkers = 0;
let resultsMap = new Map();
let apiConnectedState = false; 
let retryMap = new Map();
let failedSegments = [];

// 预览模式状态
let isPreviewMode = true;
let segmentsToRemove = new Set();
let previewSegments = [];
let originalTextForPreview = '';

// 保存实际分析的段落映射关系
let analysisSegments = [];  // 存储 {index: 原始索引, segment: 文本}

// 当前显示的markdown内容
let currentMarkdownContent = '';

// -------------------------------------
// 2. 初始化与事件绑定
// -------------------------------------
function init() {
    updateApiStatusUI('ready');
    bindEventListeners();
    isPreviewMode = true;
    segmentsToRemove.clear();
    previewSegments = [];
    analysisSegments = [];
    
}

function bindEventListeners() {
    els.startBtn.addEventListener('click', startAnalysis);
    els.copyMarkdownBtn.addEventListener('click', copyMarkdown);
    els.inputArea.addEventListener('drop', handleDrop);
    els.inputArea.addEventListener('dragover', handleDragOver);
    els.inputArea.addEventListener('dragleave', handleDragLeave);
    // els.inputArea.addEventListener('click', handleInputAreaClick); // 移除整个区域点击上传功能
    els.fileInput.addEventListener('change', handleFileInputChange);
    els.textInput.addEventListener('input', handleTextInput);
    els.uploadBtn.addEventListener('click', handleUploadClick);
    els.pasteBtn.addEventListener('click', handlePasteClick);
}


// -------------------------------------
// 4. API状态管理
// -------------------------------------
function updateApiStatusUI(state, details) {
    switch(state) {
        case 'ready':
            apiConnectedState = false;
            els.apiStatus.innerHTML = '🟢 就绪';
            els.apiStatus.style.color = '#188038';
            break;
        case 'connecting':
            els.apiStatus.innerHTML = '🟡 正在连接后端...';
            els.apiStatus.style.color = '#f9ab00';
            break;
        case 'analyzing':
            apiConnectedState = true;
            els.apiStatus.innerHTML = '🟡 正在分析段落...';
            els.apiStatus.style.color = '#f9ab00';
            break;
        case 'finished':
            apiConnectedState = true;
            els.apiStatus.innerHTML = '✅ 分析完成';
            els.apiStatus.style.color = '#188038';
            break;
        case 'error':
            if (details) {
                // 分析错误，连接可能正常
                els.apiStatus.innerHTML = `❌ ${details}`;
            } else {
                // 连接错误
                apiConnectedState = false;
                els.apiStatus.innerHTML = '❌ 连接失败: 无法连接到后端服务';
            }
            els.apiStatus.style.color = '#d93025';
            break;
    }
}

// -------------------------------------
// 5. 文本处理与分析
// -------------------------------------
function handleTextInput() {
    if (previewSegments.length > 0 || resultsMap.size > 0) {
        resetUIForNewInput();
    }
}

function resetUIForNewInput() {
    els.results.innerHTML = '';
    els.copyMarkdownBtn.disabled = true;
    updateApiStatusUI('ready');
    els.failedStatus.textContent = '';
    resultsMap.clear();
    retryMap.clear();
    failedSegments = [];
    totalSegments = 0;
    segmentsCompleted = 0;
    activeWorkers = 0;
    currentMarkdownContent = '';
    isPreviewMode = true;
    segmentsToRemove.clear();
    previewSegments = [];
    originalTextForPreview = '';
    analysisSegments = [];
    els.startBtn.textContent = '开始分析';
    els.progressContainer.style.display = 'none';
    els.loadingText.style.display = 'none';
    document.body.classList.remove('preview-mode');
}

function splitText(fullContent) {
    const lines = fullContent.replace(/\r\n/g, '\n').split('\n');
    const segments = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        if (is_content(line)) {
            segments.push({
                index: segments.length,
                segment: line,
                retryCount: 0
            });
        }
    }
    
    return segments;
}

function is_content(line) {
    if (line.length < 2) return false;
    
    const punct_set = '，。？！；："' + "\'" + '（）【】、';
    const sentence_endings = '。？！';
    const quotes = '“‘’"';
    
    let has_ending = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (sentence_endings.includes(char)) {
            let left_quotes_count = 0;
            for (let j = 0; j < i; j++) {
                if (quotes.includes(line[j])) {
                    left_quotes_count++;
                }
            }
            if (left_quotes_count % 2 === 0) {
                has_ending = true;
                break;
            }
        }
    }
    
    let punct_count = 0;
    for (let char of line) {
        if (punct_set.includes(char)) {
            punct_count++;
        }
    }
    const punct_density = punct_count / line.length;
    
    return has_ending || punct_density > 0.05 || (line.length > 5 && punct_count > 0);
}

// -------------------------------------
// 6. 后端API调用
// -------------------------------------
async function processItem(item) {
    activeWorkers++;
    let shouldIncrementProgress = false;

    if (!apiConnectedState && activeWorkers === 1 && segmentsCompleted === 0) {
        updateApiStatusUI('connecting');
    }

    try {
        // 发出请求后即认为连接已建立，更新状态为分析中
        if (!apiConnectedState && activeWorkers === 1) {
            updateApiStatusUI('analyzing');
        }

        const response = await fetch(`${BACKEND_ENDPOINT}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                segment: item.segment
            })
        });

        if (!response.ok) {
            throw new Error(`后端请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '未知错误');
        }

        resultsMap.set(item.index, { 
            original: item.segment, 
            response: data.result,
            status: 'success'
        });
        
        failedSegments = failedSegments.filter(f => f.index !== item.index);
        shouldIncrementProgress = true;
    } catch (err) {
        console.error(`段落 ${item.index + 1} 分析失败:`, err);

        // 检测网络错误
        const isNetworkError = err.message.includes('Failed to fetch') ||
                              err.message.includes('NetworkError') ||
                              err.message.includes('TypeError') ||
                              err.message.includes('网络错误') ||
                              err.message.includes('连接失败');

        if (isNetworkError) {
            apiConnectedState = false;
        }

        const retryCount = retryMap.get(item.index) || 0;
        
        if (retryCount < MAX_RETRY_ATTEMPTS) {
            retryMap.set(item.index, retryCount + 1);
            
            const retryItem = {
                index: item.index,
                segment: item.segment,
                retryCount: retryCount + 1
            };
            
            segmentQueue.unshift(retryItem);
            
            resultsMap.set(item.index, {
                original: item.segment, 
                response: '正在重试分析... (第' + (retryCount + 1) + '次重试)',
                status: 'retrying'
            });
            
            const existingFailed = failedSegments.find(f => f.index === item.index);
            if (existingFailed) {
                existingFailed.error = '正在重试...';
                existingFailed.isRetrying = true;
            } else {
                failedSegments.push({ index: item.index, error: '正在重试...', isRetrying: true });
            }
            
            shouldIncrementProgress = false;
            renderResults();
            updateFailedStatus();
        } else {
            if (!apiConnectedState) updateApiStatusUI('error');

            const errorMsg = err.message || '未知错误';
            resultsMap.set(item.index, { 
                original: item.segment, 
                response: '分析失败: ' + errorMsg + ' (已重试 ' + MAX_RETRY_ATTEMPTS + ' 次)',
                status: 'error'
            });
            
            const existingFailed = failedSegments.find(f => f.index === item.index);
            if (existingFailed) {
                existingFailed.error = errorMsg;
                existingFailed.isRetrying = false;
            } else {
                failedSegments.push({ index: item.index, error: errorMsg, isRetrying: false });
            }
            retryMap.delete(item.index);
            
            shouldIncrementProgress = true;
        }
    } finally {
        if (shouldIncrementProgress) {
            segmentsCompleted++;
            updateProgress();
        }
        activeWorkers--;
        runQueue();
    }
}

function runQueue() {
    if (segmentsCompleted === totalSegments && segmentQueue.length === 0) {
        finishAnalysis();
        return;
    }
    
    while (activeWorkers < MAX_CONCURRENT_CALLS && segmentQueue.length > 0) {
        processItem(segmentQueue.shift());
    }
}

// -------------------------------------
// 7. 进度管理与UI更新
// -------------------------------------
function updateProgress() {
    const pct = (segmentsCompleted / totalSegments) * 100;
    els.progressBar.style.width = pct + '%';
    els.loadingText.textContent = '已完成: ' + segmentsCompleted + '/' + totalSegments;
    els.loadingText.style.display = 'block';
}

function updateFailedStatus() {
    if (failedSegments.length === 0) {
        els.failedStatus.textContent = '';
        els.failedStatus.style.display = 'none';
    } else {
        els.failedStatus.style.display = 'block';
        const finalFailures = failedSegments.filter(f => !f.isRetrying);
        if (finalFailures.length === 0) {
            els.failedStatus.textContent = '';
            els.failedStatus.style.display = 'none';
            return;
        }
        
        let failedText = `❌ 失败段落: ${finalFailures.map(f => `第${f.index + 1}段`).join(', ')}`;
        if (finalFailures.length > 0 && finalFailures[0].error) {
            failedText += ` (错误: ${finalFailures[0].error})`;
        }
        els.failedStatus.textContent = failedText;
    }
}

function finishAnalysis() {
    els.progressContainer.style.display = 'none';

    const successfulCount = totalSegments - failedSegments.filter(f => !f.isRetrying).length;
    const finalFailures = failedSegments.filter(f => !f.isRetrying);

    // 更新API状态显示
    if (finalFailures.length === 0) {
        updateApiStatusUI('finished');
    } else {
        const failedIndices = finalFailures.map(f => f.index + 1).sort((a, b) => a - b).join(',');
        const errorDetails = `分析完成 (成功${successfulCount}/${totalSegments}段，第${failedIndices}段失败)`;
        updateApiStatusUI('error', errorDetails);
    }

    let completionMessage = '';

    if (finalFailures.length === 0) {
        completionMessage = `✅ 成功分析 ${totalSegments}/${totalSegments} 段`;
    } else {
        const failedIndices = finalFailures.map(f => f.index + 1).sort((a, b) => a - b).join(',');
        completionMessage = `✅ 成功分析 ${successfulCount}/${totalSegments} 段，其中第${failedIndices}段失败`;

        completionMessage += ':\n';
        const sortedFailures = [...finalFailures].sort((a, b) => a.index - b.index);
        sortedFailures.forEach(f => {
            completionMessage += `第${f.index + 1}段：${f.error || '未知错误'}\n`;
        });
    }

    els.loadingText.textContent = completionMessage;
    els.loadingText.style.display = 'block';
    els.startBtn.disabled = false;
    els.copyMarkdownBtn.disabled = false;

    renderResults();
    generateCurrentMarkdownContent();
}

// -------------------------------------
// 8. 重新生成功能
// -------------------------------------
async function regenerateSegment(index) {
    const item = resultsMap.get(index);
    if (!item) return;
    
    const regenerateBtn = document.querySelector('.regenerate-btn[data-index="' + index + '"]');
    if (regenerateBtn) {
        regenerateBtn.disabled = true;
        regenerateBtn.textContent = '重新生成中...';
    }
    
    resultsMap.set(index, {
        original: item.original,
        response: '正在重新生成...',
        status: 'retrying'
    });
    renderResults();
    
    try {
        const response = await fetch(`${BACKEND_ENDPOINT}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                segment: item.original
            })
        });

        if (!response.ok) {
            throw new Error(response.statusText);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '重新生成失败');
        }
        
        resultsMap.set(index, { 
            original: item.original, 
            response: data.result,
            status: 'success'
        });
        
        failedSegments = failedSegments.filter(f => f.index !== index);
        updateFailedStatus();
        
    } catch (err) {
        console.error('段落 ' + (index + 1) + ' 重新生成失败:', err);
        resultsMap.set(index, { 
            original: item.original, 
            response: '重新生成失败: ' + err.message,
            status: 'error'
        });
        
        failedSegments = failedSegments.filter(f => f.index !== index);
        failedSegments.push({ index: index, error: err.message, isRetrying: false });
        updateFailedStatus();
    }
    
    renderResults();
    generateCurrentMarkdownContent();
}

// -------------------------------------
// 9. 结果渲染与格式化
// -------------------------------------
function bindRegenerateButtons() {
    document.querySelectorAll('.regenerate-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            regenerateSegment(index);
        });
    });
}

function formatResponse(response) {
    response = response.replace(/\\n/g, '\n');
    
    let html = response
        .replace(/^### (.*)$/gm, '<h4>$1</h4>') 
        .replace(/^## (.*)$/gm, '<h3>$1</h3>')   
        .replace(/^# (.*)$/gm, '<h2>$1</h2>')    
        .replace(/^-+$/gm, '<hr>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

    let lines = html.split('\n');
    let finalHtml = '';
    
    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        
        if (line.startsWith('<h2') || line.startsWith('<h3') || line.startsWith('<h4') || line === '<hr>') {
            finalHtml += line;
        } else {
            if (!line.startsWith('<p>') && !line.endsWith('</p>')) {
                finalHtml += '<p>' + line + '</p>';
            } else {
                finalHtml += line;
            }
        }
    });
    
    return finalHtml;
}

function renderResults() {
    els.results.innerHTML = '';

    for (let displayIndex = 0; displayIndex < analysisSegments.length; displayIndex++) {
        const segmentInfo = analysisSegments[displayIndex];
        const originalIndex = segmentInfo.index;
        const r = resultsMap.get(originalIndex);

        if (!r) continue;

        const segmentNumber = displayIndex + 1;

        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'segment-container';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'segment-header';

        // 创建可点击的标题栏
        const titleBar = document.createElement('div');
        titleBar.className = 'segment-title-bar';
        titleBar.setAttribute('role', 'button');
        titleBar.setAttribute('tabindex', '0');
        titleBar.setAttribute('aria-expanded', 'false');

        // 标题文本容器（支持多行截断）
        const titleTextContainer = document.createElement('div');
        titleTextContainer.className = 'segment-title-text';
        titleTextContainer.textContent = `第${segmentNumber}段：${r.original}`;
        titleBar.appendChild(titleTextContainer);

        // 展开/收起图标
        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon';
        expandIcon.textContent = '▶';
        titleBar.appendChild(expandIcon);

        headerDiv.appendChild(titleBar);

        const statusSpan = document.createElement('span');
        statusSpan.className = 'segment-status';
        if (r.status === 'success') {
            statusSpan.classList.add('status-success');
            statusSpan.textContent = '成功';
        } else if (r.status === 'error') {
            statusSpan.classList.add('status-error');
            statusSpan.textContent = '失败';
        } else if (r.status === 'retrying') {
            statusSpan.classList.add('status-retrying');
            statusSpan.textContent = '重试中';
        }
        headerDiv.appendChild(statusSpan);

        const regenerateBtn = document.createElement('button');
        regenerateBtn.className = 'regenerate-btn';
        regenerateBtn.setAttribute('data-index', originalIndex);
        regenerateBtn.textContent = '重新生成';
        headerDiv.appendChild(regenerateBtn);

        segmentDiv.appendChild(headerDiv);

        // 内容区域（默认隐藏）
        const contentDiv = document.createElement('div');
        contentDiv.className = 'segment-content collapsed';
        contentDiv.innerHTML = formatResponse(r.response);
        segmentDiv.appendChild(contentDiv);

        // 点击事件：展开/收起内容
        titleBar.addEventListener('click', function() {
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            const content = this.closest('.segment-container').querySelector('.segment-content');
            const icon = this.querySelector('.expand-icon');

            if (isExpanded) {
                // 收起
                this.setAttribute('aria-expanded', 'false');
                content.classList.add('collapsed');
                content.classList.remove('expanded');
                icon.textContent = '▶';
            } else {
                // 展开
                this.setAttribute('aria-expanded', 'true');
                content.classList.remove('collapsed');
                content.classList.add('expanded');
                icon.textContent = '▼';
            }
        });

        // 支持键盘访问
        titleBar.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });

        els.results.appendChild(segmentDiv);

        if (displayIndex < analysisSegments.length - 1) {
            const hr = document.createElement('hr');
            els.results.appendChild(hr);
        }
    }

    bindRegenerateButtons();
}

function generateCurrentMarkdownContent() {
    currentMarkdownContent = '';
    
    for (let displayIndex = 0; displayIndex < analysisSegments.length; displayIndex++) {
        const segmentInfo = analysisSegments[displayIndex];
        const originalIndex = segmentInfo.index;
        const result = resultsMap.get(originalIndex);
        
        if (!result) continue;
        
        currentMarkdownContent += `## 第${displayIndex + 1}段：${result.original}\n\n`;
        currentMarkdownContent += result.response + '\n\n';
        
        if (displayIndex < analysisSegments.length - 1) {
            currentMarkdownContent += '---\n\n';
        }
    }
}

// -------------------------------------
// 10. 复制功能
// -------------------------------------
function copyMarkdown() {
    if (resultsMap.size === 0) {
        alert('没有可复制的内容');
        return;
    }
    
    if (!currentMarkdownContent) {
        generateCurrentMarkdownContent();
    }
    
    navigator.clipboard.writeText(currentMarkdownContent)
        .then(() => {
            const originalText = els.copyMarkdownBtn.textContent;
            els.copyMarkdownBtn.textContent = '✅ 已复制';
            els.copyMarkdownBtn.style.backgroundColor = '#188038';
            
            setTimeout(() => {
                els.copyMarkdownBtn.textContent = originalText;
                els.copyMarkdownBtn.style.backgroundColor = '';
            }, 2000);
        })
        .catch(err => {
            console.error('复制失败:', err);
            alert('复制失败，请手动选择并复制内容');
        });
}

// -------------------------------------
// 11. 文件处理功能
// -------------------------------------
function handleFile(file) {
    if (!file.name.endsWith('.txt')) {
        alert('仅支持 .txt 文件');
        return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        els.textInput.value = e.target.result;
        handleTextInput();
    };
    reader.readAsText(file);
}

function handleDrop(e) {
    e.preventDefault(); 
    els.inputArea.classList.remove('drag-over');
    if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
}

function handleDragOver(e) {
    e.preventDefault(); 
    els.inputArea.classList.add('drag-over'); 
}

function handleDragLeave() { 
    els.inputArea.classList.remove('drag-over'); 
}

// function handleInputAreaClick(e) {
//     if(e.target === els.inputArea) els.fileInput.click();
// }

function handleFileInputChange(e) {
    if(e.target.files[0]) handleFile(e.target.files[0]);
}

function handleUploadClick() {
    els.fileInput.click();
}

async function handlePasteClick() {
    try {
        const text = await navigator.clipboard.readText();
        els.textInput.value = text;
        handleTextInput();
    } catch (err) {
        console.error('粘贴失败:', err);
        alert('无法访问剪贴板，请确保已授予权限或手动粘贴');
    }
}

// -------------------------------------
// 12. 预览模式功能
// -------------------------------------
function showPreview(text) {
    resetUIForNewInput();
    originalTextForPreview = text;
    
    previewSegments = splitText(text);
    if (previewSegments.length === 0) {
        alert('未识别到有效段落，请检查文本');
        return;
    }
    
    els.results.innerHTML = '';
    
    const previewTitle = document.createElement('h3');
    previewTitle.textContent = `📋 切割预览 (${previewSegments.length} 段) - 点击段落旁的删除按钮可移除段落`;
    previewTitle.style.color = 'var(--primary-color)';
    previewTitle.style.borderBottom = '2px solid var(--primary-color)';
    previewTitle.style.paddingBottom = '8px';
    els.results.appendChild(previewTitle);
    
    const tip = document.createElement('p');
    tip.textContent = '提示：删除不需要分析的段落后，点击"确认并开始分析"开始';
    tip.style.fontSize = '0.9em';
    tip.style.color = 'var(--text-disabled)';
    tip.style.marginTop = '10px';
    els.results.appendChild(tip);
    
    previewSegments.forEach((item, idx) => {
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'segment-container';
        segmentDiv.setAttribute('data-preview-index', item.index);
        segmentDiv.setAttribute('data-visible', 'true');
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'segment-header';
        
        const title = document.createElement('h4');
        title.textContent = `第 ${idx + 1} 段 (原始索引: ${item.index + 1})`;
        headerDiv.appendChild(title);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('data-index', item.index);
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = function() {
            deleteSegment(item.index, segmentDiv);
        };
        headerDiv.appendChild(deleteBtn);
        
        segmentDiv.appendChild(headerDiv);
        
        const contentDiv = document.createElement('div');
        contentDiv.style.padding = '12px';
        contentDiv.style.backgroundColor = 'var(--container-bg-light)';
        contentDiv.style.borderRadius = '6px';
        contentDiv.style.marginTop = '8px';
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.style.wordBreak = 'break-word';
        contentDiv.style.fontFamily = "'Noto Serif SC', serif";
        contentDiv.style.lineHeight = '1.6';
        contentDiv.style.border = '1px solid var(--border-light)';
        contentDiv.textContent = item.segment;
        segmentDiv.appendChild(contentDiv);
        
        els.results.appendChild(segmentDiv);
        
        if (idx < previewSegments.length - 1) {
            const hr = document.createElement('hr');
            els.results.appendChild(hr);
        }
    });
    
    els.copyMarkdownBtn.disabled = true;
    
    const visibleSegments = previewSegments.filter(item => !segmentsToRemove.has(item.index));
    if (visibleSegments.length === 0) {
        els.startBtn.disabled = true;
        const warning = document.createElement('p');
        warning.id = 'all-deleted-warning';
        warning.textContent = '⚠️ 所有段落都已删除，请返回修改输入文本';
        warning.style.color = 'var(--delete-color)';
        warning.style.marginTop = '15px';
        warning.style.fontWeight = '500';
        els.results.appendChild(warning);
    } else {
        const existingWarning = document.getElementById('all-deleted-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
    }
    
    isPreviewMode = false;
    originalTextForPreview = text;
    els.startBtn.textContent = '✅ 确认并开始分析';
    document.body.classList.add('preview-mode');
    document.getElementById('output-area').style.display = 'block';
}

function deleteSegment(originalIndex, divElement) {
    segmentsToRemove.add(originalIndex);
    divElement.style.display = 'none';
    divElement.setAttribute('data-visible', 'false');
    
    const nextSibling = divElement.nextSibling;
    if (nextSibling && nextSibling.tagName === 'HR') {
        nextSibling.style.display = 'none';
    }
    
    const visibleCount = previewSegments.filter(item => !segmentsToRemove.has(item.index)).length;
    const previewTitle = els.results.querySelector('h3');
    if (previewTitle) {
        previewTitle.textContent = `📋 切割预览 (${visibleCount}/${previewSegments.length} 段) - 已删除 ${segmentsToRemove.size} 段`;
        previewTitle.style.color = visibleCount > 0 ? 'var(--primary-color)' : 'var(--delete-color)';
    }
    
    if (visibleCount === 0) {
        els.startBtn.disabled = true;
        const existingWarning = document.getElementById('all-deleted-warning');
        if (!existingWarning) {
            const warning = document.createElement('p');
            warning.id = 'all-deleted-warning';
            warning.textContent = '⚠️ 所有段落都已删除，请返回修改输入文本';
            warning.style.color = 'var(--delete-color)';
            warning.style.marginTop = '15px';
            warning.style.fontWeight = '500';
            els.results.appendChild(warning);
        }
    } else {
        els.startBtn.disabled = false;
        const existingWarning = document.getElementById('all-deleted-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
    }
}

// -------------------------------------
// 13. 开始分析主逻辑
// -------------------------------------
function beginRealAnalysis() {
    if (!originalTextForPreview) return;
    
    const allSegments = splitText(originalTextForPreview);
    const filteredSegments = allSegments.filter(item => !segmentsToRemove.has(item.index));
    
    if (filteredSegments.length === 0) {
        alert('没有需要分析的段落，请先删除不再需要的段落');
        isPreviewMode = true;
        els.startBtn.textContent = '开始分析';
        segmentsToRemove.clear();
        previewSegments = [];
        showPreview(originalTextForPreview);
        return;
    }
    
    resetUIForNewInput();
    
    analysisSegments = filteredSegments;
    segmentQueue = [...filteredSegments];
    totalSegments = filteredSegments.length;
    segmentsCompleted = 0;
    activeWorkers = 0;
    resultsMap.clear();
    retryMap.clear();
    failedSegments = [];
    
    els.progressContainer.style.display = 'block';
    els.loadingText.style.display = 'block';
    els.loadingText.textContent = '正在分析...';
    els.startBtn.disabled = true;
    
    runQueue();
    
    isPreviewMode = true;
    els.startBtn.textContent = '开始分析';
    segmentsToRemove.clear();
    previewSegments = [];
    originalTextForPreview = '';
    document.body.classList.remove('preview-mode');
}

function startAnalysis() {
    const txt = els.textInput.value.trim();
    if (!txt) {
        alert('请输入内容');
        return;
    }
    
    if (isPreviewMode) {
        showPreview(txt);
    } else {
        beginRealAnalysis();
    }
}
