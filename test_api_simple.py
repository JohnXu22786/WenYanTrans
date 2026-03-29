#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')
from app import app
import json
import io

# Create test client
with app.test_client() as client:
    # Test /api/presets endpoint
    response = client.get('/api/presets')
    data = json.loads(response.data)
    
    if data['success']:
        print("API Response successful")
        print(f"Active preset: {data['active_preset']}")
        print(f"Total presets: {len(data['presets'])}")
        print("\nPresets (ID, Built-in, Active):")
        for preset in data['presets']:
            # Use repr to see raw string including Unicode
            name_repr = repr(preset['name'])
            print(f"  {preset['id']}: builtin={preset.get('is_builtin', False)}, active={preset.get('is_active', False)}, name={name_repr}")
    else:
        print(f"API Error: {data.get('error', 'Unknown error')}")