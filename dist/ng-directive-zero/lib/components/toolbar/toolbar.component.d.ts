import { EventEmitter } from '@angular/core';
import { ToolbarState, RecordingSession, AgentationSettings } from '../../models/component-node.interface';
import * as i0 from "@angular/core";
/**
 * ToolbarComponent
 *
 * 浮動工具列：提供錄製控制、檢視、複製、設定等功能
 */
export declare class ToolbarComponent {
    /** 當前錄製會話 */
    session: RecordingSession | null;
    /** 當前設定 */
    settings: AgentationSettings;
    /** 綁定 dark mode class 到 host */
    get isDarkMode(): boolean;
    /** 工具列狀態 */
    state: ToolbarState;
    /** 開始錄製 */
    startRecording: EventEmitter<void>;
    /** 結束錄製 */
    stopRecording: EventEmitter<void>;
    /** 切換檢視標記列表 */
    toggleMarkers: EventEmitter<void>;
    /** 複製到剪貼簿 */
    copyToClipboard: EventEmitter<void>;
    /** 清除所有標記 */
    clearMarkers: EventEmitter<void>;
    /** 切換設定面板 */
    toggleSettings: EventEmitter<void>;
    /** 關閉工具 */
    closeToolbar: EventEmitter<void>;
    /** 切換最小化狀態 */
    toggleMinimize: EventEmitter<void>;
    /** 設定變更 */
    settingsChange: EventEmitter<AgentationSettings>;
    /** 標記數量 */
    get markerCount(): number;
    /** 是否有標記 */
    get hasMarkers(): boolean;
    /** 切換錄製狀態 */
    onToggleRecording(): void;
    /** 處理複製 */
    onCopy(): void;
    /** 處理清除 */
    onClear(): void;
    /** 處理設定切換 */
    onToggleSettings(): void;
    /** 處理標記列表切換 */
    onToggleMarkers(): void;
    /** 處理關閉 */
    onClose(): void;
    /** 處理最小化切換 */
    onToggleMinimize(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<ToolbarComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<ToolbarComponent, "ag-toolbar", never, { "session": { "alias": "session"; "required": false; }; "settings": { "alias": "settings"; "required": false; }; "state": { "alias": "state"; "required": false; }; }, { "startRecording": "startRecording"; "stopRecording": "stopRecording"; "toggleMarkers": "toggleMarkers"; "copyToClipboard": "copyToClipboard"; "clearMarkers": "clearMarkers"; "toggleSettings": "toggleSettings"; "closeToolbar": "closeToolbar"; "toggleMinimize": "toggleMinimize"; "settingsChange": "settingsChange"; }, never, never, false, never>;
}
