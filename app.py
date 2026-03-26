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
try:
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        config_data = json.load(f)
    logger.info("Configuration loaded successfully")

    # Normalize configuration structure for backward compatibility
    # If config has old flat structure, convert to new multi-preset structure
    if 'presets' not in config_data:
        # Old format detected - convert to new format
        logger.info("Old config format detected, converting to multi-preset format")
        config_data = {
            'active_preset': 'default',
            'presets': {
                'default': {
                    'model_name': config_data.get('model_name'),
                    'api_endpoint': config_data.get('api_endpoint'),
                    'custom_param': config_data.get('custom_param', {})
                }
            }
        }
        # Validate that required fields exist in the converted config
        if not config_data['presets']['default']['model_name']:
            raise ValueError("Missing required field in config.json: model_name")
        if not config_data['presets']['default']['api_endpoint']:
            raise ValueError("Missing required field in config.json: api_endpoint")

    # Validate new config structure
    if 'active_preset' not in config_data:
        raise ValueError("Missing required field in config.json: active_preset")
    if 'presets' not in config_data:
        raise ValueError("Missing required field in config.json: presets")

    active_preset = config_data['active_preset']
    if active_preset not in config_data['presets']:
        raise ValueError(f"Active preset '{active_preset}' not found in presets")

    preset_config = config_data['presets'][active_preset]

    # Validate required fields in selected preset
    required_fields = ['model_name', 'api_endpoint']
    for field in required_fields:
        if field not in preset_config:
            raise ValueError(f"Missing required field in preset '{active_preset}': {field}")

    # Create normalized config object for backward compatibility
    config = {
        'model_name': preset_config['model_name'],
        'api_endpoint': preset_config['api_endpoint'],
        'custom_param': preset_config.get('custom_param', {}),
        '_raw_config': config_data,  # Keep full config for reference
        '_active_preset': active_preset
    }

except FileNotFoundError:
    logger.error(f"Configuration file {CONFIG_PATH} not found")
    raise
except json.JSONDecodeError as e:
    logger.error(f"Invalid JSON in config.json: {e}")
    raise
except ValueError as e:
    logger.error(str(e))
    raise

# API key management - read from system data folder
def get_data_dir():
    """Get platform-specific data directory for WenYanTrans"""
    home = os.path.expanduser("~")

    # Platform-specific data directories
    if os.name == 'nt':  # Windows
        data_dir = os.path.join(os.environ.get('APPDATA', home), 'WenYanTrans')
    elif os.name == 'posix':  # Linux/macOS
        data_dir = os.path.join(home, '.wenyantrans')
    else:
        data_dir = os.path.join(home, '.wenyantrans')

    # Create directory if it doesn't exist
    os.makedirs(data_dir, exist_ok=True)
    return data_dir

def load_api_keys():
    """Load API keys from data directory"""
    data_dir = get_data_dir()
    api_keys_file = os.path.join(data_dir, 'api_keys.json')

    if not os.path.exists(api_keys_file):
        logger.warning(f"API keys file not found: {api_keys_file}")
        logger.warning("Please create the file with your API keys. Example format:")
        logger.warning('{"openrouter_kimi": "your-api-key-here", "openai_gpt4": "sk-...", "anthropic_claude": "sk-ant-..."}')
        return {}

    try:
        with open(api_keys_file, 'r', encoding='utf-8') as f:
            api_keys = json.load(f)
        logger.info(f"API keys loaded from {api_keys_file}")
        return api_keys
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"Failed to load API keys from {api_keys_file}: {e}")
        return {}

# Load API keys
API_KEYS = load_api_keys()

# System prompt (same as original)
SYSTEM_PROMPT = """你必须扮演一位极具耐心的"文言文侦探导师"，目标是用"考试实战法"教会初学者破译文言文长句。针对用户发送的内容，严格按以下顺序执行：

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

        # Determine preset from request or use default
        requested_preset = data.get('preset')
        if requested_preset and requested_preset in config['_raw_config']['presets']:
            active_preset = requested_preset
        else:
            active_preset = config.get('_active_preset', 'default')
            if requested_preset:
                logger.warning(f"Requested preset '{requested_preset}' not found, using default '{active_preset}'")
        
        # Get preset configuration
        if active_preset not in config['_raw_config']['presets']:
            return jsonify({"error": f"Preset '{active_preset}' not found in configuration"}), 400
        
        preset_config = config['_raw_config']['presets'][active_preset]
        
        # Check API key for selected preset
        api_key = API_KEYS.get(active_preset)
        if not api_key:
            data_dir = get_data_dir()
            api_keys_file = os.path.join(data_dir, 'api_keys.json')
            return jsonify({"error": f"API key for preset '{active_preset}' not found. Please add it to {api_keys_file}"}), 500

        # Prepare request to API endpoint
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/JohnXu22786/WenYanTrans',
            'X-Title': 'WenYanTrans',
        }

        payload = {
            "model": preset_config['model_name'],
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": segment}
            ]
        }

        # Add custom parameters if specified in preset config
        custom_param = preset_config.get('custom_param')
        if custom_param and isinstance(custom_param, dict):
            # Merge all custom parameters into payload (excluding model and messages which are already set)
            for key, value in custom_param.items():
                # Don't override model or messages
                if key not in ['model', 'messages']:
                    payload[key] = value
        # Note: No backward compatibility - config must use custom_param for any additional parameters

        logger.info(f"Analyzing segment (preset: {active_preset}, model: {preset_config['model_name']}), length: {len(segment)} characters")

        # Send request
        response = requests.post(
            preset_config['api_endpoint'],
            headers=headers,
            json=payload,
            timeout=120  # 120 seconds timeout
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


if __name__ == '__main__':
    logger.info(f"Starting Flask Server for WenYanTrans...")
    logger.info(f"Model: {config['model_name']} (Preset: {config.get('_active_preset', 'default')})")
    logger.info(f"API keys loaded: {len(API_KEYS)} preset(s) configured")
    if not API_KEYS:
        data_dir = get_data_dir()
        api_keys_file = os.path.join(data_dir, 'api_keys.json')
        logger.warning(f"No API keys found. Please create {api_keys_file} with your API keys.")
    logger.info("Listening at: http://127.0.0.1:1201")
    logger.info("Please visit: http://localhost:1201")
    app.run(host='127.0.0.1', port=1201, debug=True)
