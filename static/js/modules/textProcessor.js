// -------------------------------------
// 文本处理与分析
// -------------------------------------

export function splitText(fullContent) {
    const lines = fullContent.replace(/\r\n/g, '\n').split('\n');
    const segments = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (is_content(line)) {
            segments.push({
                index: segments.length,
                segment: line,
                retryCount: 0
            });
        }
    }

    return segments;
}

export function is_content(line) {
    if (line.length < 2) return false;

    const punct_set = '，。？！；："' + "\'" + '（）【】、';
    const sentence_endings = '。？！';
    const quotes = '“‘’"';

    let has_ending = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (sentence_endings.includes(char)) {
            let left_quotes_count = 0;
            for (let j = 0; j < i; j++) {
                if (quotes.includes(line[j])) {
                    left_quotes_count++;
                }
            }
            if (left_quotes_count % 2 === 0) {
                has_ending = true;
                break;
            }
        }
    }

    let punct_count = 0;
    for (let char of line) {
        if (punct_set.includes(char)) {
            punct_count++;
        }
    }
    const punct_density = punct_count / line.length;

    return has_ending || punct_density > 0.05 || (line.length > 5 && punct_count > 0);
}