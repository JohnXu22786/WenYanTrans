# Custom Parameter JSON Editor Implementation

This document summarizes the implementation of the custom parameter JSON editor in Cherry Studio's desktop version (without the app) for editing assistants.

## 1. Type Definition

**File**: `src/renderer/src/types/index.ts`

The `AssistantSettingCustomParameters` type defines the structure of a custom parameter:

```typescript
export type AssistantSettingCustomParameters = {
  name: string
  value: string | number | boolean | object
  type: 'string' | 'number' | 'boolean' | 'json'
}
```

Custom parameters are included in the `AssistantSettings` type:

```typescript
export type AssistantSettings = {
  // ... other settings
  customParameters?: AssistantSettingCustomParameters[]
  // ... other settings
}
```

## 2. Default Settings

**File**: `src/renderer/src/services/AssistantService.ts`

Default assistant settings include an empty array for custom parameters:

```typescript
export const DEFAULT_ASSISTANT_SETTINGS = {
  // ... other defaults
  customParameters: [],
  // ... other defaults
} as const satisfies AssistantSettings
```

## 3. UI Component: AssistantModelSettings

**File**: `src/renderer/src/pages/settings/AssistantSettings/AssistantModelSettings.tsx`

### State Management

Custom parameters are managed with React state:

```typescript
const [customParameters, setCustomParameters] = useState<AssistantSettingCustomParameters[]>(
  assistant?.settings?.customParameters ?? []
)
const customParametersRef = useRef(customParameters)
```

### Adding a New Parameter

```typescript
const onAddCustomParameter = () => {
  const newParam = { name: '', value: '', type: 'string' as const }
  const newParams = [...customParameters, newParam]
  setCustomParameters(newParams)
  updateAssistantSettings({ customParameters: newParams })
}
```

### Updating a Parameter

```typescript
const onUpdateCustomParameter = (
  index: number,
  field: 'name' | 'value' | 'type',
  value: string | number | boolean | object
) => {
  const newParams = [...customParameters]
  if (field === 'type') {
    let defaultValue: any = ''
    switch (value) {
      case 'number':
        defaultValue = 0
        break
      case 'boolean':
        defaultValue = false
        break
      case 'json':
        defaultValue = ''
        break
      default:
        defaultValue = ''
    }
    newParams[index] = {
      ...newParams[index],
      type: value as any,
      value: defaultValue
    }
  } else {
    newParams[index] = { ...newParams[index], [field]: value }
  }
  setCustomParameters(newParams)
}
```

### Value Input Rendering

The `renderParameterValueInput` function handles different parameter types:

```typescript
const renderParameterValueInput = (param: (typeof customParameters)[0], index: number) => {
  switch (param.type) {
    case 'number':
      return (
        <InputNumber
          style={{ width: '100%' }}
          value={param.value as number}
          onChange={(value) => onUpdateCustomParameter(index, 'value', value || 0)}
          step={0.01}
        />
      )
    case 'boolean':
      return (
        <Select
          value={param.value as boolean}
          onChange={(value) => onUpdateCustomParameter(index, 'value', value)}
          style={{ width: '100%' }}
          options={[
            { label: 'true', value: true },
            { label: 'false', value: false }
          ]}
        />
      )
    case 'json':
      // ... JSON editor case shown in the JSON Editor Rendering section
      return null
    default:
      return (
        <Input
          value={param.value as string}
          onChange={(e) => onUpdateCustomParameter(index, 'value', e.target.value)}
        />
      )
  }
}
```

### Deleting a Parameter

```typescript
const onDeleteCustomParameter = (index: number) => {
  const newParams = customParameters.filter((_, i) => i !== index)
  setCustomParameters(newParams)
  updateAssistantSettings({ customParameters: newParams })
}
```

### Cleanup on Unmount

```typescript
useEffect(() => {
  return () => updateAssistantSettings({ customParameters: customParametersRef.current })
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

### JSON Editor Rendering

The component renders different input controls based on the parameter type. For `json` type, it uses the `CodeEditor` component:

```typescript
case 'json': {
  const jsonValue = typeof param.value === 'string' ? param.value : JSON.stringify(param.value, null, 2)
  let hasJsonError = false
  if (jsonValue.trim()) {
    try {
      JSON.parse(jsonValue)
    } catch {
      hasJsonError = true
    }
  }
  return (
    <>
      <CodeEditor
        value={jsonValue}
        language="json"
        onChange={(value) => onUpdateCustomParameter(index, 'value', value)}
        expanded={false}
        height="auto"
        maxHeight="200px"
        minHeight="60px"
        options={{ lint: true, lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
        style={{
          borderRadius: 6,
          overflow: 'hidden',
          border: `1px solid ${hasJsonError ? 'var(--color-error)' : 'var(--color-border)'}`
        }}
      />
      {hasJsonError && (
        <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 4 }}>
          {t('models.json_parse_error')}
        </div>
      )}
    </>
  )
}
```

### UI Layout

The form renders a row for each custom parameter with name, type selector, value input (or JSON editor), and delete button:

```tsx
<SettingRow style={{ minHeight: 30 }}>
  <Label>{t('models.custom_parameters')}</Label>
  <Button icon={<PlusIcon size={18} />} onClick={onAddCustomParameter}>
    {t('models.add_parameter')}
  </Button>
</SettingRow>
{customParameters.map((param, index) => (
  <div key={index} style={{ marginTop: 10 }}>
    <Row align="stretch" gutter={10}>
      <Col span={6}>
        <Input
          placeholder={t('models.parameter_name')}
          value={param.name}
          onChange={(e) => onUpdateCustomParameter(index, 'name', e.target.value)}
        />
      </Col>
      <Col span={6}>
        <Select
          value={param.type}
          onChange={(value) => onUpdateCustomParameter(index, 'type', value)}
          style={{ width: '100%' }}>
          <Select.Option value="string">{t('models.parameter_type.string')}</Select.Option>
          <Select.Option value="number">{t('models.parameter_type.number')}</Select.Option>
          <Select.Option value="boolean">{t('models.parameter_type.boolean')}</Select.Option>
          <Select.Option value="json">{t('models.parameter_type.json')}</Select.Option>
        </Select>
      </Col>
      {param.type !== 'json' && <Col span={10}>{renderParameterValueInput(param, index)}</Col>}
      <Col span={param.type === 'json' ? 12 : 2} style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          color="danger"
          variant="filled"
          icon={<DeleteIcon size={14} className="lucide-custom" />}
          onClick={() => onDeleteCustomParameter(index)}
        />
      </Col>
    </Row>
    {param.type === 'json' && <div style={{ marginTop: 6 }}>{renderParameterValueInput(param, index)}</div>}
  </div>
))}
```

## 4. CodeEditor Component

**File**: `src/renderer/src/components/CodeEditor/index.tsx`

The `CodeEditor` component is a wrapper around CodeMirror with the following relevant props:

```typescript
export interface CodeEditorProps {
  value: string
  language: string
  onChange?: (newContent: string) => void
  onBlur?: (newContent: string) => void
  height?: string
  maxHeight?: string
  minHeight?: string
  options?: {
    stream?: boolean
    lint?: boolean
    keymap?: boolean
  } & BasicSetupOptions
  expanded?: boolean
  // ... other props
}
```

In the JSON editor usage, the following props are set:
- `language="json"` – sets the editor language to JSON
- `lint: true` – enables JSON linting
- `lineNumbers: false` – hides line numbers
- `foldGutter: false` – disables code folding
- `highlightActiveLine: false` – disables active line highlighting
- `expanded={false}` – uses fixed height mode
- `height="auto"`, `maxHeight="200px"`, `minHeight="60px"` – controls editor dimensions

## 5. Usage in AI Core

### Reasoning Utility

**File**: `src/renderer/src/aiCore/utils/reasoning.ts`

The `getCustomParameters` function extracts and parses custom parameters from assistant settings:

```typescript
export function getCustomParameters(assistant: Assistant): Record<string, any> {
  return (
    assistant?.settings?.customParameters?.reduce((acc, param) => {
      if (!param.name?.trim()) {
        return acc
      }
      // Parse JSON type parameters
      // Related: src/renderer/src/pages/settings/AssistantSettings/AssistantModelSettings.tsx:133-148
      // The UI stores JSON type params as strings (e.g., '{"key":"value"}')
      // This function parses them into objects before sending to the API
      if (param.type === 'json') {
        const value = param.value as string
        if (value === 'undefined') {
          return { ...acc, [param.name]: undefined }
        }
        try {
          return { ...acc, [param.name]: JSON.parse(value) }
        } catch {
          return { ...acc, [param.name]: value }
        }
      }
      return {
        ...acc,
        [param.name]: param.value
      }
    }, {}) || {}
  )
}
```

### Base API Client

**File**: `src/renderer/src/aiCore/legacy/clients/BaseApiClient.ts`

The `getCustomParameters` method in the base API client performs similar parsing:

```typescript
protected getCustomParameters(assistant: Assistant) {
  return (
    assistant?.settings?.customParameters?.reduce((acc, param) => {
      if (!param.name?.trim()) {
        return acc
      }
      // Parse JSON type parameters (Legacy API clients)
      // Related: src/renderer/src/pages/settings/AssistantSettings/AssistantModelSettings.tsx:133-148
      // The UI stores JSON type params as strings, this function parses them before sending to API
      if (param.type === 'json') {
        const value = param.value as string
        if (value === 'undefined') {
          return { ...acc, [param.name]: undefined }
        }
        return { ...acc, [param.name]: isJSON(value) ? parseJSON(value) : value }
      }
      return {
        ...acc,
        [param.name]: param.value
      }
    }, {}) || {}
  )
}
```

## 6. Summary

The custom parameter JSON editor implementation consists of:

1. **Type System**: Well‑defined TypeScript types for custom parameters.
2. **UI Layer**: A React component that allows adding, editing, and deleting parameters with a dedicated JSON editor for `json`‑type parameters.
3. **Editor Component**: A reusable `CodeEditor` component based on CodeMirror that provides syntax highlighting, linting, and configurable options.
4. **Backend Integration**: Utility functions that parse the custom parameters (especially JSON strings) before sending them to the model API.

The JSON editor is configured with linting enabled, a compact height, and visual error feedback when the JSON is invalid. The UI stores JSON parameters as strings, which are parsed into objects at the point of use in the AI core.

**Key Files**:
- `src/renderer/src/types/index.ts` – type definitions
- `src/renderer/src/pages/settings/AssistantSettings/AssistantModelSettings.tsx` – main UI component
- `src/renderer/src/components/CodeEditor/index.tsx` – CodeMirror wrapper
- `src/renderer/src/services/AssistantService.ts` – default settings
- `src/renderer/src/aiCore/utils/reasoning.ts` – parameter parsing for reasoning models
- `src/renderer/src/aiCore/legacy/clients/BaseApiClient.ts` – parameter parsing for legacy API clients