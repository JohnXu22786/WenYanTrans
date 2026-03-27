// 模型管理模块
import { fetchPresets } from './config.js';

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
        editModelNameInput.value = model.model_name || model.id;
        editApiEndpointInput.value = model.api_endpoint || '';
        editApiKeyInput.value = ''; // 出于安全考虑，不显示现有密钥
        editCustomParamInput.value = model.custom_param ? JSON.stringify(model.custom_param, null, 2) : '';
    } else {
        // 新建模型
        editModalTitle.textContent = '新建模型配置';
        editModelIdInput.value = '';
        editModelNameInput.value = '';
        editApiEndpointInput.value = '';
        editApiKeyInput.value = '';
        editCustomParamInput.value = '';
    }
    
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
        li.draggable = true;
        
        // 模型名称
        const nameSpan = document.createElement('span');
        nameSpan.className = 'model-name';
        nameSpan.textContent = model.id + (model.is_active ? ' (当前使用)' : '');
        li.appendChild(nameSpan);
        
        // 操作按钮
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'model-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadModelDetail(model.id);
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteModel(model.id);
        });
        
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
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
    const modelName = editModelNameInput.value.trim();
    const apiEndpoint = editApiEndpointInput.value.trim();
    const apiKey = editApiKeyInput.value.trim();
    let customParam = {};
    
    // 验证必填字段
    if (!modelId) {
        alert('请输入模型ID');
        return;
    }
    
    if (!modelName) {
        alert('请输入模型名称');
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
        model_name: modelName,
        api_endpoint: apiEndpoint,
        custom_param: customParam
    };
    
    // 如果提供了新密钥，则包含它
    if (apiKey) {
        modelData.api_key = apiKey;
    }
    
    try {
        let response;
        const isNew = editModelIdInput.value === '';
        
        if (isNew) {
            // 新建模型
            response = await fetch('/api/presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: modelId, ...modelData })
            });
        } else {
            // 更新现有模型
            response = await fetch(`/api/presets/${modelId}`, {
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
    modelList.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'LI') {
            draggingItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });
    
    modelList.addEventListener('dragend', (e) => {
        if (draggingItem) {
            draggingItem.classList.remove('dragging');
            draggingItem = null;
            saveOrderBtn.style.display = 'block'; // 显示保存按钮
        }
    });
    
    modelList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(modelList, e.clientY);
        const draggable = document.querySelector('.dragging');
        
        if (draggable && afterElement) {
            modelList.insertBefore(draggable, afterElement);
        }
    });
}

/**
 * 获取拖拽后的元素位置
 */
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
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