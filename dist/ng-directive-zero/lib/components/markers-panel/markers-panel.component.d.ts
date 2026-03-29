import { EventEmitter } from '@angular/core';
import { MarkerAnnotation } from '../../models/component-node.interface';
import * as i0 from "@angular/core";
/**
 * MarkersPanelComponent
 *
 * 已標記組件列表：顯示、編輯意圖、刪除標記
 */
export declare class MarkersPanelComponent {
    /** 標記列表 */
    markers: MarkerAnnotation[];
    /** 面板關閉時觸發 */
    closed: EventEmitter<void>;
    /** 刪除標記時觸發 */
    deleteMarker: EventEmitter<number>;
    /** 更新標記意圖時觸發 */
    updateIntent: EventEmitter<{
        index: number;
        intent: string;
    }>;
    /** 跳轉到標記時觸發 */
    scrollToMarker: EventEmitter<number>;
    /** 顏色對應的 HEX 值 */
    readonly colorHex: Record<import("../../models/component-node.interface").MarkerColor, string>;
    /** 當前編輯的標記索引 */
    editingIndex: number | null;
    /** 編輯中的意圖文字 */
    editingIntent: string;
    /** 開始編輯意圖 */
    startEdit(marker: MarkerAnnotation): void;
    /** 保存編輯 */
    saveEdit(): void;
    /** 取消編輯 */
    cancelEdit(): void;
    /** 刪除標記 */
    onDelete(index: number): void;
    /** 跳轉到標記 */
    onScrollTo(index: number): void;
    /** 關閉面板 */
    close(): void;
    /** 處理 Enter 鍵 */
    onKeyDown(event: KeyboardEvent): void;
    /** trackBy 函數 */
    trackByIndex(index: number, marker: MarkerAnnotation): number;
    static ɵfac: i0.ɵɵFactoryDeclaration<MarkersPanelComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<MarkersPanelComponent, "ag-markers-panel", never, { "markers": { "alias": "markers"; "required": false; }; }, { "closed": "closed"; "deleteMarker": "deleteMarker"; "updateIntent": "updateIntent"; "scrollToMarker": "scrollToMarker"; }, never, never, false, never>;
}
