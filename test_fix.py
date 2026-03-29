#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')
import json
import os

# Mock minimal app to test load_config
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')
KEY_CONFIG_PATH = os.path.join(os.path.expanduser('~'), '.wenyantrans', 'config.json')

# Read configs to see what's in them
with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
    base = json.load(f)
print("Base config presets:", list(base.get('presets', {}).keys()))

if os.path.exists(KEY_CONFIG_PATH):
    with open(KEY_CONFIG_PATH, 'r', encoding='utf-8') as f:
        overlay = json.load(f)
    print("Overlay config presets:", list(overlay.get('presets', {}).keys()))
else:
    print("No overlay config")

# Now test the actual load_config
import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

# We need to import after setting up logging
from app import config_data, BUILTIN_PRESETS

print("\n=== After load_config ===")
print("BUILTIN_PRESETS:", BUILTIN_PRESETS)
print("All presets in config_data:")
for pid in config_data['presets']:
    preset = config_data['presets'][pid]
    is_builtin = pid in BUILTIN_PRESETS
    print(f"  {pid}: name='{preset.get('name', '')}', builtin={is_builtin}")