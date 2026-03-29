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

# Platform-specific data directory for storing configuration with API keys
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

# Load configuration with support for system config directory (for API keys)
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')
KEY_CONFIG_PATH = os.path.join(get_data_dir(), 'config.json')

# Built-in presets that cannot be reordered and should appear at the top
# This will be populated dynamically from base config
BUILTIN_PRESETS = []

def load_config():
    """Load configuration with merging: base config from project root and overlay from system directory."""
    global config_data  # Update the global config_data variable
    
    # Load base configuration from project root
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            base_config = json.load(f)
    except FileNotFoundError:
        logger.error(f"Base configuration file {CONFIG_PATH} not found")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in base config file: {e}")
        raise
    
    # Load overlay configuration from system directory if exists
    if os.path.exists(KEY_CONFIG_PATH):
        try:
            with open(KEY_CONFIG_PATH, 'r', encoding='utf-8') as f:
                overlay_config = json.load(f)
            logger.info(f"Overlay configuration loaded from: {KEY_CONFIG_PATH}")
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to load overlay config, using base config only: {e}")
            overlay_config = None
    else:
        overlay_config = None
    
    # Start with overlay config if exists, otherwise use base config
    if overlay_config is not None:
        raw_data = overlay_config
    else:
        raw_data = base_config
    
    # Ensure config has required structure
    if 'presets' not in raw_data:
        # Old format detected - convert to new format
        logger.info("Old config format detected, converting to multi-preset format")
        raw_data = {
            'active_preset': 'default',
            'presets': {
                'default': {
                    'model_name': raw_data.get('model_name'),
                    'api_endpoint': raw_data.get('api_endpoint'),
                    'custom_param': raw_data.get('custom_param', {})
                }
            }
        }
        # Validate that required fields exist in the converted config
        if not raw_data['presets']['default']['model_name']:
            raise ValueError("Missing required field in config.json: model_name")
        if not raw_data['presets']['default']['api_endpoint']:
            raise ValueError("Missing required field in config.json: api_endpoint")
    
    # Merge built-in presets from base config
    # Ensure base_config also has presets
    if 'presets' in base_config:
        # Update BUILTIN_PRESETS with all preset IDs from base config
        global BUILTIN_PRESETS
        BUILTIN_PRESETS = list(base_config['presets'].keys())
        logger.info(f"Built-in presets from base config: {BUILTIN_PRESETS}")
        
        for preset_id in BUILTIN_PRESETS:
            base_preset = base_config['presets'][preset_id]
            # Ensure preset exists in raw_data
            if preset_id not in raw_data['presets']:
                raw_data['presets'][preset_id] = base_preset
                logger.info(f"Added missing built-in preset: {preset_id}")
            else:
                # Update fields from base config, but preserve api_key and custom_param from overlay
                overlay_preset = raw_data['presets'][preset_id]
                # Update name, model_name, api_endpoint from base config
                for field in ['name', 'model_name', 'api_endpoint']:
                    if field in base_preset:
                        overlay_preset[field] = base_preset[field]
                # Note: custom_param and api_key are kept from overlay_preset
                # If overlay_preset lacks custom_param, use base_preset's
                if 'custom_param' not in overlay_preset and 'custom_param' in base_preset:
                    overlay_preset['custom_param'] = base_preset['custom_param']
                # api_key is never taken from base config (should not be stored there)
    
    # Log merged built-in preset names for debugging
    for preset_id in BUILTIN_PRESETS:
        if preset_id in raw_data['presets']:
            name = raw_data['presets'][preset_id].get('name', '')
            logger.info(f"Built-in preset '{preset_id}' name: '{name}'")
    
    # Validate new config structure
    if 'active_preset' not in raw_data:
        raise ValueError("Missing required field in config.json: active_preset")
    if 'presets' not in raw_data:
        raise ValueError("Missing required field in config.json: presets")

    active_preset = raw_data['active_preset']
    if active_preset not in raw_data['presets']:
        raise ValueError(f"Active preset '{active_preset}' not found in presets")

    preset_config = raw_data['presets'][active_preset]

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
        '_raw_config': raw_data,  # Keep full config for reference
        '_active_preset': active_preset
    }
    
    # Update global config_data reference
    config_data = raw_data
    
    logger.info(f"Configuration loaded successfully (preset: {active_preset})")
    return config

def save_config(config_data):
    """Save configuration to system config directory (AppData/Roaming)"""
    os.makedirs(os.path.dirname(KEY_CONFIG_PATH), exist_ok=True)
    with open(KEY_CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=2, ensure_ascii=False)
    logger.info(f"Configuration saved to: {KEY_CONFIG_PATH}")

# Load configuration
config = load_config()
config_data = config['_raw_config']  # Full config data


def get_api_key(preset_id):
    """Get API key for a preset, first from config, then from legacy api_keys.json"""
    # First try to get API key from config
    if preset_id in config_data.get('presets', {}):
        preset = config_data['presets'][preset_id]
        if 'api_key' in preset and preset['api_key'].strip():
            return preset['api_key']
    
    # Fallback to legacy api_keys.json
    data_dir = get_data_dir()
    api_keys_file = os.path.join(data_dir, 'api_keys.json')
    
    if os.path.exists(api_keys_file):
        try:
            with open(api_keys_file, 'r', encoding='utf-8') as f:
                api_keys = json.load(f)
            if preset_id in api_keys:
                return api_keys[preset_id]
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Failed to load API keys from {api_keys_file}: {e}")
    
    # No API key found
    logger.warning(f"No API key found for preset '{preset_id}'")
    return None

# Legacy API_KEYS dictionary for backward compatibility (deprecated)
API_KEYS = {}

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

# Built-in presets that cannot be reordered and should appear at the top

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
        if requested_preset and requested_preset in config_data['presets']:
            active_preset = requested_preset
        else:
            active_preset = config_data.get('active_preset', 'default')
            if requested_preset:
                logger.warning(f"Requested preset '{requested_preset}' not found, using default '{active_preset}'")
        
        # Get preset configuration
        if active_preset not in config_data['presets']:
            return jsonify({"error": f"Preset '{active_preset}' not found in configuration"}), 400
        
        preset_config = config_data['presets'][active_preset]
        
        # Check API key for selected preset
        api_key = get_api_key(active_preset)
        if not api_key:
            return jsonify({"error": f"API key for preset '{active_preset}' not found. Please add it via the model management interface."}), 500

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


@app.route('/api/presets', methods=['GET'])
def get_presets():
    """返回可用的模型预设列表"""
    try:
        # 重新加载配置以确保获取最新的name字段
        global config_data
        config = load_config()
        config_data = config['_raw_config']
        
        presets = config_data['presets']
        active_preset = config_data.get('active_preset', 'default')
        
        # 分离内置预设和用户预设
        builtin_presets = []
        user_presets = []
        
        for preset_id, preset_config in presets.items():
            preset_info = {
                'id': preset_id,
                'name': preset_config.get('name', preset_id),
                'model_name': preset_config.get('model_name', ''),
                'api_endpoint': preset_config.get('api_endpoint', ''),
                'is_active': preset_id == active_preset,
                'is_builtin': preset_id in BUILTIN_PRESETS
            }
            if preset_id in BUILTIN_PRESETS:
                builtin_presets.append(preset_info)
            else:
                user_presets.append(preset_info)
        
        # 按照BUILTIN_PRESETS的顺序对内置预设排序
        builtin_presets.sort(key=lambda x: BUILTIN_PRESETS.index(x['id']) if x['id'] in BUILTIN_PRESETS else len(BUILTIN_PRESETS))
        
        # 用户预设保持原有顺序（字典插入顺序）
        preset_list = builtin_presets + user_presets
        
        return jsonify({
            'success': True,
            'presets': preset_list,
            'active_preset': active_preset
        })
    except Exception as e:
        logger.error(f"Failed to get presets: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/presets', methods=['POST'])
def create_preset():
    """创建新模型预设"""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'Invalid request data'}), 400
        
        preset_id = data.get('id')
        if not preset_id:
            return jsonify({'success': False, 'error': 'Preset ID is required'}), 400
        
        if preset_id in config_data['presets']:
            return jsonify({'success': False, 'error': f'Preset "{preset_id}" already exists'}), 400
        
        # Validate required fields
        required_fields = ['model_name', 'api_endpoint']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
        
        # Create new preset
        config_data['presets'][preset_id] = {
            'name': data.get('name', preset_id),  # 显示名称，默认为ID
            'model_name': data['model_name'],
            'api_endpoint': data['api_endpoint'],
            'custom_param': data.get('custom_param', {}),
            'api_key': data.get('api_key', '')
        }
        
        # Save configuration
        save_config(config_data)
        
        # Update global config reference
        global config
        config = load_config()
        
        return jsonify({'success': True, 'message': f'Preset "{preset_id}" created successfully'})
    except Exception as e:
        logger.error(f"Failed to create preset: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/presets/<preset_id>', methods=['PUT'])
def update_preset(preset_id):
    """更新现有模型预设"""
    try:
        global config
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'Invalid request data'}), 400
        
        if preset_id not in config_data['presets']:
            return jsonify({'success': False, 'error': f'Preset "{preset_id}" not found'}), 404
        
        # 检查是否为只读预设（所有从base config加载的预设）
        if preset_id in BUILTIN_PRESETS:
            # 只读预设只允许更新api_key和custom_param字段
            preset = config_data['presets'][preset_id]
            updated = False
            updated_fields = []
            
            if 'api_key' in data:
                preset['api_key'] = data['api_key']
                updated = True
                updated_fields.append('API密钥')
            
            if 'custom_param' in data:
                preset['custom_param'] = data['custom_param']
                updated = True
                updated_fields.append('自定义参数')
            
            if updated:
                # Save configuration
                save_config(config_data)
                # Update global config reference
                config = load_config()
                fields_str = '、'.join(updated_fields)
                return jsonify({'success': True, 'message': f'Preset "{preset_id}" updated ({fields_str})'})
            else:
                # 如果没有提供可更新的字段，则无需更新
                return jsonify({'success': True, 'message': 'No updatable fields provided, preset unchanged'})
        
        # Update preset fields for non-readonly presets
        preset = config_data['presets'][preset_id]
        if 'name' in data:
            preset['name'] = data['name']
        if 'model_name' in data:
            preset['model_name'] = data['model_name']
        if 'api_endpoint' in data:
            preset['api_endpoint'] = data['api_endpoint']
        if 'custom_param' in data:
            preset['custom_param'] = data['custom_param']
        if 'api_key' in data:
            preset['api_key'] = data['api_key']
        
        # Save configuration
        save_config(config_data)
        
        # Update global config reference
        config = load_config()
        
        return jsonify({'success': True, 'message': f'Preset "{preset_id}" updated successfully'})
    except Exception as e:
        logger.error(f"Failed to update preset: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/presets/<preset_id>', methods=['DELETE'])
def delete_preset(preset_id):
    """删除模型预设"""
    try:
        if preset_id not in config_data['presets']:
            return jsonify({'success': False, 'error': f'Preset "{preset_id}" not found'}), 404
        
        # Check if this is the active preset
        if config_data['active_preset'] == preset_id:
            return jsonify({'success': False, 'error': 'Cannot delete the active preset. Please switch to another preset first.'}), 400
        
        # 检查是否为只读预设（所有从base config加载的预设）
        if preset_id in BUILTIN_PRESETS:
            return jsonify({'success': False, 'error': f'预设 "{preset_id}" 是只读的，不可删除'}), 403
        
        # Delete preset
        del config_data['presets'][preset_id]
        
        # Save configuration
        save_config(config_data)
        
        # Update global config reference
        global config
        config = load_config()
        
        return jsonify({'success': True, 'message': f'Preset "{preset_id}" deleted successfully'})
    except Exception as e:
        logger.error(f"Failed to delete preset: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/presets/reorder', methods=['POST'])
def reorder_presets():
    """重新排序模型预设列表"""
    try:
        data = request.json
        if not data or 'order' not in data:
            return jsonify({'success': False, 'error': 'Order list is required'}), 400
        
        order = data['order']
        if not isinstance(order, list):
            return jsonify({'success': False, 'error': 'Order must be a list'}), 400
        
        # Validate all preset IDs exist
        for preset_id in order:
            if preset_id not in config_data['presets']:
                return jsonify({'success': False, 'error': f'Preset "{preset_id}" not found'}), 400
        
        # Validate that built-in presets are in correct position and order
        # Find positions of built-in presets in the order list
        builtin_positions = []
        for i, preset_id in enumerate(order):
            if preset_id in BUILTIN_PRESETS:
                builtin_positions.append((i, preset_id))
        
        # Find positions of user presets in the order list
        user_positions = []
        for i, preset_id in enumerate(order):
            if preset_id not in BUILTIN_PRESETS:
                user_positions.append((i, preset_id))
        
        # Check 1: All built-in presets must come before all user presets
        if builtin_positions and user_positions:
            last_builtin_pos = max(pos for pos, _ in builtin_positions)
            first_user_pos = min(pos for pos, _ in user_positions)
            if last_builtin_pos >= first_user_pos:
                return jsonify({'success': False, 'error': 'Built-in presets cannot be moved after user presets'}), 400
        
        # Check 2: Built-in presets must maintain their relative order as defined in BUILTIN_PRESETS
        builtin_ids_in_order = [pid for _, pid in sorted(builtin_positions)]
        expected_builtin_order = [pid for pid in BUILTIN_PRESETS if pid in config_data['presets']]
        if builtin_ids_in_order != expected_builtin_order:
            return jsonify({'success': False, 'error': 'Built-in presets must maintain their defined order'}), 400
        
        # Filter out built-in presets from the order list
        user_order = [pid for pid in order if pid not in BUILTIN_PRESETS]
        builtin_order = [pid for pid in BUILTIN_PRESETS if pid in config_data['presets']]
        
        # Ensure all user presets are included in the order
        user_preset_ids = [pid for pid in config_data['presets'] if pid not in BUILTIN_PRESETS]
        if set(user_order) != set(user_preset_ids):
            missing = set(user_preset_ids) - set(user_order)
            extra = set(user_order) - set(user_preset_ids)
            if missing:
                return jsonify({'success': False, 'error': f'Missing user presets in order: {missing}'}), 400
            if extra:
                return jsonify({'success': False, 'error': f'Unknown presets in order: {extra}'}), 400
        
        # Reorder presets: built-in presets first (in BUILTIN_PRESETS order), then user presets (in user_order)
        new_presets = {}
        for preset_id in builtin_order:
            new_presets[preset_id] = config_data['presets'][preset_id]
        for preset_id in user_order:
            new_presets[preset_id] = config_data['presets'][preset_id]
        
        # Add any missing presets (should not happen)
        for preset_id, preset in config_data['presets'].items():
            if preset_id not in new_presets:
                new_presets[preset_id] = preset
        
        config_data['presets'] = new_presets
        
        # Save configuration
        save_config(config_data)
        
        # Update global config reference
        global config
        config = load_config()
        
        return jsonify({'success': True, 'message': 'Presets reordered successfully'})
    except Exception as e:
        logger.error(f"Failed to reorder presets: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/presets/<preset_id>', methods=['GET'])
def get_preset(preset_id):
    """获取单个模型预设的详细信息"""
    try:
        if preset_id not in config_data['presets']:
            return jsonify({'success': False, 'error': f'Preset "{preset_id}" not found'}), 404
        
        preset = config_data['presets'][preset_id].copy()
        # Include preset ID in response
        preset['id'] = preset_id
        
        return jsonify({'success': True, 'preset': preset})
    except Exception as e:
        logger.error(f"Failed to get preset: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


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
