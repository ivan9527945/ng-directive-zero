import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MarkerAnnotation } from '../../models/component-node.interface';

/**
 * InlineEditorComponent
 *
 * 內嵌編輯器：用於編輯已標記元素的 intent
 * 參考 React Agentation 的設計
 */
@Component({
  selector: 'ag-inline-editor',
  standalone: false,
  templateUrl: './inline-editor.component.html',
  styleUrls: ['./inline-editor.component.scss'],
})
export class InlineEditorComponent {
  /** 正在編輯的標記 */
  @Input() marker: MarkerAnnotation | null = null;

  /** 編輯器位置 */
  @Input() position: { top: number; left: number } = { top: 0, left: 0 };

  /** 儲存時觸發 */
  @Output() save = new EventEmitter<{ index: number; intent: string }>();

  /** 刪除時觸發 */
  @Output() delete = new EventEmitter<number>();

  /** 取消時觸發 */
  @Output() cancel = new EventEmitter<void>();

  /** 暫存的 intent 值 */
  tempIntent = '';

  /** 樣式面板是否展開 */
  isStyleExpanded = false;

  ngOnChanges(): void {
    if (this.marker) {
      this.tempIntent = this.marker.intent || '';
    }
  }

  /** 儲存 */
  onSave(): void {
    if (this.marker) {
      this.save.emit({
        index: this.marker.index,
        intent: this.tempIntent,
      });
    }
  }

  /** 刪除 */
  onDelete(): void {
    if (this.marker) {
      this.delete.emit(this.marker.index);
    }
  }

  /** 取消 */
  onCancel(): void {
    this.cancel.emit();
  }

  /** 獲取編輯器樣式 */
  getEditorStyle(): Record<string, string> {
    return {
      position: 'absolute',
      top: `${this.position.top}px`,
      left: `${this.position.left}px`,
      zIndex: '999999',
    };
  }

  /** 獲取元素描述 */
  getElementDescription(): string {
    if (!this.marker) return '';
    const target = this.marker.target;
    return `${target.selector || target.displayName}`;
  }

  /** 切換樣式面板 */
  toggleStylePanel(): void {
    this.isStyleExpanded = !this.isStyleExpanded;
  }

  /** 獲取樣式條目 */
  getStyleEntries(): Array<{ key: string; value: string }> {
    if (!this.marker) return [];
    return Object.entries(this.marker.target.computedStyles)
      .filter(([, value]) => value && value !== 'none' && value !== 'normal')
      .map(([key, value]) => ({ key, value }));
  }

  /** 格式化值為顯示字串 */
  formatValue(value: string): string {
    if (!value) return '';
    // 如果值太長，截斷它
    return value.length > 50 ? value.substring(0, 50) + '...' : value;
  }
}
