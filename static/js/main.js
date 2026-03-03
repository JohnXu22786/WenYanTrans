// -------------------------------------
// 主入口文件：模块导入与应用初始化
// -------------------------------------

// 导入配置与常量
import { MAX_CONCURRENT_CALLS, MAX_RETRY_ATTEMPTS, BACKEND_ENDPOINT, SYSTEM_PROMPT, els } from './modules/config.js';
import state from './modules/state.js';
import { splitText, is_content } from './modules/textProcessor.js';
import { processItem, runQueue, regenerateSegment } from './modules/apiClient.js';
import {
    handleTextInput, resetUIForNewInput, updateProgress, updateFailedStatus,
    finishAnalysis, renderResults, formatResponse, copyMarkdown,
    generateCurrentMarkdownContent, updateApiStatusUI
} from './modules/uiRenderer.js';
import {
    handleFile, handleDrop, handleDragOver, handleDragLeave,
    handleFileInputChange, handleUploadClick, handlePasteClick
} from './modules/fileHandlers.js';
import { showPreview, deleteSegment, getGroupData } from './modules/previewMode.js';

// -------------------------------------
// 全局函数定义
// -------------------------------------

function prepareMergedSegments() {
    const segments = [];
    let displayIndex = 0;

    for (const groupId of state.rootGroupIds) {
        // 检查组是否被删除
        const group = getGroupData(groupId);
        if (!group) continue;

        // 检查组中是否有段落被删除
        const hasDeleted = group.indices.some(idx => state.segmentsToRemove.has(idx));
        if (hasDeleted) continue;

        if (group.indices.length === 1) {
            segments.push({
                index: group.indices[0],
                segment: group.segments[0].segment,
                retryCount: 0,
                isMerged: false
            });
        } else {
            // 合并多个段落的内容
            const mergedText = group.segments.map(seg => seg.segment).join('\n\n');
            segments.push({
                index: group.indices[0], // 使用第一个段落的索引作为标识
                segment: mergedText,
                retryCount: 0,
                isMerged: true,
                mergedIndices: group.indices,
                originalSegments: group.segments.map(seg => ({
                    index: seg.index,
                    text: seg.segment
                }))
            });
        }
        displayIndex++;
    }

    return segments;
}

function startAnalysis() {
    const txt = els.textInput.value.trim();
    if (!txt) {
        alert('请输入内容');
        return;
    }

    if (state.isPreviewMode) {
        showPreview(txt);
    } else {
        beginRealAnalysis();
    }
}

function beginRealAnalysis() {
    if (!state.originalTextForPreview) return;

    const filteredSegments = prepareMergedSegments();

    if (filteredSegments.length === 0) {
        alert('没有需要分析的段落，请先删除不再需要的段落');
        state.isPreviewMode = true;
        els.startBtn.textContent = '切割段落';
        state.segmentsToRemove.clear();
        state.previewSegments = [];
        showPreview(state.originalTextForPreview);
        return;
    }

    resetUIForNewInput();

    // 修改输出标题为分析结果
    const outputTitle = document.getElementById('output-title');
    if (outputTitle) outputTitle.textContent = '分析结果：';

    state.analysisSegments = filteredSegments;
    state.segmentQueue = [...filteredSegments];
    state.totalSegments = filteredSegments.length;
    state.segmentsCompleted = 0;
    state.activeWorkers = 0;
    state.resultsMap.clear();
    state.retryMap.clear();
    state.failedSegments = [];

    els.progressContainer.style.display = 'block';
    els.loadingText.style.display = 'block';
    els.loadingText.textContent = '正在分析...';
    els.startBtn.disabled = true;

    runQueue();

    state.isPreviewMode = true;
    els.startBtn.textContent = '切割段落';
    state.segmentsToRemove.clear();
    state.previewSegments = [];
    state.originalTextForPreview = '';
    document.body.classList.remove('preview-mode');
}

// -------------------------------------
// 事件绑定与初始化
// -------------------------------------

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

    // 绑定重新生成按钮的事件（通过事件委托）
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('regenerate-btn')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            regenerateSegment(index);
        }
    });
}

function init() {
    // 初始化DOM元素引用
    els.textInput = document.getElementById('text-input');
    els.fileInput = document.getElementById('file-input');
    els.inputArea = document.getElementById('input-area');
    els.startBtn = document.getElementById('start-button');
    els.copyMarkdownBtn = document.getElementById('copy-markdown-btn');
    els.results = document.getElementById('results-content');
    els.loadingText = document.getElementById('loading-text');
    els.progressBar = document.getElementById('progress-bar');
    els.progressContainer = document.getElementById('progress-container');
    els.statusMsg = document.getElementById('status-message');
    els.apiStatus = document.getElementById('api-status');
    els.failedStatus = document.getElementById('failed-status');
    els.uploadBtn = document.getElementById('upload-btn');
    els.pasteBtn = document.getElementById('paste-btn');

    updateApiStatusUI('ready');
    bindEventListeners();
    state.isPreviewMode = true;
    state.segmentsToRemove.clear();
    state.previewSegments = [];
    state.analysisSegments = [];
}

// 导出init供HTML onload调用
window.init = init;