// 模型管理模块
import { fetchPresets } from './config.js';

// 内置模型ID（向后兼容，优先使用API返回的is_builtin字段）
// 现在完全依赖后端返回的is_builtin字段
const READONLY_PRESETS = [];

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

/**
 * 初始化JSON编辑器
 */
function initJsonEditor() {
    if (jsonEditor) {
        return; // 已经初始化
    }
    
    const container = document.getElementById('json-editor-container');
    if (!container) {
        console.warn('JSON编辑器容器未找到');
        return;
    }
    
    // 创建CodeMirror编辑器
    jsonEditor = CodeMirror(container, {
        mode: 'application/json',
        theme: 'dracula',
        lineNumbers: false,
        foldGutter: false,
        gutters: ['CodeMirror-lint-markers'],
        lint: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: true,
        styleActiveLine: false,
        viewportMargin: Infinity,
        height: 'auto',
        minHeight: '60px',
        maxHeight: '200px'
    });
    
    // 监听变化，更新隐藏的textarea和错误显示
    jsonEditor.on('change', (editor) => {
        const value = editor.getValue();
        editCustomParamInput.value = value;
        
        // 验证JSON并显示错误
        const errorElement = document.getElementById('json-error');
        if (value.trim() === '') {
            errorElement.style.display = 'none';
            return;
        }
        
        try {
            JSON.parse(value);
            errorElement.style.display = 'none';
        } catch (error) {
            errorElement.textContent = `JSON解析错误：${error.message}`;
            errorElement.style.display = 'block';
        }
    });
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
let apiKeyStatusSpan;
let clearApiKeyBtn;
let isApiKeyCleared = false;

// 当前模型列表数据
let currentModels = [];
let draggingItem = null;

// JSON编辑器实例
let jsonEditor = null;

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
    apiKeyStatusSpan = document.getElementById('api-key-status');
    clearApiKeyBtn = document.getElementById('clear-api-key-btn');
    
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
    clearApiKeyBtn.addEventListener('click', clearApiKey);
    editApiKeyInput.addEventListener('input', handleApiKeyInput);
    
    // 初始化JSON编辑器
    initJsonEditor();
    
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
    isApiKeyCleared = false;
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
    const isBuiltin = model && (model.is_builtin || READONLY_PRESETS.includes(model.id));
    editDisplayNameInput.disabled = isBuiltin;
    editModelNameInput.disabled = isBuiltin;
    editApiEndpointInput.disabled = isBuiltin;
    // 自定义参数和API密钥字段保持可编辑
    editCustomParamInput.disabled = false;
    editApiKeyInput.disabled = false;
    
    // 更新API密钥状态显示
    updateApiKeyStatus(model);
    
    // 更新JSON编辑器
    if (jsonEditor) {
        const value = editCustomParamInput.value;
        jsonEditor.setValue(value);
        
        // 清除错误显示
        const errorElement = document.getElementById('json-error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
    
    editModal.style.display = 'flex';
}

/**
 * 更新API密钥状态显示
 */
function updateApiKeyStatus(model = null) {
    const hasKey = model && model.api_key && model.api_key.trim() !== '';
    if (apiKeyStatusSpan) {
        apiKeyStatusSpan.textContent = hasKey ? '（已设置）' : '（未设置）';
        apiKeyStatusSpan.style.color = hasKey ? '#188038' : '#5f6368';
        apiKeyStatusSpan.style.fontWeight = hasKey ? '500' : 'normal';
        apiKeyStatusSpan.style.marginLeft = '4px';
    }
    if (clearApiKeyBtn) {
        clearApiKeyBtn.style.display = hasKey ? 'inline-block' : 'none';
    }
}

/**
 * 清除API密钥
 */
function clearApiKey() {
    editApiKeyInput.value = '';
    isApiKeyCleared = true;
    updateApiKeyStatus(); // 这将把状态更新为未设置并隐藏清除按钮
}

/**
 * 处理API密钥输入变化
 */
function handleApiKeyInput() {
    const hasValue = editApiKeyInput.value.trim() !== '';
    if (hasValue) {
        isApiKeyCleared = false;
    }
    if (apiKeyStatusSpan) {
        apiKeyStatusSpan.textContent = hasValue ? '（已输入）' : '（未设置）';
        apiKeyStatusSpan.style.color = hasValue ? '#188038' : '#5f6368';
        apiKeyStatusSpan.style.fontWeight = hasValue ? '500' : 'normal';
    }
    if (clearApiKeyBtn) {
        clearApiKeyBtn.style.display = hasValue ? 'inline-block' : 'none';
    }
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
        const isBuiltin = model.is_builtin || READONLY_PRESETS.includes(model.id);
        li.draggable = !isBuiltin; // 内置预设不可拖拽
        if (isBuiltin) {
            li.classList.add('builtin-model');
        }
        
        // 模型名称
        const nameSpan = document.createElement('span');
        nameSpan.className = 'model-name';
        nameSpan.textContent = model.name;
        if (isBuiltin) {
            nameSpan.classList.add('builtin-name');
        }
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
        
        // 内置预设不显示删除按钮
        if (!isBuiltin) {
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
    
    // 如果提供了新密钥，则包含它；如果用户点击了清除按钮，则包含空字符串以清除密钥
    if (apiKey) {
        modelData.api_key = apiKey;
    } else if (isApiKeyCleared) {
        modelData.api_key = '';
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
        
        // 如果是内置模型，阻止拖拽
        if (li.classList.contains('builtin-model')) {
            e.preventDefault();
            return;
        }
        
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
    // 获取所有非拖拽中的元素
    const allElements = [...container.querySelectorAll('li:not(.dragging)')];
    
    // 如果没有可放置的元素，返回 null
    if (allElements.length === 0) {
        return null;
    }
    
    let closestBefore = { offset: Number.NEGATIVE_INFINITY, element: null };
    let closestAfter = { offset: Number.POSITIVE_INFINITY, element: null };
    
    for (const child of allElements) {
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
        // 如果目标元素是内置模型，不允许插入到它之前
        // 找到第一个非内置模型元素作为插入点
        let targetElement = closestBefore.element;
        while (targetElement && targetElement.classList.contains('builtin-model')) {
            targetElement = targetElement.nextElementSibling;
        }
        return targetElement;
    }
    
    // 如果没有上半部分的元素，则选择下半部分的元素
    if (closestAfter.element) {
        // 如果目标元素是内置模型，不允许插入到它之后（因为会插入到内置模型之间）
        // 找到下一个非内置模型元素作为插入点
        let targetElement = closestAfter.element;
        if (targetElement.classList.contains('builtin-model')) {
            // 如果是内置模型，找到它之后的下一个非内置模型
            targetElement = targetElement.nextElementSibling;
            while (targetElement && targetElement.classList.contains('builtin-model')) {
                targetElement = targetElement.nextElementSibling;
            }
        }
        
        if (targetElement) {
            return targetElement;
        } else {
            // 如果没有找到非内置模型元素，则插入到末尾
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