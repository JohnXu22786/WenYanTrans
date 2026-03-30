// -------------------------------------
// 全局状态管理
// -------------------------------------

const state = {
    // 运行状态
    selectedModelPreset: '', // 当前选定的模型预设ID，从后端API获取
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
    currentMarkdownContent: '',

    // 合并功能扩展（最小化）
    mergedGroups: new Map(),           // Map<groupId, {indices: [], segments: []}>
    rootGroupIds: [],                  // 根组ID列表（显示顺序，包含段落索引和组ID）
    paragraphToGroup: new Map(),       // Map<paragraphIndex, groupId>
    nextGroupId: 100,                  // 下一个组ID（避免与段落索引冲突）

    // 自动建议合并
    autoSuggestCandidates: [], // Array<{ shortGroupId, targetGroupId, direction }>

    // 新增方法
    initializeMergeState() {
        // 初始化合并状态，在showPreview开始时调用
        this.mergedGroups.clear();
        this.rootGroupIds = this.previewSegments.map(seg => seg.index);
        this.paragraphToGroup.clear();
        this.previewSegments.forEach(seg => {
            this.paragraphToGroup.set(seg.index, seg.index);
        });
        this.nextGroupId = 100;
        this.autoSuggestCandidates = [];
    },

    resetMergeState() {
        // 重置合并状态，在重新输入时调用
        this.mergedGroups.clear();
        this.rootGroupIds = [];
        this.paragraphToGroup.clear();
        this.nextGroupId = 100;
        this.autoSuggestCandidates = [];
    }
};

export default state;