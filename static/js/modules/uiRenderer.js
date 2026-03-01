// -------------------------------------
// UI渲染器：进度管理、结果渲染、格式化、复制功能
// -------------------------------------

import { els } from './config.js';
import state from './state.js';

// API状态管理
export function updateApiStatusUI(stateValue, details) {
    switch(stateValue) {
        case 'ready':
            state.apiConnectedState = false;
            els.apiStatus.innerHTML = '🟢 就绪';
            els.apiStatus.style.color = '#188038';
            break;
        case 'connecting':
            els.apiStatus.innerHTML = '🟡 正在连接后端...';
            els.apiStatus.style.color = '#f9ab00';
            break;
        case 'analyzing':
            state.apiConnectedState = true;
            els.apiStatus.innerHTML = '🟡 正在分析段落...';
            els.apiStatus.style.color = '#f9ab00';
            break;
        case 'finished':
            state.apiConnectedState = true;
            els.apiStatus.innerHTML = '✅ 分析完成';
            els.apiStatus.style.color = '#188038';
            break;
        case 'error':
            if (details) {
                // 分析错误，连接可能正常
                els.apiStatus.innerHTML = `❌ ${details}`;
            } else {
                // 连接错误
                state.apiConnectedState = false;
                els.apiStatus.innerHTML = '❌ 连接失败: 无法连接到后端服务';
            }
            els.apiStatus.style.color = '#d93025';
            break;
    }
}

// 文本输入处理
export function handleTextInput() {
    if (state.previewSegments.length > 0 || state.resultsMap.size > 0) {
        resetUIForNewInput();
    }
}

export function resetUIForNewInput() {
    els.results.innerHTML = '';
    els.copyMarkdownBtn.disabled = true;
    updateApiStatusUI('ready');
    els.failedStatus.textContent = '';
    state.resultsMap.clear();
    state.retryMap.clear();
    state.failedSegments = [];
    state.totalSegments = 0;
    state.segmentsCompleted = 0;
    state.activeWorkers = 0;
    state.currentMarkdownContent = '';
    state.isPreviewMode = true;
    state.segmentsToRemove.clear();
    state.previewSegments = [];
    state.originalTextForPreview = '';
    state.analysisSegments = [];
    els.startBtn.textContent = '开始分析';
    els.progressContainer.style.display = 'none';
    els.loadingText.style.display = 'none';
    document.body.classList.remove('preview-mode');
}

// 进度管理
export function updateProgress() {
    const pct = (state.segmentsCompleted / state.totalSegments) * 100;
    els.progressBar.style.width = pct + '%';
    els.loadingText.textContent = '已完成: ' + state.segmentsCompleted + '/' + state.totalSegments;
    els.loadingText.style.display = 'block';
}

export function updateFailedStatus() {
    if (state.failedSegments.length === 0) {
        els.failedStatus.textContent = '';
        els.failedStatus.style.display = 'none';
    } else {
        els.failedStatus.style.display = 'block';
        const finalFailures = state.failedSegments.filter(f => !f.isRetrying);
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

export function finishAnalysis() {
    els.progressContainer.style.display = 'none';

    const successfulCount = state.totalSegments - state.failedSegments.filter(f => !f.isRetrying).length;
    const finalFailures = state.failedSegments.filter(f => !f.isRetrying);

    // 更新API状态显示
    if (finalFailures.length === 0) {
        updateApiStatusUI('finished');
    } else {
        const failedIndices = finalFailures.map(f => f.index + 1).sort((a, b) => a - b).join(',');
        const errorDetails = `分析完成 (成功${successfulCount}/${state.totalSegments}段，第${failedIndices}段失败)`;
        updateApiStatusUI('error', errorDetails);
    }

    let completionMessage = '';

    if (finalFailures.length === 0) {
        completionMessage = `✅ 成功分析 ${state.totalSegments}/${state.totalSegments} 段`;
    } else {
        const failedIndices = finalFailures.map(f => f.index + 1).sort((a, b) => a - b).join(',');
        completionMessage = `✅ 成功分析 ${successfulCount}/${state.totalSegments} 段，其中第${failedIndices}段失败`;

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

// 结果渲染与格式化

export function formatResponse(response) {
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

export function renderResults() {
    els.results.innerHTML = '';

    for (let displayIndex = 0; displayIndex < state.analysisSegments.length; displayIndex++) {
        const segmentInfo = state.analysisSegments[displayIndex];
        const originalIndex = segmentInfo.index;
        const r = state.resultsMap.get(originalIndex);

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

        let titleText;
        if (segmentInfo.isMerged && segmentInfo.mergedIndices) {
            // 显示合并的段落索引（如：第1、2、3段）
            const mergedSegmentNumbers = segmentInfo.mergedIndices.map(idx => idx + 1).join('、');
            titleText = `第${mergedSegmentNumbers}段`;
        } else {
            titleText = `第${segmentInfo.index + 1}段：${r.original}`;
        }
        titleTextContainer.textContent = titleText;
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

        if (segmentInfo.isMerged && segmentInfo.originalSegments) {
            // 合并段落：显示各个原始段落，然后显示分析结果
            let contentHTML = '';

            // 显示各个原始段落作为二级标题（使用<h2>）
            segmentInfo.originalSegments.forEach(seg => {
                contentHTML += `<h2>${seg.text}</h2>`;
            });

            // 添加分析结果
            contentHTML += formatResponse(r.response);
            contentDiv.innerHTML = contentHTML;
        } else {
            contentDiv.innerHTML = formatResponse(r.response);
        }
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

        if (displayIndex < state.analysisSegments.length - 1) {
            const hr = document.createElement('hr');
            els.results.appendChild(hr);
        }
    }
}

export function generateCurrentMarkdownContent() {
    state.currentMarkdownContent = '';

    for (let displayIndex = 0; displayIndex < state.analysisSegments.length; displayIndex++) {
        const segmentInfo = state.analysisSegments[displayIndex];
        const originalIndex = segmentInfo.index;
        const result = state.resultsMap.get(originalIndex);

        if (!result) continue;

        let headerText;
        if (segmentInfo.isMerged && segmentInfo.mergedIndices) {
            const mergedSegmentNumbers = segmentInfo.mergedIndices.map(idx => idx + 1).join('、');
            headerText = `## 第${mergedSegmentNumbers}段`;
        } else {
            headerText = `## 第${segmentInfo.index + 1}段：${result.original}`;
        }
        state.currentMarkdownContent += headerText + '\n\n';

        // 对于合并段落，先显示各个原始段落
        if (segmentInfo.isMerged && segmentInfo.originalSegments) {
            segmentInfo.originalSegments.forEach(seg => {
                state.currentMarkdownContent += `## ${seg.text}\n\n`;
            });
        }

        state.currentMarkdownContent += result.response + '\n\n';

        if (displayIndex < state.analysisSegments.length - 1) {
            state.currentMarkdownContent += '---\n\n';
        }
    }
}

// 复制功能
export function copyMarkdown() {
    if (state.resultsMap.size === 0) {
        alert('没有可复制的内容');
        return;
    }

    if (!state.currentMarkdownContent) {
        generateCurrentMarkdownContent();
    }

    navigator.clipboard.writeText(state.currentMarkdownContent)
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