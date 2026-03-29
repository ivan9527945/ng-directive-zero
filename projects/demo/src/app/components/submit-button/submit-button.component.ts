import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';

/**
 * SubmitButtonComponent
 *
 * 示範組件：展示 loading/disabled 狀態的提交按鈕
 */
@Component({
    selector: 'demo-submit-button',
    standalone: false,
    templateUrl: './submit-button.component.html',
    styleUrls: ['./submit-button.component.scss'],
})
export class SubmitButtonComponent {
    /** 按鈕文字 */
    @Input() label = 'Submit';

    /** Loading 時顯示的文字 */
    @Input() loadingLabel = 'Processing...';

    /** 是否正在載入 */
    @Input() isLoading = false;

    /** 是否禁用 */
    @Input() disabled = false;

    /** 按鈕樣式變體 */
    @Input() variant: ButtonVariant = 'primary';

    /** 是否全寬 */
    @Input() fullWidth = false;

    /** 圖標 (可選) */
    @Input() icon?: string;

    /** 點擊事件 */
    @Output() clicked = new EventEmitter<void>();

    /** 內部 hover 狀態 */
    isHovered = false;

    /** 獲取顯示文字 */
    get displayLabel(): string {
        return this.isLoading ? this.loadingLabel : this.label;
    }

    /** 獲取是否實際禁用 */
    get isDisabled(): boolean {
        return this.disabled || this.isLoading;
    }

    onClick(): void {
        if (!this.isDisabled) {
            this.clicked.emit();
        }
    }

    onMouseEnter(): void {
        this.isHovered = true;
    }

    onMouseLeave(): void {
        this.isHovered = false;
    }
}
