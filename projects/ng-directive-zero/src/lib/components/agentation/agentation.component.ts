import { Component, OnInit, isDevMode } from '@angular/core';
import {
    ComponentNode,
    MarkerAnnotation,
    RecordingSession,
    AgentationSettings,
    ToolbarState,
    DEFAULT_SETTINGS
} from '../../models/component-node.interface';
import { PromptGeneratorService } from '../../services/prompt-generator.service';

@Component({
    selector: 'ag-directive-zero',
    standalone: false,
    templateUrl: './agentation.component.html',
    styleUrls: ['./agentation.component.scss']
})
export class AgentationComponent implements OnInit {

    isDev = isDevMode();

    /** 設定 */
    settings: AgentationSettings = { ...DEFAULT_SETTINGS };

    /** 工具列狀態 */
    toolbarState: ToolbarState = {
        showSettings: false,
        showMarkers: false,
        isRecording: false,
        isMinimized: false,
    };

    /** 錄製會話 */
    session: RecordingSession = {
        id: this.generateId(),
        markers: [],
        startTime: 0,
        isRecording: false,
    };

    // Just used for legacy panel if needed, but mainly for overlay
    selectedNode: ComponentNode | null = null;

    constructor(private promptGenerator: PromptGeneratorService) { }

    ngOnInit(): void {
    }

    // ==================== 工具列事件 ====================

    /** 開始錄製 */
    onStartRecording(): void {
        this.session = {
            id: this.generateId(),
            markers: [],
            startTime: Date.now(),
            isRecording: true,
        };
        this.toolbarState.isRecording = true;
        this.toolbarState.showSettings = false;
        this.toolbarState.showMarkers = false;
    }

    /** 停止錄製 */
    onStopRecording(): void {
        this.session.isRecording = false;
        this.session.endTime = Date.now();
        this.toolbarState.isRecording = false;
    }

    /** 處理錄製狀態變更（來自 Overlay 快捷鍵等） */
    onRecordingChanged(isRecording: boolean): void {
        if (isRecording) {
            this.onStartRecording();
        } else {
            this.onStopRecording();
        }
    }

    /** 切換顯示標記列表 */
    onToggleMarkers(): void {
        this.toolbarState.showMarkers = !this.toolbarState.showMarkers;
        if (this.toolbarState.showMarkers) {
            this.toolbarState.showSettings = false;
        }
    }

    /** 複製到剪貼簿 */
    async onCopyToClipboard(): Promise<void> {
        if (this.session.markers.length === 0) return;

        const markdown = this.generateMultiMarkerOutput();

        try {
            await navigator.clipboard.writeText(markdown);
            console.log('[Agentation] Copied to clipboard');

            if (this.settings.clearOnCopy) {
                this.onClearMarkers();
            }
        } catch (err) {
            console.error('[Agentation] Failed to copy:', err);
        }
    }

    /** 清除所有標記 */
    onClearMarkers(): void {
        this.session.markers = [];
    }

    /** 切換設定面板 */
    onToggleSettings(): void {
        this.toolbarState.showSettings = !this.toolbarState.showSettings;
        if (this.toolbarState.showSettings) {
            this.toolbarState.showMarkers = false;
        }
    }

    /** 關閉工具列 */
    onCloseToolbar(): void {
        this.toolbarState.isRecording = false;
        this.toolbarState.showSettings = false;
        this.toolbarState.showMarkers = false;
        this.session.markers = [];
    }

    /** 切換最小化 */
    onToggleMinimize(): void {
        this.toolbarState.isMinimized = !this.toolbarState.isMinimized;
        // 如果工具列收合，則關閉設定面板
        if (this.toolbarState.isMinimized) {
            this.toolbarState.showSettings = false;
        }
    }

    /** 設定變更 */
    onSettingsChange(newSettings: AgentationSettings): void {
        // 如果顏色有變更，更新所有已存在的 markers
        if (newSettings.markerColor !== this.settings.markerColor) {
            this.session.markers = this.session.markers.map((m: MarkerAnnotation) => ({
                ...m,
                color: newSettings.markerColor,
            }));
        }
        this.settings = newSettings;
    }

    // ==================== 標記事件 ====================

    /** 新增標記 */
    onMarkerAdded(node: ComponentNode): void {
        const marker: MarkerAnnotation = {
            index: this.session.markers.length + 1,
            target: node,
            intent: '',
            color: this.settings.markerColor,
            timestamp: Date.now(),
        };
        this.session.markers = [...this.session.markers, marker];
        // console.log('[Agentation] Marker added:', marker);
    }

    /** 刪除標記 */
    onDeleteMarker(index: number): void {
        this.session.markers = this.session.markers
            .filter((m: MarkerAnnotation) => m.index !== index)
            .map((m: MarkerAnnotation, i: number) => ({ ...m, index: i + 1 }));
    }

    /** 更新標記意圖 */
    onUpdateIntent(event: { index: number; intent: string }): void {
        this.session.markers = this.session.markers.map((m: MarkerAnnotation) =>
            m.index === event.index ? { ...m, intent: event.intent } : m
        );
    }

    /** 跳轉到標記 */
    onScrollToMarker(index: number): void {
        const marker = this.session.markers.find((m: MarkerAnnotation) => m.index === index);
        if (marker) {
            marker.target.domElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }

    // ==================== 輔助方法 ====================

    /** 生成多標記輸出 */
    private generateMultiMarkerOutput(): string {
        const markers = this.session.markers.map((marker: MarkerAnnotation) => ({
            target: marker.target,
            intent: marker.intent || '',
        }));

        return this.promptGenerator.generatePageFeedback(markers, {
            outputDetail: this.settings.outputDetail,
            pageUrl: window.location.href,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
        });
    }

    /** 生成唯一 ID */
    private generateId(): string {
        return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

}
