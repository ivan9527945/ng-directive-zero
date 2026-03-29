import { EventEmitter, OnDestroy, OnInit, SimpleChanges, OnChanges } from '@angular/core';
import { ComponentNode, MarkerAnnotation, MarkerColor, AgentationSettings } from '../../models/component-node.interface';
import { ComponentWalkerService, AncestorBreadcrumb } from '../../services/component-walker.service';
import * as i0 from "@angular/core";
/**
 * OverlayComponent (v2)
 *
 * 支援多選標記的視覺化 DOM 檢查器
 */
export declare class OverlayComponent implements OnInit, OnDestroy, OnChanges {
    private componentWalker;
    /** 已有的標記列表 */
    markers: MarkerAnnotation[];
    /** 當前設定 */
    settings: AgentationSettings;
    /** 是否處於錄製模式 */
    isRecording: boolean;
    /** 工具列是否最小化 */
    isMinimized: boolean;
    /** 新增標記時觸發（多選模式） */
    markerAdded: EventEmitter<ComponentNode>;
    /** 選中組件時觸發（兼容舊版） */
    componentSelected: EventEmitter<ComponentNode>;
    /** 懸停組件變化時觸發 */
    componentHovered: EventEmitter<ComponentNode | null>;
    /** 錄製模式變化時觸發 */
    recordingChanged: EventEmitter<boolean>;
    /** 標記被刪除時觸發 */
    markerDeleted: EventEmitter<number>;
    /** 高亮框樣式 */
    highlightStyle: Record<string, string>;
    /** Tooltip 內容 */
    tooltipContent: string;
    /** Tooltip 位置 */
    tooltipStyle: Record<string, string>;
    /** 是否顯示 tooltip */
    showTooltip: boolean;
    /** 當前懸停的節點 */
    hoveredNode: ComponentNode | null;
    /** 顏色對應的 HEX 值 */
    readonly colorHex: Record<MarkerColor, string>;
    /** 綁定的 click handler（用於移除監聽器） */
    private boundClickHandler;
    /** 正在編輯的標記 */
    editingMarker: MarkerAnnotation | null;
    /** 編輯器位置 */
    editorPosition: {
        top: number;
        left: number;
    };
    /** 祖先麵包屑列表 */
    ancestorBreadcrumbs: AncestorBreadcrumb[];
    /** 麵包屑位置 */
    breadcrumbStyle: Record<string, string>;
    /** 當前選中的麵包屑索引 */
    selectedBreadcrumbIndex: number;
    /** 是否顯示麵包屑 */
    showBreadcrumb: boolean;
    /** 是否鎖定當前選取（Click-to-lock） */
    isLocked: boolean;
    /** 鎖定的節點 */
    lockedNode: ComponentNode | null;
    constructor(componentWalker: ComponentWalkerService);
    ngOnInit(): void;
    ngOnDestroy(): void;
    ngOnChanges(changes: SimpleChanges): void;
    /**
     * 開始錄製模式
     */
    startRecording(): void;
    /**
     * 停止錄製模式
     */
    stopRecording(): void;
    private cleanupRecording;
    /**
     * 切換錄製模式
     */
    toggleRecording(): void;
    /**
     * 處理滑鼠移動
     */
    onMouseMove(event: MouseEvent): void;
    /**
     * 處理點擊（capture phase，優先攔截）
     */
    /**
     * 處理點擊（capture phase，優先攔截）
     */
    private onDocumentClick;
    /**
     * 鎖定節點
     */
    private lockNode;
    /**
     * 解鎖
     */
    unlock(): void;
    /**
     * 確認新增標記
     */
    private confirmMarker;
    /**
     * 比較兩個節點是否相同
     */
    private isSameNode;
    /**
     * 處理編輯器儲存
     */
    onEditorSave(event: {
        index: number;
        intent: string;
    }): void;
    /**
     * 處理編輯器刪除
     */
    onEditorDelete(index: number): void;
    /**
     * 處理編輯器取消
     */
    onEditorCancel(): void;
    /**
     * 處理 Escape 鍵
     */
    onEscape(): void;
    /**
     * 處理快捷鍵 Ctrl+Shift+I
     */
    onKeyDown(event: KeyboardEvent): void;
    /**
     * 處理點擊標記編號
     */
    onMarkerClick(marker: MarkerAnnotation, event: MouseEvent): void;
    /**
     * 獲取標記的位置樣式
     */
    getMarkerStyle(marker: MarkerAnnotation): Record<string, string>;
    /**
     * 更新高亮框
     */
    private updateHighlight;
    /**
     * 更新 tooltip
     */
    private updateTooltip;
    /**
     * 清除高亮
     */
    private clearHighlight;
    /**
     * 更新祖先麵包屑
     */
    private updateBreadcrumbs;
    /**
     * 處理麵包屑項目點擊
     */
    onBreadcrumbClick(breadcrumb: AncestorBreadcrumb, index: number, event: MouseEvent): void;
    /**
     * 處理麵包屑項目雙擊（選取該元素）
     */
    /**
     * 處理麵包屑項目雙擊（直接選取）
     */
    onBreadcrumbDoubleClick(breadcrumb: AncestorBreadcrumb, event: MouseEvent): void;
    /**
     * 檢查是否為 overlay 元素
     */
    private isOverlayElement;
    static ɵfac: i0.ɵɵFactoryDeclaration<OverlayComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<OverlayComponent, "ag-overlay", never, { "markers": { "alias": "markers"; "required": false; }; "settings": { "alias": "settings"; "required": false; }; "isRecording": { "alias": "isRecording"; "required": false; }; "isMinimized": { "alias": "isMinimized"; "required": false; }; }, { "markerAdded": "markerAdded"; "componentSelected": "componentSelected"; "componentHovered": "componentHovered"; "recordingChanged": "recordingChanged"; "markerDeleted": "markerDeleted"; }, never, never, false, never>;
}
