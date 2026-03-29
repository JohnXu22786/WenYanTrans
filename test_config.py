#!/usr/bin/env python3
"""
Test configuration loading.
"""
import sys
sys.path.insert(0, '.')

import json
import os

# Mock the required global variables
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')
KEY_CONFIG_PATH = os.path.join(os.path.expanduser('~'), '.wenyantrans', 'config.json')
BUILTIN_PRESETS = ['deepseek', 'openrouter_kimi']

# Copy the load_config function from app.py (simplified)
def load_config():
    """Load configuration with merging: base config from project root and overlay from system directory."""
    # Load base configuration from project root
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        base_config = json.load(f)
    
    # Load overlay configuration from system directory if exists
    if os.path.exists(KEY_CONFIG_PATH):
        with open(KEY_CONFIG_PATH, 'r', encoding='utf-8') as f:
            overlay_config = json.load(f)
        print(f"Overlay config loaded from {KEY_CONFIG_PATH}")
        raw_data = overlay_config
    else:
        print("No overlay config, using base config")
        raw_data = base_config
    
    # Ensure config has required structure
    if 'presets' not in raw_data:
        # Old format conversion omitted for brevity
        pass
    
    # Merge built-in presets from base config
    if 'presets' in base_config:
        for preset_id in BUILTIN_PRESETS:
            if preset_id in base_config['presets']:
                base_preset = base_config['presets'][preset_id]
                if preset_id not in raw_data['presets']:
                    raw_data['presets'][preset_id] = base_preset
                    print(f"Added missing built-in preset: {preset_id}")
                else:
                    overlay_preset = raw_data['presets'][preset_id]
                    for field in ['name', 'model_name', 'api_endpoint']:
                        if field in base_preset:
                            overlay_preset[field] = base_preset[field]
                    if 'custom_param' not in overlay_preset and 'custom_param' in base_preset:
                        overlay_preset['custom_param'] = base_preset['custom_param']
    
    return raw_data

if __name__ == '__main__':
    config = load_config()
    print("\nPresets:")
    for pid, preset in config['presets'].items():
        print(f"  {pid}: name='{preset.get('name', 'N/A')}', model='{preset.get('model_name', 'N/A')}'")
    print(f"\nActive preset: {config.get('active_preset', 'N/A')}")