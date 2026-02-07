#!/usr/bin/env python3
"""
文言文分析工具 - Flask后端服务器
A web-based classical Chinese analysis tool using OpenRouter API
"""

import os
import json
import logging
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import requests

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load configuration
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')

# Default configuration
config = {
    "model_name": "moonshotai/kimi-k2-thinking",
    "api_endpoint": "https://openrouter.ai/api/v1/chat/completions"
}

try:
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        file_config = json.load(f)

    # Update config with values from file, but exclude openrouter_api_key
    for key, value in file_config.items():
        if key != "openrouter_api_key":
            config[key] = value

    logger.info("Configuration loaded successfully")

    # Warn if openrouter_api_key is present in config file
    if "openrouter_api_key" in file_config:
        logger.warning("openrouter_api_key found in config.json - this value will be ignored. Please use environment variable instead.")

except FileNotFoundError:
    logger.error(f"Configuration file {CONFIG_PATH} not found, using defaults")

# API key from environment variable (do not store in config.json)
ENV_API_KEY = "wenyantrans_openrouter_apikey"
openrouter_api_key = os.environ.get(ENV_API_KEY, "").strip()
if not openrouter_api_key:
    logger.warning(f"Environment variable {ENV_API_KEY} is not set or empty")
else:
    logger.info("API key loaded from environment variable")

# System prompt (same as original)
SYSTEM_PROMPT = """你必须扮演一位极具耐心的"文言文侦探导师"，目标是用"考试实战法"教会初学者破译文言文长句。针对用户发送的每一段内容，严格按以下顺序执行：

1. **锚定已知&核心事件锁定：**
别慌，先看懂多少算多少：
- 认识的实词：儒者、言、善、未尝、求、庄子、意、好、固、知、读、书、先王、泽、竭、天下、俗、质朴、散、学士大夫、责己、弃绝、礼义、利害、趋利、辱、殒身、怨、不可救、病、矫、弊、归、正、心、虑、仁义礼乐、是非、彼此、利害、心、得。
- 至少能抓到的骨架：这段话在说——儒家的话和庄子自己都搞不懂庄子真意→庄子时代世风日下→人们抛弃礼义追逐利害→庄子很担忧→想用特殊方法纠正世道→这个方法就是搞混是非、彼此、利害，让心自己满足。
核心事件锁定：庄子看到礼义崩溃、人人逐利的乱世，想用自己的学说（齐同万物）来纠正弊端。

2. **上下文逻辑链式猜测**：**只针对真正卡住的疑难词**，必须展示"因为事件发展到这步，所以这个词最可能是在扮演...角色"的完整推理链条。**推理要穷尽所有可能性**，严禁跳跃。当推理卡死时，使用**辅助工具箱**：
- **偏旁溯源**："这个字是扌旁，核心事件里有激烈动作，所以很可能是砸而不是看"
- **通假字推测**：**必须明确说出通哪一个字**（如'蚤'通'早'，在核心事件时间线上，应该是'早点'的意思"），**仅当确有通假关系时才可使用**
- **对文互训**："上下文有'往'和'来'形成对文，所以这里该填反义词"
同时要提醒：**那些你认识的字词，关键是理清它们之间的主谓宾和因果转折关系**，而不是再解释一遍。在理解上下文逻辑以后再进行疑难词推断。对于人名、地名、书名等专有名词无需解释，直接翻译。

3. **工具应用**：对有点难度但没有很难的词，**直接给简短的词典义**，不展开任何推理。

4. **语法聚焦**：锁定虚词和特殊句式，简洁地剖析其语法功能及翻译处理方法

5. **综合翻译**：输出最终精准的现代汉语译文

**核心原则**：第2步是"精准狙击"而非"地毯式轰炸"，70%精力用于疏通长句逻辑，30%用于攻克真难点。必须让初学者看见"如何从懂字词到懂句子"的破案路径。"""

@app.route('/')
def index():
    """Render main page"""
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze_segment():
    """Analyze single classical Chinese segment"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Invalid request data"}), 400

        segment = data.get('segment', '').strip()
        if not segment:
            return jsonify({"error": "Segment content cannot be empty"}), 400

        # Check API key
        api_key = openrouter_api_key
        if not api_key:
            return jsonify({"error": f"API key not configured. Please set environment variable {ENV_API_KEY} and restart the application."}), 500

        # Prepare request to OpenRouter API
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://wenyantrans.app',
            'X-Title': 'WenYanTrans',
        }

        payload = {
            "model": config['model_name'],
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": segment}
            ]
        }

        # Add provider if configured (and not false/null)
        if 'provider' in config and config['provider']:
            payload['provider'] = config['provider']

        logger.info(f"Analyzing segment, length: {len(segment)} characters")

        # Send request
        response = requests.post(
            config['api_endpoint'],
            headers=headers,
            json=payload,
            timeout=60  # 60 seconds timeout
        )

        # Process response
        if response.status_code == 200:
            result = response.json()
            if 'choices' in result and len(result['choices']) > 0:
                analysis_result = result['choices'][0]['message']['content']
                return jsonify({
                    "success": True,
                    "result": analysis_result,
                    "original": segment
                })
            else:
                logger.error(f"API response format异常: {result}")
                return jsonify({"error": "API response format异常"}), 500
        else:
            error_msg = f"API request failed: {response.status_code} {response.text}"
            logger.error(error_msg)
            return jsonify({"error": f"API request failed ({response.status_code})"}), response.status_code

    except requests.exceptions.Timeout:
        logger.error("API request timeout")
        return jsonify({"error": "Request timeout, please try again"}), 504
    except requests.exceptions.RequestException as e:
        logger.error(f"Network request exception: {str(e)}")
        return jsonify({"error": f"Network request exception: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Server internal error: {str(e)}")
        return jsonify({"error": f"Server internal error: {str(e)}"}), 500

@app.route('/health')
def health_check():
    """Health check endpoint"""
    api_key = openrouter_api_key
    if not api_key:
        return jsonify({"status": "error", "message": f"API key not configured. Please set environment variable {ENV_API_KEY} and restart the application."}), 500

    # Simple API connection test
    try:
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }

        # Send a minimal test request
        test_payload = {
            "model": config['model_name'],
            "messages": [{"role": "user", "content": "test"}],
            "max_tokens": 5
        }

        # Add provider if configured (and not false/null)
        if 'provider' in config and config['provider']:
            test_payload['provider'] = config['provider']

        response = requests.post(
            config['api_endpoint'],
            headers=headers,
            json=test_payload,
            timeout=10
        )

        if response.status_code in [200, 401, 429]:  # 200 success, 401 key error, 429 rate limit
            return jsonify({
                "status": "connected",
                "model": config['model_name'],
                "api_status": response.status_code
            }), 200 if response.status_code == 200 else 200
        else:
            return jsonify({
                "status": "error",
                "message": f"API response异常: {response.status_code}"
            }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Connection test failed: {str(e)}"
        }), 200


if __name__ == '__main__':
    logger.info(f"Starting Flask Server for WenYanTrans...")
    logger.info(f"Model: {config['model_name']}")
    if openrouter_api_key:
        logger.info("API key: Loaded from environment variable")
    else:
        logger.warning(f"API key: Not configured. Please set environment variable {ENV_API_KEY}")
    logger.info("Listening at: http://127.0.0.1:1201")
    logger.info("Please visit: http://localhost:1201")
    app.run(host='127.0.0.1', port=1201, debug=True)