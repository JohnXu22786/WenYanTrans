// -------------------------------------
// 全局状态管理
// -------------------------------------

const state = {
    // 运行状态
    segmentQueue: [],
    totalSegments: 0,
    segmentsCompleted: 0,
    activeWorkers: 0,
    resultsMap: new Map(),
    apiConnectedState: false,
    retryMap: new Map(),
    failedSegments: [],

    // 预览模式状态
    isPreviewMode: true,
    segmentsToRemove: new Set(),
    previewSegments: [],
    originalTextForPreview: '',

    // 保存实际分析的段落映射关系
    analysisSegments: [],  // 存储 {index: 原始索引, segment: 文本}

    // 当前显示的markdown内容
    currentMarkdownContent: ''
};

export default state;