#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')
from app import app
import json

# Create test client
with app.test_client() as client:
    # Test /api/presets endpoint
    response = client.get('/api/presets')
    data = json.loads(response.data)
    
    if data['success']:
        print("API Response successful")
        print(f"Active preset: {data['active_preset']}")
        print(f"Total presets: {len(data['presets'])}")
        print("\nPresets:")
        for preset in data['presets']:
            print(f"  ID: {preset['id']}")
            print(f"    Name: {preset['name']}")
            print(f"    Built-in: {preset.get('is_builtin', False)}")
            print(f"    Active: {preset.get('is_active', False)}")
            print()
    else:
        print(f"API Error: {data.get('error', 'Unknown error')}")