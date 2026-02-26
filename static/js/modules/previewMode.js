// -------------------------------------
// 预览模式功能
// -------------------------------------

import { els } from './config.js';
import state from './state.js';
import { resetUIForNewInput } from './uiRenderer.js';
import { splitText } from './textProcessor.js';

export function showPreview(text) {
    resetUIForNewInput();
    state.originalTextForPreview = text;

    state.previewSegments = splitText(text);
    if (state.previewSegments.length === 0) {
        alert('未识别到有效段落，请检查文本');
        return;
    }

    els.results.innerHTML = '';

    const previewTitle = document.createElement('h3');
    previewTitle.textContent = `📋 切割预览 (${state.previewSegments.length} 段) - 点击段落旁的删除按钮可移除段落`;
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

    state.previewSegments.forEach((item, idx) => {
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

        if (idx < state.previewSegments.length - 1) {
            const hr = document.createElement('hr');
            els.results.appendChild(hr);
        }
    });

    els.copyMarkdownBtn.disabled = true;

    const visibleSegments = state.previewSegments.filter(item => !state.segmentsToRemove.has(item.index));
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

    state.isPreviewMode = false;
    state.originalTextForPreview = text;
    els.startBtn.textContent = '✅ 确认并开始分析';
    document.body.classList.add('preview-mode');
    document.getElementById('output-area').style.display = 'block';
}

export function deleteSegment(originalIndex, divElement) {
    state.segmentsToRemove.add(originalIndex);
    divElement.style.display = 'none';
    divElement.setAttribute('data-visible', 'false');

    const nextSibling = divElement.nextSibling;
    if (nextSibling && nextSibling.tagName === 'HR') {
        nextSibling.style.display = 'none';
    }

    const visibleCount = state.previewSegments.filter(item => !state.segmentsToRemove.has(item.index)).length;
    const previewTitle = els.results.querySelector('h3');
    if (previewTitle) {
        previewTitle.textContent = `📋 切割预览 (${visibleCount}/${state.previewSegments.length} 段) - 已删除 ${state.segmentsToRemove.size} 段`;
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