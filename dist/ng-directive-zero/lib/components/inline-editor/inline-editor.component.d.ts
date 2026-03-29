import { EventEmitter } from '@angular/core';
import { MarkerAnnotation } from '../../models/component-node.interface';
import * as i0 from "@angular/core";
/**
 * InlineEditorComponent
 *
 * 內嵌編輯器：用於編輯已標記元素的 intent
 * 參考 React Agentation 的設計
 */
export declare class InlineEditorComponent {
    /** 正在編輯的標記 */
    marker: MarkerAnnotation | null;
    /** 編輯器位置 */
    position: {
        top: number;
        left: number;
    };
    /** 儲存時觸發 */
    save: EventEmitter<{
        index: number;
        intent: string;
    }>;
    /** 刪除時觸發 */
    delete: EventEmitter<number>;
    /** 取消時觸發 */
    cancel: EventEmitter<void>;
    /** 暫存的 intent 值 */
    tempIntent: string;
    /** 樣式面板是否展開 */
    isStyleExpanded: boolean;
    ngOnChanges(): void;
    /** 儲存 */
    onSave(): void;
    /** 刪除 */
    onDelete(): void;
    /** 取消 */
    onCancel(): void;
    /** 獲取編輯器樣式 */
    getEditorStyle(): Record<string, string>;
    /** 獲取元素描述 */
    getElementDescription(): string;
    /** 切換樣式面板 */
    toggleStylePanel(): void;
    /** 獲取樣式條目 */
    getStyleEntries(): Array<{
        key: string;
        value: string;
    }>;
    /** 格式化值為顯示字串 */
    formatValue(value: string): string;
    static ɵfac: i0.ɵɵFactoryDeclaration<InlineEditorComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<InlineEditorComponent, "ag-inline-editor", never, { "marker": { "alias": "marker"; "required": false; }; "position": { "alias": "position"; "required": false; }; }, { "save": "save"; "delete": "delete"; "cancel": "cancel"; }, never, never, false, never>;
}
