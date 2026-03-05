// -------------------------------------
// 文本处理与分析
// -------------------------------------

export function splitText(fullContent) {
    const lines = fullContent.replace(/\r\n/g, '\n').split('\n');
    const segments = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        segments.push({
            index: segments.length,
            segment: line,
            retryCount: 0
        });
    }

    return segments;
}

