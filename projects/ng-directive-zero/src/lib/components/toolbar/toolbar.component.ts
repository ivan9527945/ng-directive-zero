import { Component, EventEmitter, Input, Output, HostBinding } from '@angular/core';
import {
    ToolbarState,
    RecordingSession,
    AgentationSettings,
    DEFAULT_SETTINGS,
} from '../../models/component-node.interface';

/**
 * ToolbarComponent
 *
 * 浮動工具列：提供錄製控制、檢視、複製、設定等功能
 */
@Component({
    selector: 'ag-toolbar',
    standalone: false,
    templateUrl: './toolbar.component.html',
    styleUrls: ['./toolbar.component.scss'],
})
export class ToolbarComponent {
    /** 當前錄製會話 */
    @Input() session: RecordingSession | null = null;

    /** 當前設定 */
    @Input() settings: AgentationSettings = DEFAULT_SETTINGS;

    /** 綁定 dark mode class 到 host */
    @HostBinding('class.ag-dark-mode')
    get isDarkMode(): boolean {
        return this.settings.isDarkMode;
    }

    /** 工具列狀態 */
    @Input() state: ToolbarState = {
        showSettings: false,
        showMarkers: false,
        isRecording: false,
        isMinimized: false,
    };

    /** 開始錄製 */
    @Output() startRecording = new EventEmitter<void>();

    /** 結束錄製 */
    @Output() stopRecording = new EventEmitter<void>();

    /** 切換檢視標記列表 */
    @Output() toggleMarkers = new EventEmitter<void>();

    /** 複製到剪貼簿 */
    @Output() copyToClipboard = new EventEmitter<void>();

    /** 清除所有標記 */
    @Output() clearMarkers = new EventEmitter<void>();

    /** 切換設定面板 */
    @Output() toggleSettings = new EventEmitter<void>();

    /** 關閉工具 */
    @Output() closeToolbar = new EventEmitter<void>();

    /** 切換最小化狀態 */
    @Output() toggleMinimize = new EventEmitter<void>();

    /** 設定變更 */
    @Output() settingsChange = new EventEmitter<AgentationSettings>();

    /** 標記數量 */
    get markerCount(): number {
        return this.session?.markers.length ?? 0;
    }

    /** 是否有標記 */
    get hasMarkers(): boolean {
        return this.markerCount > 0;
    }

    /** 切換錄製狀態 */
    onToggleRecording(): void {
        if (this.state.isRecording) {
            this.stopRecording.emit();
        } else {
            this.startRecording.emit();
        }
    }

    /** 處理複製 */
    onCopy(): void {
        if (this.hasMarkers) {
            this.copyToClipboard.emit();
        }
    }

    /** 處理清除 */
    onClear(): void {
        if (this.hasMarkers) {
            this.clearMarkers.emit();
        }
    }

    /** 處理設定切換 */
    onToggleSettings(): void {
        this.toggleSettings.emit();
    }

    /** 處理標記列表切換 */
    onToggleMarkers(): void {
        this.toggleMarkers.emit();
    }

    /** 處理關閉 */
    onClose(): void {
        this.closeToolbar.emit();
    }

    /** 處理最小化切換 */
    onToggleMinimize(): void {
        this.toggleMinimize.emit();
    }
}
