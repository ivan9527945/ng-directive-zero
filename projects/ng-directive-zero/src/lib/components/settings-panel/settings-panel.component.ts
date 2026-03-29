import { Component, EventEmitter, Input, Output, HostBinding } from '@angular/core';
import {
    AgentationSettings,
    DEFAULT_SETTINGS,
    MarkerColor,
    MARKER_COLORS,
    OutputDetail,
} from '../../models/component-node.interface';
import { McpService, McpStatus } from '../../services/mcp.service';
import { Observable } from 'rxjs';

/**
 * SettingsPanelComponent
 *
 * 設定面板：顏色選擇、輸出詳細程度、選項開關等
 */
@Component({
    selector: 'ag-settings-panel',
    standalone: false,
    templateUrl: './settings-panel.component.html',
    styleUrls: ['./settings-panel.component.scss'],
})
export class SettingsPanelComponent {
    /** 當前設定 */
    @Input() settings: AgentationSettings = DEFAULT_SETTINGS;

    /** 綁定 dark mode class 到 host */
    @HostBinding('class.ag-dark-mode')
    get isDarkMode(): boolean {
        return this.settings.isDarkMode;
    }

    /** 面板關閉時觸發 */
    @Output() closed = new EventEmitter<void>();

    /** 設定變更時觸發 */
    @Output() settingsChange = new EventEmitter<AgentationSettings>();

    mcpStatus$: Observable<McpStatus>;

    constructor(private mcpService: McpService) {
        this.mcpStatus$ = this.mcpService.status$;
    }

    connectMcp() {
        this.mcpService.connect();
    }

    /** 可用顏色列表 */
    readonly colors: MarkerColor[] = ['purple', 'blue', 'cyan', 'green', 'yellow', 'orange', 'red'];

    /** 顏色對應的 HEX 值 */
    readonly colorHex = MARKER_COLORS;

    /** 輸出詳細程度選項 */
    readonly outputOptions: OutputDetail[] = ['compact', 'standard', 'detailed', 'forensic'];

    /** 選擇顏色 */
    selectColor(color: MarkerColor): void {
        this.updateSettings({ markerColor: color });
    }

    /** 選擇輸出詳細程度 */
    selectOutputDetail(detail: OutputDetail): void {
        this.updateSettings({ outputDetail: detail });
    }

    /** 切換 Angular 組件顯示 */
    toggleAngularComponents(): void {
        this.updateSettings({ showAngularComponents: !this.settings.showAngularComponents });
    }

    /** 切換複製後清除 */
    toggleClearOnCopy(): void {
        this.updateSettings({ clearOnCopy: !this.settings.clearOnCopy });
    }

    /** 切換阻止頁面互動 */
    toggleBlockInteractions(): void {
        this.updateSettings({ blockPageInteractions: !this.settings.blockPageInteractions });
    }

    /** 切換主題（深色/淺色） */
    toggleTheme(): void {
        this.updateSettings({ isDarkMode: !this.settings.isDarkMode });
    }

    /** 關閉面板 */
    close(): void {
        this.closed.emit();
    }

    /** 更新設定 */
    private updateSettings(partial: Partial<AgentationSettings>): void {
        this.settings = { ...this.settings, ...partial };
        this.settingsChange.emit(this.settings);
    }
}
