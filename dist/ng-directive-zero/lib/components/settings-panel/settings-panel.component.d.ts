import { EventEmitter } from '@angular/core';
import { AgentationSettings, MarkerColor, OutputDetail } from '../../models/component-node.interface';
import { McpService, McpStatus } from '../../services/mcp.service';
import { Observable } from 'rxjs';
import * as i0 from "@angular/core";
/**
 * SettingsPanelComponent
 *
 * 設定面板：顏色選擇、輸出詳細程度、選項開關等
 */
export declare class SettingsPanelComponent {
    private mcpService;
    /** 當前設定 */
    settings: AgentationSettings;
    /** 綁定 dark mode class 到 host */
    get isDarkMode(): boolean;
    /** 面板關閉時觸發 */
    closed: EventEmitter<void>;
    /** 設定變更時觸發 */
    settingsChange: EventEmitter<AgentationSettings>;
    mcpStatus$: Observable<McpStatus>;
    constructor(mcpService: McpService);
    connectMcp(): void;
    /** 可用顏色列表 */
    readonly colors: MarkerColor[];
    /** 顏色對應的 HEX 值 */
    readonly colorHex: Record<MarkerColor, string>;
    /** 輸出詳細程度選項 */
    readonly outputOptions: OutputDetail[];
    /** 選擇顏色 */
    selectColor(color: MarkerColor): void;
    /** 選擇輸出詳細程度 */
    selectOutputDetail(detail: OutputDetail): void;
    /** 切換 Angular 組件顯示 */
    toggleAngularComponents(): void;
    /** 切換複製後清除 */
    toggleClearOnCopy(): void;
    /** 切換阻止頁面互動 */
    toggleBlockInteractions(): void;
    /** 切換主題（深色/淺色） */
    toggleTheme(): void;
    /** 關閉面板 */
    close(): void;
    /** 更新設定 */
    private updateSettings;
    static ɵfac: i0.ɵɵFactoryDeclaration<SettingsPanelComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<SettingsPanelComponent, "ag-settings-panel", never, { "settings": { "alias": "settings"; "required": false; }; }, { "closed": "closed"; "settingsChange": "settingsChange"; }, never, never, false, never>;
}
