// -------------------------------------
// 文件处理功能
// -------------------------------------

import { els } from './config.js';
import { handleTextInput } from './uiRenderer.js';

export function handleFile(file) {
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

export function handleDrop(e) {
    e.preventDefault();
    els.inputArea.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
}

export function handleDragOver(e) {
    e.preventDefault();
    els.inputArea.classList.add('drag-over');
}

export function handleDragLeave() {
    els.inputArea.classList.remove('drag-over');
}

// function handleInputAreaClick(e) {
//     if (e.target === els.inputArea) els.fileInput.click();
// }

export function handleFileInputChange(e) {
    if (e.target.files[0]) handleFile(e.target.files[0]);
}

export function handleUploadClick() {
    els.fileInput.click();
}

export async function handlePasteClick() {
    try {
        const text = await navigator.clipboard.readText();
        els.textInput.value = text;
        handleTextInput();
    } catch (err) {
        console.error('粘贴失败:', err);
        alert('无法访问剪贴板，请确保已授予权限或手动粘贴');
    }
}