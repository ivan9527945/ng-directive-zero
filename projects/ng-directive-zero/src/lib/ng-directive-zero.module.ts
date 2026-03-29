import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// HttpClientModule is deprecated in Angular 15+ but remains available through Angular 20.
// Kept here for Angular 14 compatibility; Angular 15+ apps may also call
// provideHttpClient() in their own root providers.
import { HttpClientModule } from '@angular/common/http';

// Components
import { OverlayComponent } from './components/overlay/overlay.component';
import { AnnotationPanelComponent } from './components/annotation-panel/annotation-panel.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';
import { MarkersPanelComponent } from './components/markers-panel/markers-panel.component';
import { InlineEditorComponent } from './components/inline-editor/inline-editor.component';
import { AgentationComponent } from './components/agentation/agentation.component';

// Services
import { ComponentWalkerService } from './services/component-walker.service';
import { DataSanitizerService } from './services/data-sanitizer.service';
import { PromptGeneratorService } from './services/prompt-generator.service';
import { McpService } from './services/mcp.service';

/**
 * NgDirectiveZeroModule
 *
 * Angular 版本的 Agentation 工具
 * 提供視覺化 DOM 檢查器、組件樹遍歷、AI 語意化序列化等功能
 *
 * 使用方式：
 * ```typescript
 * @NgModule({
 *   imports: [NgDirectiveZeroModule.forRoot()]
 * })
 * export class AppModule {}
 * ```
 */
@NgModule({
  declarations: [
    OverlayComponent,
    AnnotationPanelComponent,
    ToolbarComponent,
    SettingsPanelComponent,
    MarkersPanelComponent,
    InlineEditorComponent,
    AgentationComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
  ],
  exports: [
    OverlayComponent,
    AnnotationPanelComponent,
    ToolbarComponent,
    SettingsPanelComponent,
    MarkersPanelComponent,
    InlineEditorComponent,
    AgentationComponent,
  ],
})
export class NgDirectiveZeroModule {
  /**
   * 在根模組中使用，提供單例服務
   */
  static forRoot(): ModuleWithProviders<NgDirectiveZeroModule> {
    return {
      ngModule: NgDirectiveZeroModule,
      providers: [
        ComponentWalkerService,
        DataSanitizerService,
        PromptGeneratorService,
        McpService,
      ],
    };
  }
}
