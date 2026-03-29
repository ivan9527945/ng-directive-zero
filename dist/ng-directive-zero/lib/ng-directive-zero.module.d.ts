import { ModuleWithProviders } from '@angular/core';
import * as i0 from "@angular/core";
import * as i1 from "./components/overlay/overlay.component";
import * as i2 from "./components/annotation-panel/annotation-panel.component";
import * as i3 from "./components/toolbar/toolbar.component";
import * as i4 from "./components/settings-panel/settings-panel.component";
import * as i5 from "./components/markers-panel/markers-panel.component";
import * as i6 from "./components/inline-editor/inline-editor.component";
import * as i7 from "./components/agentation/agentation.component";
import * as i8 from "@angular/common";
import * as i9 from "@angular/forms";
import * as i10 from "@angular/common/http";
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
export declare class NgDirectiveZeroModule {
    /**
     * 在根模組中使用，提供單例服務
     */
    static forRoot(): ModuleWithProviders<NgDirectiveZeroModule>;
    static ɵfac: i0.ɵɵFactoryDeclaration<NgDirectiveZeroModule, never>;
    static ɵmod: i0.ɵɵNgModuleDeclaration<NgDirectiveZeroModule, [typeof i1.OverlayComponent, typeof i2.AnnotationPanelComponent, typeof i3.ToolbarComponent, typeof i4.SettingsPanelComponent, typeof i5.MarkersPanelComponent, typeof i6.InlineEditorComponent, typeof i7.AgentationComponent], [typeof i8.CommonModule, typeof i9.FormsModule, typeof i10.HttpClientModule], [typeof i1.OverlayComponent, typeof i2.AnnotationPanelComponent, typeof i3.ToolbarComponent, typeof i4.SettingsPanelComponent, typeof i5.MarkersPanelComponent, typeof i6.InlineEditorComponent, typeof i7.AgentationComponent]>;
    static ɵinj: i0.ɵɵInjectorDeclaration<NgDirectiveZeroModule>;
}
