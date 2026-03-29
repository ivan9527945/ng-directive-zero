# NgDirectiveZero

[![npm version](https://img.shields.io/npm/v/ng-directive-zero.svg)](https://www.npmjs.com/package/ng-directive-zero)
[![npm downloads](https://img.shields.io/npm/dm/ng-directive-zero.svg)](https://www.npmjs.com/package/ng-directive-zero)

Angular implementation of Agentation for visual DOM inspection and annotation. It provides an overlay-driven marker flow, component metadata extraction, and structured prompt output for page feedback.

## Demo

![ng-directive-zero demo](agentation/demo.gif)

## Features
- Visual overlay to mark components or DOM nodes
- Marker list, intent editing, and clipboard export
- Angular component metadata extraction (inputs/outputs/properties)
- Prompt output detail levels (compact, standard, detailed, forensic)
- Nested element selection via breadcrumb navigation

## Installation
```bash
npm install ng-directive-zero
```

## Quick start
Import the module in your root module and place the agentation component once in your app.

```ts
// app.module.ts
import { NgDirectiveZeroModule } from 'ng-directive-zero';

@NgModule({
  imports: [
    NgDirectiveZeroModule.forRoot(),
  ],
})
export class AppModule {}
```

```html
<!-- app.component.html -->
<ag-directive-zero></ag-directive-zero>
```

## Exported API
### Module
- `NgDirectiveZeroModule`

### Components
- `ag-directive-zero`
- `ag-overlay`
- `ag-toolbar`
- `ag-markers-panel`
- `ag-settings-panel`
- `ag-annotation-panel`
- `ag-inline-editor`

### Services
- `ComponentWalkerService`
- `DataSanitizerService`
- `PromptGeneratorService`
- `McpService`

### Models
- `ComponentNode`, `MarkerAnnotation`, `RecordingSession`
- `AgentationSettings`, `ToolbarState`
- `OutputDetail`, `MarkerColor`, `DEFAULT_SETTINGS`, `MARKER_COLORS`

## Build & test
```bash
ng build ng-directive-zero
ng test
```

## Publishing
```bash
ng build ng-directive-zero
cd dist/ng-directive-zero
npm publish
```

## Compatibility
Peer dependencies:
- `@angular/core` and `@angular/common` >=14 <21

## License
MIT
