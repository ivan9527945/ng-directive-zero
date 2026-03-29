import {
    Component,
    EventEmitter,
    HostListener,
    Input,
    OnDestroy,
    OnInit,
    Output,
    SimpleChanges,
    OnChanges,
} from '@angular/core';
import {
    ComponentNode,
    MarkerAnnotation,
    MarkerColor,
    MARKER_COLORS,
    AgentationSettings,
    DEFAULT_SETTINGS,
} from '../../models/component-node.interface';
import { ComponentWalkerService, AncestorBreadcrumb } from '../../services/component-walker.service';

/**
 * OverlayComponent (v2)
 *
 * 支援多選標記的視覺化 DOM 檢查器
 */
@Component({
    selector: 'ag-overlay',
    standalone: false,
    templateUrl: './overlay.component.html',
    styleUrls: ['./overlay.component.scss'],
})
export class OverlayComponent implements OnInit, OnDestroy, OnChanges {
    /** 已有的標記列表 */
    @Input() markers: MarkerAnnotation[] = [];

    /** 當前設定 */
    @Input() settings: AgentationSettings = DEFAULT_SETTINGS;

    /** 是否處於錄製模式 */
    @Input() isRecording = false;

    /** 工具列是否最小化 */
    @Input() isMinimized = false;

    /** 新增標記時觸發（多選模式） */
    @Output() markerAdded = new EventEmitter<ComponentNode>();

    /** 選中組件時觸發（兼容舊版） */
    @Output() componentSelected = new EventEmitter<ComponentNode>();

    /** 懸停組件變化時觸發 */
    @Output() componentHovered = new EventEmitter<ComponentNode | null>();

    /** 錄製模式變化時觸發 */
    @Output() recordingChanged = new EventEmitter<boolean>();

    /** 標記被刪除時觸發 */
    @Output() markerDeleted = new EventEmitter<number>();

    /** 高亮框樣式 */
    highlightStyle: Record<string, string> = { display: 'none' };

    /** Tooltip 內容 */
    tooltipContent = '';

    /** Tooltip 位置 */
    tooltipStyle: Record<string, string> = {};

    /** 是否顯示 tooltip */
    showTooltip = false;

    /** 當前懸停的節點 */
    hoveredNode: ComponentNode | null = null;

    /** 顏色對應的 HEX 值 */
    readonly colorHex = MARKER_COLORS;

    /** 綁定的 click handler（用於移除監聽器） */
    private boundClickHandler: ((event: MouseEvent) => void) | null = null;

    /** 正在編輯的標記 */
    editingMarker: MarkerAnnotation | null = null;

    /** 編輯器位置 */
    editorPosition: { top: number; left: number } = { top: 0, left: 0 };

    /** 祖先麵包屑列表 */
    ancestorBreadcrumbs: AncestorBreadcrumb[] = [];

    /** 麵包屑位置 */
    breadcrumbStyle: Record<string, string> = { display: 'none' };

    /** 當前選中的麵包屑索引 */
    selectedBreadcrumbIndex = 0;

    /** 是否顯示麵包屑 */
    showBreadcrumb = false;

    /** 是否鎖定當前選取（Click-to-lock） */
    isLocked = false;

    /** 鎖定的節點 */
    lockedNode: ComponentNode | null = null;

    constructor(private componentWalker: ComponentWalkerService) { }

    ngOnInit(): void {
        if (!this.componentWalker.isAvailable()) {
            console.warn('[ng-directive-zero] Angular debug API not available. Overlay disabled.');
        }

        // 使用 capture phase 攔截點擊事件
        this.boundClickHandler = this.onDocumentClick.bind(this);
        document.addEventListener('click', this.boundClickHandler, true);
    }

    ngOnDestroy(): void {
        this.stopRecording();
        if (this.boundClickHandler) {
            document.removeEventListener('click', this.boundClickHandler, true);
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isRecording']) {
            if (this.isRecording) {
                if (this.componentWalker.isAvailable()) {
                    document.body.style.cursor = 'crosshair';
                }
            } else {
                this.cleanupRecording();
            }
        }

        // 當工具列最小化時，隱藏所有 overlay 元素
        if (changes['isMinimized'] && this.isMinimized) {
            this.clearHighlight();
        }
    }

    /**
     * 開始錄製模式
     */
    startRecording(): void {
        if (!this.componentWalker.isAvailable()) {
            console.error('[ng-directive-zero] Cannot start recording: Angular debug API not available.');
            return;
        }
        this.isRecording = true;
        this.recordingChanged.emit(true);
        document.body.style.cursor = 'crosshair';
    }

    /**
     * 停止錄製模式
     */
    stopRecording(): void {
        this.isRecording = false;
        this.cleanupRecording();
        this.recordingChanged.emit(false);
    }

    private cleanupRecording(): void {
        this.hoveredNode = null;
        this.highlightStyle = { display: 'none' };  // 明確隱藏高亮框
        this.showTooltip = false;
        this.showBreadcrumb = false;  // 隱藏麵包屑
        this.ancestorBreadcrumbs = [];
        this.showBreadcrumb = false;  // 隱藏麵包屑
        this.ancestorBreadcrumbs = [];
        this.selectedBreadcrumbIndex = 0;
        this.isLocked = false;
        this.lockedNode = null;
        document.body.style.cursor = '';
    }

    /**
     * 切換錄製模式
     */
    toggleRecording(): void {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    /**
     * 處理滑鼠移動
     */
    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent): void {
        if (!this.isRecording) return;
        if (this.isLocked) return; // 鎖定時停止更新懸停狀態

        let target = event.target as HTMLElement;

        // 特殊處理：如果是我們的點擊捕捉層 (處理 disabled 元素)
        if (target.classList.contains('ag-click-overlay')) {
            target.style.display = 'none'; // 暫時隱藏
            const underlying = document.elementFromPoint(event.clientX, event.clientY);
            target.style.display = 'block'; // 恢復顯示

            if (underlying && underlying instanceof HTMLElement) {
                target = underlying;
            }
        }

        if (this.isOverlayElement(target)) return;

        const node = this.componentWalker.getComponentNode(target);

        if (node) {
            this.hoveredNode = node;
            this.updateHighlight(node, this.settings.markerColor);
            this.updateTooltip(node, event);
            this.updateBreadcrumbs(target, event);
            this.componentHovered.emit(node);
        } else {
            this.clearHighlight();
        }
    }

    /**
     * 處理點擊（capture phase，優先攔截）
     */
    /**
     * 處理點擊（capture phase，優先攔截）
     */
    private onDocumentClick(event: MouseEvent): void {
        if (!this.isRecording) return;

        let target = event.target as HTMLElement;

        // 特殊處理：如果是我們的點擊捕捉層
        if (target.classList.contains('ag-click-overlay')) {
            target.style.display = 'none'; // 暫時隱藏
            const underlying = document.elementFromPoint(event.clientX, event.clientY);
            target.style.display = 'block'; // 恢復顯示

            if (underlying && underlying instanceof HTMLElement) {
                target = underlying;
            }
        }

        if (this.isOverlayElement(target)) return;

        // 立即阻止事件傳播，防止觸發按鈕等元素的功能
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const node = this.componentWalker.getComponentNode(target);

        // 如果處於鎖定狀態
        if (this.isLocked) {
            // 如果點擊的是當前鎖定的節點（或其高亮範圍內），則確認標記
            // 直覺上：第二次點擊 = 確認
            if (node && this.lockedNode && this.isSameNode(node, this.lockedNode)) {
                this.confirmMarker(this.lockedNode);
                this.unlock();
            } else {
                // 點擊其他地方 -> 解鎖
                // 如果點擊了另一個有效節點，則立即鎖定該新節點（流暢體驗）
                this.unlock();
                if (node) {
                    this.lockNode(node, event);
                }
            }
        } else {
            // 未鎖定狀態 -> 第一次點擊 -> 鎖定
            if (node) {
                this.lockNode(node, event);
            }
        }
    }

    /**
     * 鎖定節點
     */
    private lockNode(node: ComponentNode, event: MouseEvent): void {
        this.isLocked = true;
        this.lockedNode = node;
        this.hoveredNode = node;
        this.updateHighlight(node, this.settings.markerColor);
        this.updateTooltip(node, event);
        this.updateBreadcrumbs(node.domElement, event);
        this.componentHovered.emit(node);
    }

    /**
     * 解鎖
     */
    unlock(): void {
        this.isLocked = false;
        this.lockedNode = null;
        this.clearHighlight();
    }

    /**
     * 確認新增標記
     */
    private confirmMarker(node: ComponentNode): void {
        // 檢查是否已存在標記
        const existingMarker = this.markers.find(
            m => m.target.domElement === node.domElement
        );

        if (existingMarker) {
            // 顯示編輯器
            const rect = node.domElement.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            this.editorPosition = {
                top: rect.bottom + scrollTop + 10,
                left: rect.left + scrollLeft
            };
            this.editingMarker = existingMarker;
        } else {
            // 新增標記
            this.markerAdded.emit(node);
            this.componentSelected.emit(node);
        }
    }

    /**
     * 比較兩個節點是否相同
     */
    private isSameNode(a: ComponentNode, b: ComponentNode): boolean {
        return a.domElement === b.domElement;
    }

    /**
     * 處理編輯器儲存
     */
    onEditorSave(event: { index: number; intent: string }): void {
        const marker = this.markers.find(m => m.index === event.index);
        if (marker) {
            marker.intent = event.intent;
        }
        this.editingMarker = null;
    }

    /**
     * 處理編輯器刪除
     */
    onEditorDelete(index: number): void {
        this.editingMarker = null;
        this.markerDeleted.emit(index);
    }

    /**
     * 處理編輯器取消
     */
    onEditorCancel(): void {
        this.editingMarker = null;
    }

    /**
     * 處理 Escape 鍵
     */
    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.isRecording) {
            this.stopRecording();
        }
    }

    /**
     * 處理快捷鍵 Ctrl+Shift+I
     */
    @HostListener('document:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        if (event.ctrlKey && event.shiftKey && event.key === 'I') {
            event.preventDefault();
            this.toggleRecording();
        }
    }

    /**
     * 處理點擊標記編號
     */
    onMarkerClick(marker: MarkerAnnotation, event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();

        if (!this.isRecording) return;

        const rect = marker.target.domElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        this.editorPosition = {
            top: rect.bottom + scrollTop + 10,
            left: rect.left + scrollLeft
        };
        this.editingMarker = marker;
    }

    /**
     * 獲取標記的位置樣式
     */
    getMarkerStyle(marker: MarkerAnnotation): Record<string, string> {
        const element = marker.target.domElement;
        const rect = element.getBoundingClientRect();

        // 計算相對於 document 的絕對位置
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        return {
            position: 'absolute',
            top: `${rect.top + scrollTop + rect.height / 2 - 14}px`,
            left: `${rect.left + scrollLeft + rect.width - 14}px`,
            backgroundColor: this.colorHex[marker.color],
        };
    }

    /**
     * 更新高亮框
     */
    private updateHighlight(node: ComponentNode, color: MarkerColor): void {
        const rect = node.rect;
        const hex = this.colorHex[color];

        this.highlightStyle = {
            display: 'block',
            position: 'absolute',
            top: `${rect.top + window.scrollY}px`,
            left: `${rect.left + window.scrollX}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: `${hex}33`,
            border: `2px solid ${hex}`,
            pointerEvents: 'none',
            zIndex: '999998',
            transition: 'all 0.1s ease-out',
        };
    }

    /**
     * 更新 tooltip
     */
    private updateTooltip(node: ComponentNode, event: MouseEvent): void {
        this.tooltipContent = `<${node.selector}> ${node.displayName}`;

        const tooltipX = event.clientX + 12;
        const tooltipY = event.clientY + 12;

        this.tooltipStyle = {
            display: 'block',
            position: 'fixed',
            top: `${tooltipY}px`,
            left: `${tooltipX}px`,
            zIndex: '999999',
        };

        this.showTooltip = true;
    }

    /**
     * 清除高亮
     */
    private clearHighlight(): void {
        this.highlightStyle = { display: 'none' };
        this.showTooltip = false;
        this.showBreadcrumb = false;
        this.hoveredNode = null;
        this.ancestorBreadcrumbs = [];
        this.selectedBreadcrumbIndex = 0;
        this.componentHovered.emit(null);
    }

    /**
     * 更新祖先麵包屑
     */
    private updateBreadcrumbs(element: HTMLElement, event: MouseEvent): void {
        const breadcrumbs = this.componentWalker.getAncestorBreadcrumbs(element);

        // 只有超過 1 個層級時才顯示麵包屑
        if (breadcrumbs.length > 1) {
            this.ancestorBreadcrumbs = breadcrumbs;
            this.selectedBreadcrumbIndex = 0;
            this.showBreadcrumb = true;

            // 固定在畫面頂部中間（錄製提示下方）
            const viewportWidth = window.innerWidth;

            this.breadcrumbStyle = {
                display: 'flex',
                position: 'fixed',
                top: '60px',  // 在錄製提示下方
                left: '50%',
                transform: 'translateX(-50%)',
                maxWidth: `${viewportWidth - 32}px`,
                zIndex: '999999',
            };
        } else {
            this.showBreadcrumb = false;
            this.ancestorBreadcrumbs = [];
        }
    }

    /**
     * 處理麵包屑項目點擊
     */
    onBreadcrumbClick(breadcrumb: AncestorBreadcrumb, index: number, event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const node = this.componentWalker.getComponentNode(breadcrumb.element);
        if (!node) return;

        // 手機版優化：如果是點擊當前已選中的麵包屑 -> 確認標記
        if (this.selectedBreadcrumbIndex === index) {
            this.confirmMarker(node);
            this.unlock();
            return;
        }

        this.selectedBreadcrumbIndex = index;

        // 更新鎖定狀態到新的祖先節點
        this.isLocked = true;
        this.lockedNode = node;
        this.hoveredNode = node;
        this.updateHighlight(node, this.settings.markerColor);
        this.componentHovered.emit(node);
    }

    /**
     * 處理麵包屑項目雙擊（選取該元素）
     */
    /**
     * 處理麵包屑項目雙擊（直接選取）
     */
    onBreadcrumbDoubleClick(breadcrumb: AncestorBreadcrumb, event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const node = this.componentWalker.getComponentNode(breadcrumb.element);
        if (node) {
            this.confirmMarker(node);
            this.unlock();
        }
    }

    /**
     * 檢查是否為 overlay 元素
     */
    private isOverlayElement(element: HTMLElement): boolean {
        return element.closest('ag-overlay') !== null ||
            element.closest('ag-annotation-panel') !== null ||
            element.closest('ag-toolbar') !== null ||
            element.closest('ag-settings-panel') !== null ||
            element.closest('ag-markers-panel') !== null;
    }
}
