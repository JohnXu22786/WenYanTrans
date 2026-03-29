#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')
import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

from app import load_config
config = load_config()
print("Config loaded")
print("Active preset:", config['_active_preset'])
print("Presets:")
for pid, preset in config['_raw_config']['presets'].items():
    print(f"  {pid}: name={preset.get('name', '')}")