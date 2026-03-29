import { OnInit } from '@angular/core';
import { ComponentNode, RecordingSession, AgentationSettings, ToolbarState } from '../../models/component-node.interface';
import { PromptGeneratorService } from '../../services/prompt-generator.service';
import * as i0 from "@angular/core";
export declare class AgentationComponent implements OnInit {
    private promptGenerator;
    isDev: boolean;
    /** 設定 */
    settings: AgentationSettings;
    /** 工具列狀態 */
    toolbarState: ToolbarState;
    /** 錄製會話 */
    session: RecordingSession;
    selectedNode: ComponentNode | null;
    constructor(promptGenerator: PromptGeneratorService);
    ngOnInit(): void;
    /** 開始錄製 */
    onStartRecording(): void;
    /** 停止錄製 */
    onStopRecording(): void;
    /** 處理錄製狀態變更（來自 Overlay 快捷鍵等） */
    onRecordingChanged(isRecording: boolean): void;
    /** 切換顯示標記列表 */
    onToggleMarkers(): void;
    /** 複製到剪貼簿 */
    onCopyToClipboard(): Promise<void>;
    /** 清除所有標記 */
    onClearMarkers(): void;
    /** 切換設定面板 */
    onToggleSettings(): void;
    /** 關閉工具列 */
    onCloseToolbar(): void;
    /** 切換最小化 */
    onToggleMinimize(): void;
    /** 設定變更 */
    onSettingsChange(newSettings: AgentationSettings): void;
    /** 新增標記 */
    onMarkerAdded(node: ComponentNode): void;
    /** 刪除標記 */
    onDeleteMarker(index: number): void;
    /** 更新標記意圖 */
    onUpdateIntent(event: {
        index: number;
        intent: string;
    }): void;
    /** 跳轉到標記 */
    onScrollToMarker(index: number): void;
    /** 生成多標記輸出 */
    private generateMultiMarkerOutput;
    /** 生成唯一 ID */
    private generateId;
    static ɵfac: i0.ɵɵFactoryDeclaration<AgentationComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<AgentationComponent, "ag-directive-zero", never, {}, {}, never, never, false, never>;
}
