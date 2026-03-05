// -------------------------------------
// 主题管理模块
// -------------------------------------

// 状态
let currentTheme = null; // 'light' 或 'dark'
let lastTrigger = null;  // 'system' 或 'user'

// DOM 元素
let themeToggleBtn = null;

/**
 * 初始化主题系统
 */
export function initTheme() {
    themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (!themeToggleBtn) {
        console.error('主题切换按钮未找到');
        return;
    }

    // 初始检测系统主题
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    currentTheme = systemPrefersDark ? 'dark' : 'light';
    lastTrigger = 'system';
    applyTheme();

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (lastTrigger === 'user') {
            // 如果最后一次触发是用户，系统变化仍然覆盖（最后一个触发器获胜）
            // 更新状态
            currentTheme = e.matches ? 'dark' : 'light';
            lastTrigger = 'system';
            applyTheme();
        } else {
            // 如果最后一次触发是系统，直接更新
            currentTheme = e.matches ? 'dark' : 'light';
            lastTrigger = 'system';
            applyTheme();
        }
    });

    // 绑定按钮点击事件
    themeToggleBtn.addEventListener('click', toggleTheme);
}

/**
 * 切换主题（用户手动触发）
 */
function toggleTheme() {
    // 切换当前主题
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    lastTrigger = 'user';
    applyTheme();
}

/**
 * 应用当前主题到页面
 */
function applyTheme() {
    // 设置 data-theme 属性到 html 元素
    document.documentElement.setAttribute('data-theme', currentTheme);

    // 更新按钮的 aria-label
    const label = currentTheme === 'dark' ? '切换到浅色模式' : '切换到深色模式';
    themeToggleBtn.setAttribute('aria-label', label);

    // 可以在这里添加其他 UI 更新，比如按钮图标变化等
    // 目前使用月亮图标不变
}

/**
 * 获取当前主题
 */
export function getCurrentTheme() {
    return currentTheme;
}

/**
 * 获取最后触发源
 */
export function getLastTrigger() {
    return lastTrigger;
}