// 模型管理模块
import { fetchPresets } from './config.js';

const READONLY_PRESETS = ['openrouter_kimi', 'deepseek'];

/**
 * 从显示名称生成预设ID
 */
function generatePresetId(displayName) {
    // 将显示名称转换为小写，用下划线替换非字母数字字符
    let id = displayName.toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')  // 允许中文，但中文会被替换为下划线
        .replace(/_+/g, '_')  // 合并连续下划线
        .replace(/^_+|_+$/g, '');  // 去除首尾下划线
    
    // 如果结果为空，使用时间戳
    if (!id) {
        id = 'preset_' + Date.now();
    }
    
    // 确保ID以字母开头
    if (!/^[a-z]/.test(id)) {
        id = 'model_' + id;
    }
    
    return id;
}

// DOM 元素引用
let modal;
let editModal;
let modelList;
let newModelBtn;
let closeModalBtn;
let cancelModalBtn;
let saveOrderBtn;
let closeEditModalBtn;
let saveModelBtn;
let cancelEditBtn;
let modelEditForm;
let editModelIdInput;
let editDisplayNameInput;
let editModelNameInput;
let editApiEndpointInput;
let editApiKeyInput;
let editCustomParamInput;
let editModalTitle;

// 当前模型列表数据
let currentModels = [];
let draggingItem = null;

/**
 * 初始化模型管理功能
 */
export function initModelManagement() {
    // 获取DOM元素
    modal = document.getElementById('model-management-modal');
    editModal = document.getElementById('model-edit-modal');
    modelList = document.getElementById('model-list');
    newModelBtn = document.getElementById('new-model-btn');
    closeModalBtn = document.getElementById('close-modal-btn');
    cancelModalBtn = document.getElementById('cancel-modal-btn');
    saveOrderBtn = document.getElementById('save-order-btn');
    closeEditModalBtn = document.getElementById('close-edit-modal-btn');
    saveModelBtn = document.getElementById('save-model-btn');
    cancelEditBtn = document.getElementById('cancel-edit-btn');
    modelEditForm = document.getElementById('model-edit-form');
    editModelIdInput = document.getElementById('edit-model-id');
    editDisplayNameInput = document.getElementById('edit-display-name');
    editModelNameInput = document.getElementById('edit-model-name');
    editApiEndpointInput = document.getElementById('edit-api-endpoint');
    editApiKeyInput = document.getElementById('edit-api-key');
    editCustomParamInput = document.getElementById('edit-custom-param');
    editModalTitle = document.getElementById('edit-modal-title');
    
    // 绑定事件监听器
    const settingsBtn = document.getElementById('model-settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openModal);
    }
    
    newModelBtn.addEventListener('click', handleNewModel);
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    closeEditModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);
    saveOrderBtn.addEventListener('click', saveModelOrder);
    saveModelBtn.addEventListener('click', saveModel);
    
    // 初始化拖拽排序
    initDragAndDrop();
}

/**
 * 打开模型管理模态框
 */
async function openModal() {
    try {
        await loadModelList();
        modal.style.display = 'flex';
        saveOrderBtn.style.display = 'none';
    } catch (error) {
        console.error('Failed to load models:', error);
        alert('无法加载模型列表：' + error.message);
    }
}

/**
 * 关闭模型管理模态框
 */
function closeModal() {
    modal.style.display = 'none';
}

/**
 * 打开模型编辑模态框
 */
function openEditModal(model = null) {
    if (model) {
        // 编辑现有模型
        editModalTitle.textContent = '编辑模型配置';
        editModelIdInput.value = model.id;
        editDisplayNameInput.value = model.name || model.id;
        editModelNameInput.value = model.model_name || model.id;
        editApiEndpointInput.value = model.api_endpoint || '';
        editApiKeyInput.value = ''; // 出于安全考虑，不显示现有密钥
        editCustomParamInput.value = model.custom_param ? JSON.stringify(model.custom_param, null, 2) : '';
    } else {
        // 新建模型
        editModalTitle.textContent = '新建模型配置';
        editModelIdInput.value = '';
        editDisplayNameInput.value = '';
        editModelNameInput.value = '';
        editApiEndpointInput.value = '';
        editApiKeyInput.value = '';
        editCustomParamInput.value = '';
    }
    
    // 如果是只读预设，只允许编辑API密钥和自定义参数
    const isReadonly = model && READONLY_PRESETS.includes(model.id);
    editDisplayNameInput.disabled = isReadonly;
    editModelNameInput.disabled = isReadonly;
    editApiEndpointInput.disabled = isReadonly;
    // 自定义参数和API密钥字段保持可编辑
    editCustomParamInput.disabled = false;
    editApiKeyInput.disabled = false;
    
    editModal.style.display = 'flex';
}

/**
 * 关闭模型编辑模态框
 */
function closeEditModal() {
    editModal.style.display = 'none';
    modelEditForm.reset();
}

/**
 * 加载模型列表
 */
async function loadModelList() {
    try {
        const response = await fetch('/api/presets');
        const data = await response.json();
        
        if (data.success) {
            currentModels = data.presets;
            renderModelList();
        } else {
            throw new Error(data.error || '加载模型列表失败');
        }
    } catch (error) {
        console.error('Error loading models:', error);
        throw error;
    }
}

/**
 * 渲染模型列表
 */
function renderModelList() {
    modelList.innerHTML = '';
    
    currentModels.forEach(model => {
        const li = document.createElement('li');
        li.dataset.id = model.id;
        li.draggable = !READONLY_PRESETS.includes(model.id); // 只读预设不可拖拽
        
        // 模型名称
        const nameSpan = document.createElement('span');
        nameSpan.className = 'model-name';
        nameSpan.textContent = model.name;
        li.appendChild(nameSpan);
        
        // 操作按钮
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'model-actions';
        
        // 编辑按钮（所有预设都显示）
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadModelDetail(model.id);
        });
        actionsDiv.appendChild(editBtn);
        
        // 只读预设不显示删除按钮
        if (!READONLY_PRESETS.includes(model.id)) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '删除';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteModel(model.id);
            });
            actionsDiv.appendChild(deleteBtn);
        }
        
        li.appendChild(actionsDiv);
        
        modelList.appendChild(li);
    });
}

/**
 * 加载模型详情
 */
async function loadModelDetail(presetId) {
    try {
        const response = await fetch(`/api/presets/${presetId}`);
        const data = await response.json();
        
        if (data.success) {
            openEditModal(data.preset);
        } else {
            throw new Error(data.error || '加载模型详情失败');
        }
    } catch (error) {
        console.error('Error loading model detail:', error);
        alert('无法加载模型详情：' + error.message);
    }
}

/**
 * 保存模型（新建或更新）
 */
async function saveModel() {
    const modelId = editModelIdInput.value.trim();
    const displayName = editDisplayNameInput.value.trim();
    const modelName = editModelNameInput.value.trim();
    const apiEndpoint = editApiEndpointInput.value.trim();
    const apiKey = editApiKeyInput.value.trim();
    let customParam = {};
    
    // 验证必填字段
    if (!displayName) {
        alert('请输入模型名称');
        return;
    }
    
    if (!modelName) {
        alert('请输入API模型标识符');
        return;
    }
    
    if (!apiEndpoint) {
        alert('请输入API端点');
        return;
    }
    
    // 解析自定义参数
    if (editCustomParamInput.value.trim()) {
        try {
            customParam = JSON.parse(editCustomParamInput.value);
        } catch (e) {
            alert('自定义参数必须是有效的JSON格式');
            return;
        }
    }
    
    const modelData = {
        name: displayName,
        model_name: modelName,
        api_endpoint: apiEndpoint,
        custom_param: customParam
    };
    
    // 如果提供了新密钥，则包含它
    if (apiKey) {
        modelData.api_key = apiKey;
    }
    
    // 判断是新建还是编辑
    const isNew = modelId === '';
    let finalModelId = modelId;
    
    // 新建模型时自动生成ID
    if (isNew) {
        finalModelId = generatePresetId(displayName);
        editModelIdInput.value = finalModelId;
    }
    
    try {
        let response;
        
        if (isNew) {
            // 新建模型
            response = await fetch('/api/presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: finalModelId, ...modelData })
            });
        } else {
            // 更新现有模型
            response = await fetch(`/api/presets/${finalModelId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(modelData)
            });
        }
        
        const data = await response.json();
        
        if (data.success) {
            closeEditModal();
            await loadModelList(); // 刷新列表
            alert('保存成功');
        } else {
            throw new Error(data.error || '保存失败');
        }
    } catch (error) {
        console.error('Error saving model:', error);
        alert('保存模型失败：' + error.message);
    }
}

/**
 * 删除模型
 */
async function deleteModel(presetId) {
    if (!confirm(`确定要删除模型 "${presetId}" 吗？此操作无法撤销。`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/presets/${presetId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadModelList(); // 刷新列表
            alert('删除成功');
        } else {
            throw new Error(data.error || '删除失败');
        }
    } catch (error) {
        console.error('Error deleting model:', error);
        alert('删除模型失败：' + error.message);
    }
}

/**
 * 处理新建模型
 */
function handleNewModel() {
    openEditModal();
}

/**
 * 初始化拖拽排序
 */
function initDragAndDrop() {
    let dragOverElement = null;
    let lastDragTime = 0;
    
    modelList.addEventListener('dragstart', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        
        draggingItem = li;
        // 设置拖动效果
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        
        setTimeout(() => {
            li.classList.add('dragging');
            // 添加拖动开始时的动画，与CSS保持一致
            li.style.transition = 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)';
        }, 0);
    });
    
    modelList.addEventListener('dragend', (e) => {
        if (draggingItem) {
            draggingItem.classList.remove('dragging');
            draggingItem.style.transition = '';
            draggingItem = null;
            saveOrderBtn.style.display = 'block'; // 显示保存按钮
        }
        // 清除所有 drag-over 状态
        if (dragOverElement) {
            dragOverElement.classList.remove('drag-over');
            dragOverElement = null;
        }
        Array.from(modelList.children).forEach(child => {
            child.classList.remove('drag-over');
        });
    });
    
    modelList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(modelList, e.clientY);
        const draggable = document.querySelector('.dragging');
        
        // 清除之前的高亮
        if (dragOverElement && dragOverElement !== afterElement) {
            dragOverElement.classList.remove('drag-over');
        }
        
        // 设置新的高亮
        if (afterElement) {
            afterElement.classList.add('drag-over');
            dragOverElement = afterElement;
        } else {
            // 如果 afterElement 为 null，说明拖动到了列表末尾
            // 可以高亮最后一个元素或什么都不做
            if (dragOverElement) {
                dragOverElement.classList.remove('drag-over');
                dragOverElement = null;
            }
        }
        
        // 节流插入操作，每50ms执行一次，使动画更流畅
        const now = Date.now();
        if (draggable && now - lastDragTime > 50) {
            if (afterElement) {
                modelList.insertBefore(draggable, afterElement);
            } else {
                // 如果没有 afterElement，则追加到末尾
                modelList.appendChild(draggable);
            }
            lastDragTime = now;
        }
    });
    
    modelList.addEventListener('dragleave', (e) => {
        // 当拖动离开列表时，清除高亮
        if (!e.relatedTarget || !modelList.contains(e.relatedTarget)) {
            if (dragOverElement) {
                dragOverElement.classList.remove('drag-over');
                dragOverElement = null;
            }
        }
    });
}

/**
 * 获取拖拽后的元素位置
 */
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
    
    // 如果没有可放置的元素，返回 null
    if (draggableElements.length === 0) {
        return null;
    }
    
    let closestBefore = { offset: Number.NEGATIVE_INFINITY, element: null };
    let closestAfter = { offset: Number.POSITIVE_INFINITY, element: null };
    
    for (const child of draggableElements) {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0) {
            // 鼠标在元素的上半部分，候选插入到该元素之前
            if (offset > closestBefore.offset) {
                closestBefore = { offset, element: child };
            }
        } else {
            // 鼠标在元素的下半部分，候选插入到该元素之后
            if (offset < closestAfter.offset) {
                closestAfter = { offset, element: child };
            }
        }
    }
    
    // 优先选择上半部分的元素（插入到之前）
    if (closestBefore.element) {
        return closestBefore.element;
    }
    
    // 如果没有上半部分的元素，则选择下半部分的元素
    if (closestAfter.element) {
        // 如果目标元素不是最后一个，则返回它的下一个兄弟元素（插入到之后）
        const nextSibling = closestAfter.element.nextElementSibling;
        if (nextSibling) {
            return nextSibling;
        } else {
            // 如果是最后一个元素，则返回 null 表示插入到末尾
            return null;
        }
    }
    
    // 默认返回 null（应该不会执行到这里）
    return null;
}

/**
 * 保存模型顺序
 */
async function saveModelOrder() {
    const newOrder = Array.from(modelList.children).map(li => li.dataset.id);
    
    try {
        const response = await fetch('/api/presets/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: newOrder })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadModelList(); // 刷新列表
            saveOrderBtn.style.display = 'none';
            alert('顺序已保存');
        } else {
            throw new Error(data.error || '保存顺序失败');
        }
    } catch (error) {
        console.error('Error saving order:', error);
        alert('保存顺序失败：' + error.message);
    }
}