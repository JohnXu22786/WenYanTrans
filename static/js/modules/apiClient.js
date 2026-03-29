// -------------------------------------
// API客户端：状态管理、后端调用、队列管理、重新生成
// -------------------------------------

import { BACKEND_ENDPOINT, els } from './config.js';
import state from './state.js';
import { renderResults, updateFailedStatus, updateProgress, finishAnalysis, generateCurrentMarkdownContent, updateApiStatusUI } from './uiRenderer.js';


// 后端API调用
export async function processItem(item) {
    state.activeWorkers++;
    let shouldIncrementProgress = false;

    if (!state.apiConnectedState && state.activeWorkers === 1 && state.segmentsCompleted === 0) {
        updateApiStatusUI('connecting');
    }

    try {
        // 发出请求后即认为连接已建立，更新状态为分析中
        if (!state.apiConnectedState && state.activeWorkers === 1) {
            updateApiStatusUI('analyzing');
        }

        const response = await fetch(`${BACKEND_ENDPOINT}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                segment: item.segment,
                preset: state.selectedModelPreset
            })
        });

        if (!response.ok) {
            throw new Error(`后端请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '未知错误');
        }

        state.resultsMap.set(item.index, {
            original: item.segment,
            response: data.result,
            status: 'success'
        });

        state.failedSegments = state.failedSegments.filter(f => f.index !== item.index);
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
            state.apiConnectedState = false;
        }

        const retryCount = state.retryMap.get(item.index) || 0;

        if (retryCount < 3) { // MAX_RETRY_ATTEMPTS 在 config 中定义为 3
            state.retryMap.set(item.index, retryCount + 1);

            const retryItem = {
                index: item.index,
                segment: item.segment,
                retryCount: retryCount + 1
            };

            state.segmentQueue.unshift(retryItem);

            state.resultsMap.set(item.index, {
                original: item.segment,
                response: '正在重试分析... (第' + (retryCount + 1) + '次重试)',
                status: 'retrying'
            });

            const existingFailed = state.failedSegments.find(f => f.index === item.index);
            if (existingFailed) {
                existingFailed.error = '正在重试...';
                existingFailed.isRetrying = true;
            } else {
                state.failedSegments.push({ index: item.index, error: '正在重试...', isRetrying: true });
            }

            shouldIncrementProgress = false;
            renderResults();
            updateFailedStatus();
        } else {
            if (!state.apiConnectedState) updateApiStatusUI('error');

            const errorMsg = err.message || '未知错误';
            state.resultsMap.set(item.index, {
                original: item.segment,
                response: '分析失败: ' + errorMsg + ' (已重试 3 次)',
                status: 'error'
            });

            const existingFailed = state.failedSegments.find(f => f.index === item.index);
            if (existingFailed) {
                existingFailed.error = errorMsg;
                existingFailed.isRetrying = false;
            } else {
                state.failedSegments.push({ index: item.index, error: errorMsg, isRetrying: false });
            }
            state.retryMap.delete(item.index);

            shouldIncrementProgress = true;
        }
    } finally {
        if (shouldIncrementProgress) {
            state.segmentsCompleted++;
            updateProgress();
        }
        state.activeWorkers--;
        runQueue();
    }
}

// 队列运行
export function runQueue() {
    if (state.segmentsCompleted === state.totalSegments && state.segmentQueue.length === 0) {
        finishAnalysis();
        return;
    }

    while (state.activeWorkers < 8 && state.segmentQueue.length > 0) { // MAX_CONCURRENT_CALLS = 8
        processItem(state.segmentQueue.shift());
    }
}

// 重新生成功能
export async function regenerateSegment(index) {
    const item = state.resultsMap.get(index);
    if (!item) return;

    const regenerateBtn = document.querySelector('.regenerate-btn[data-index="' + index + '"]');
    if (regenerateBtn) {
        regenerateBtn.disabled = true;
        regenerateBtn.textContent = '重新生成中...';
    }

    state.resultsMap.set(index, {
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
                segment: item.original,
                preset: state.selectedModelPreset
            })
        });

        if (!response.ok) {
            throw new Error(response.statusText);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '重新生成失败');
        }

        state.resultsMap.set(index, {
            original: item.original,
            response: data.result,
            status: 'success'
        });

        state.failedSegments = state.failedSegments.filter(f => f.index !== index);
        updateFailedStatus();

    } catch (err) {
        console.error('段落 ' + (index + 1) + ' 重新生成失败:', err);
        state.resultsMap.set(index, {
            original: item.original,
            response: '重新生成失败: ' + err.message,
            status: 'error'
        });

        state.failedSegments = state.failedSegments.filter(f => f.index !== index);
        state.failedSegments.push({ index: index, error: err.message, isRetrying: false });
        updateFailedStatus();
    }

    renderResults();
    generateCurrentMarkdownContent();
}