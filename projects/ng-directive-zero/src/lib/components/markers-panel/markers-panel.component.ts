import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
    MarkerAnnotation,
    MARKER_COLORS,
} from '../../models/component-node.interface';

/**
 * MarkersPanelComponent
 *
 * 已標記組件列表：顯示、編輯意圖、刪除標記
 */
@Component({
    selector: 'ag-markers-panel',
    standalone: false,
    templateUrl: './markers-panel.component.html',
    styleUrls: ['./markers-panel.component.scss'],
})
export class MarkersPanelComponent {
    /** 標記列表 */
    @Input() markers: MarkerAnnotation[] = [];

    /** 面板關閉時觸發 */
    @Output() closed = new EventEmitter<void>();

    /** 刪除標記時觸發 */
    @Output() deleteMarker = new EventEmitter<number>();

    /** 更新標記意圖時觸發 */
    @Output() updateIntent = new EventEmitter<{ index: number; intent: string }>();

    /** 跳轉到標記時觸發 */
    @Output() scrollToMarker = new EventEmitter<number>();

    /** 顏色對應的 HEX 值 */
    readonly colorHex = MARKER_COLORS;

    /** 當前編輯的標記索引 */
    editingIndex: number | null = null;

    /** 編輯中的意圖文字 */
    editingIntent = '';

    /** 開始編輯意圖 */
    startEdit(marker: MarkerAnnotation): void {
        this.editingIndex = marker.index;
        this.editingIntent = marker.intent;
    }

    /** 保存編輯 */
    saveEdit(): void {
        if (this.editingIndex !== null) {
            this.updateIntent.emit({
                index: this.editingIndex,
                intent: this.editingIntent,
            });
            this.editingIndex = null;
            this.editingIntent = '';
        }
    }

    /** 取消編輯 */
    cancelEdit(): void {
        this.editingIndex = null;
        this.editingIntent = '';
    }

    /** 刪除標記 */
    onDelete(index: number): void {
        this.deleteMarker.emit(index);
    }

    /** 跳轉到標記 */
    onScrollTo(index: number): void {
        this.scrollToMarker.emit(index);
    }

    /** 關閉面板 */
    close(): void {
        this.closed.emit();
    }

    /** 處理 Enter 鍵 */
    onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.saveEdit();
        } else if (event.key === 'Escape') {
            this.cancelEdit();
        }
    }

    /** trackBy 函數 */
    trackByIndex(index: number, marker: MarkerAnnotation): number {
        return marker.index;
    }
}
