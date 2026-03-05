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

    // 初始化合并状态
    state.initializeMergeState();

    // 渲染预览组
    renderPreviewGroups();

    els.copyMarkdownBtn.disabled = true;

    const visibleSegments = state.rootGroupIds.filter(id => {
        const group = getGroupData(id);
        return group && !group.indices.some(idx => state.segmentsToRemove.has(idx));
    }).length;
    if (visibleSegments === 0) {
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
    // 修改输出标题为切割结果
    const outputTitle = document.getElementById('output-title');
    if (outputTitle) outputTitle.textContent = '切割结果：';
}


// ============================================
// 合并管理函数
// ============================================

export function getGroupData(groupId) {
    if (state.mergedGroups.has(groupId)) {
        return state.mergedGroups.get(groupId);
    } else if (typeof groupId === 'number') {
        const segment = state.previewSegments.find(s => s.index === groupId);
        return segment ? { id: groupId, indices: [groupId], segments: [segment] } : null;
    }
    return null;
}

function mergeAdjacentGroups(groupId1, groupId2) {
    // 获取两个组的数据
    const group1 = getGroupData(groupId1);
    const group2 = getGroupData(groupId2);

    if (!group1 || !group2) {
        console.error('无法找到组数据');
        return null;
    }

    // 检查两个组中是否有段落被删除
    const hasDeleted1 = group1.indices.some(idx => state.segmentsToRemove.has(idx));
    const hasDeleted2 = group2.indices.some(idx => state.segmentsToRemove.has(idx));
    if (hasDeleted1 || hasDeleted2) {
        console.error('无法合并包含已删除段落的组');
        return null;
    }

    // 验证相邻性
    const index1 = state.rootGroupIds.indexOf(groupId1);
    const index2 = state.rootGroupIds.indexOf(groupId2);
    if (Math.abs(index1 - index2) !== 1) {
        console.error('只能合并相邻的组');
        return null;
    }

    // 创建新组
    const newGroupId = `merged_${state.nextGroupId++}`;
    const newGroup = {
        id: newGroupId,
        indices: [...group1.indices, ...group2.indices].sort((a, b) => a - b),
        segments: [...group1.segments, ...group2.segments].sort((a, b) => a.index - b.index)
    };

    // 更新状态
    state.mergedGroups.set(newGroupId, newGroup);
    newGroup.indices.forEach(idx => {
        state.paragraphToGroup.set(idx, newGroupId);
    });

    // 更新rootGroupIds
    state.rootGroupIds.splice(index1, 1); // 移除第一个
    const newIndex2 = state.rootGroupIds.indexOf(groupId2); // 重新查找第二个
    state.rootGroupIds.splice(newIndex2, 1); // 移除第二个
    state.rootGroupIds.splice(index1, 0, newGroupId); // 插入新组

    return newGroupId;
}

function splitGroup(groupId) {
    const group = state.mergedGroups.get(groupId);
    if (!group || group.indices.length <= 1) return;

    // 移除合并组
    state.mergedGroups.delete(groupId);

    // 恢复原始段落映射
    group.indices.forEach(idx => {
        state.paragraphToGroup.set(idx, idx);
    });

    // 在rootGroupIds中替换组ID为原始段落
    const groupIndex = state.rootGroupIds.indexOf(groupId);
    if (groupIndex !== -1) {
        state.rootGroupIds.splice(groupIndex, 1, ...group.indices);
    }
}

// 新增渲染函数
function renderPreviewGroups() {
    els.results.innerHTML = '';

    // 添加标题和提示
    const previewTitle = document.createElement('h3');
    const visibleCount = state.rootGroupIds.filter(id => {
        const group = getGroupData(id);
        return group && !group.indices.some(idx => state.segmentsToRemove.has(idx));
    }).length;
    previewTitle.textContent = `📋 切割预览 (${visibleCount}/${state.previewSegments.length} 段) - 点击段落旁的按钮进行操作`;
    previewTitle.style.color = 'var(--primary-color)';
    previewTitle.style.borderBottom = '2px solid var(--primary-color)';
    previewTitle.style.paddingBottom = '8px';
    els.results.appendChild(previewTitle);

    const tip = document.createElement('p');
    tip.textContent = '提示：使用"与下一组合并"按钮合并相邻段落，合并后的组可以使用"拆分"按钮恢复';
    tip.style.fontSize = '0.9em';
    tip.style.color = 'var(--text-disabled)';
    tip.style.marginTop = '10px';
    els.results.appendChild(tip);

    // 渲染根组
    let displayIndex = 0;
    for (let i = 0; i < state.rootGroupIds.length; i++) {
        const groupId = state.rootGroupIds[i];
        const group = getGroupData(groupId);
        if (!group) continue;

        // 检查组中是否有段落被删除
        const hasDeleted = group.indices.some(idx => state.segmentsToRemove.has(idx));
        if (hasDeleted) continue;

        // 创建段落容器
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'segment-container';
        if (group.indices.length > 1) {
            segmentDiv.classList.add('merged-group-container');
        }
        segmentDiv.setAttribute('data-group-id', group.id);

        // 创建头部（标题和按钮）
        const headerDiv = document.createElement('div');
        headerDiv.className = 'segment-header';

        // 标题
        const title = document.createElement('h4');
        if (group.indices.length === 1) {
            title.textContent = `第 ${group.indices[0] + 1} 段`;
        } else {
            title.textContent = `第${group.indices.map(idx => idx + 1).join('、')}段`;
            title.style.color = 'var(--primary-color)';
        }
        headerDiv.appendChild(title);

        // 按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.alignItems = 'center';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.gap = '8px';

        // 与下一组合并按钮（如果不是最后一个且下一组未被删除）
        if (i < state.rootGroupIds.length - 1) {
            const nextGroupId = state.rootGroupIds[i + 1];
            const nextGroup = getGroupData(nextGroupId);
            const nextHasDeleted = nextGroup && nextGroup.indices.some(idx => state.segmentsToRemove.has(idx));
            if (!nextHasDeleted) {
                const mergeBtn = document.createElement('button');
                mergeBtn.className = 'merge-btn';
                mergeBtn.textContent = '与下一组合并';
                mergeBtn.onclick = () => handleMergeClick(groupId);
                buttonContainer.appendChild(mergeBtn);
            }
        }

        // 拆分按钮（如果是合并组）
        if (group.indices.length > 1) {
            const splitBtn = document.createElement('button');
            splitBtn.className = 'split-btn';
            splitBtn.textContent = '拆分';
            splitBtn.onclick = () => handleSplitClick(groupId);
            buttonContainer.appendChild(splitBtn);
        }

        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = function() {
            deleteSegment(group.indices[0], segmentDiv);
        };
        buttonContainer.appendChild(deleteBtn);

        headerDiv.appendChild(buttonContainer);
        segmentDiv.appendChild(headerDiv);

        // 内容区域
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

        if (group.indices.length === 1) {
            contentDiv.textContent = group.segments[0].segment;
        } else {
            // 合并多个段落的内容
            let combinedText = '';
            group.segments.forEach((seg, idx) => {
                combinedText += seg.segment;
                if (idx < group.segments.length - 1) {
                    combinedText += '\n\n';
                }
            });
            contentDiv.textContent = combinedText;
        }
        segmentDiv.appendChild(contentDiv);

        els.results.appendChild(segmentDiv);

        // 添加分隔线（如果不是最后一项）
        if (i < state.rootGroupIds.length - 1) {
            const nextGroupId = state.rootGroupIds[i + 1];
            const nextGroup = getGroupData(nextGroupId);
            const nextHasDeleted = nextGroup && nextGroup.indices.some(idx => state.segmentsToRemove.has(idx));
            if (!nextHasDeleted) {
                const hr = document.createElement('hr');
                els.results.appendChild(hr);
            }
        }

        displayIndex++;
    }
}

// 事件处理函数
function handleMergeClick(groupId) {
    const currentIndex = state.rootGroupIds.indexOf(groupId);
    if (currentIndex === -1 || currentIndex >= state.rootGroupIds.length - 1) return;

    const nextGroupId = state.rootGroupIds[currentIndex + 1];
    mergeAdjacentGroups(groupId, nextGroupId);
    renderPreviewGroups(); // 重新渲染
}

function handleSplitClick(groupId) {
    splitGroup(groupId);
    renderPreviewGroups(); // 重新渲染
}

// 修改deleteSegment函数，支持删除合并组
export function deleteSegment(originalIndex, divElement) {
    // 调试信息
    console.log('尝试删除段落:', {
        originalIndex,
        groupId: state.paragraphToGroup.get(originalIndex)
    });

    // 获取组ID
    const groupId = state.paragraphToGroup.get(originalIndex);
    if (groupId === undefined || groupId === null) {
        console.error('找不到段落组ID:', originalIndex);
        alert(`无法删除段落：找不到段落数据（索引: ${originalIndex + 1}）`);
        return;
    }

    // 获取组数据
    const group = getGroupData(groupId);
    if (!group) {
        console.error('找不到组数据:', groupId);
        alert(`无法删除段落：找不到段落组（ID: ${groupId}）`);
        return;
    }

    // 标记组中所有段落为删除
    group.indices.forEach(idx => {
        state.segmentsToRemove.add(idx);
    });

    // 隐藏UI
    divElement.style.display = 'none';
    divElement.setAttribute('data-visible', 'false');

    const nextSibling = divElement.nextSibling;
    if (nextSibling && nextSibling.tagName === 'HR') {
        nextSibling.style.display = 'none';
    }

    const visibleCount = state.rootGroupIds.filter(id => {
        const group = getGroupData(id);
        return group && !group.indices.some(idx => state.segmentsToRemove.has(idx));
    }).length;
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