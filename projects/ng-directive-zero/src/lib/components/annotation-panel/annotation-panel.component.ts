import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentNode, UserAnnotation } from '../../models/component-node.interface';
import { PromptGeneratorService } from '../../services/prompt-generator.service';

/**
 * AnnotationPanelComponent
 *
 * 標註面板：顯示選中組件的詳細資訊，並提供使用者輸入意圖的介面
 */
import { McpService, McpStatus } from '../../services/mcp.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'ag-annotation-panel',
    standalone: false,
    templateUrl: './annotation-panel.component.html',
    styleUrls: ['./annotation-panel.component.scss'],
})
export class AnnotationPanelComponent {
    /** 選中的組件節點 */
    @Input() selectedNode: ComponentNode | null = null;

    /** 面板關閉時觸發 */
    @Output() closed = new EventEmitter<void>();

    /** 使用者輸入的意圖 */
    userIntent = '';

    /** 是否已複製到剪貼板 */
    copied = false;

    /** 是否已發送到 MCP */
    sent = false;

    /** 展開的區塊 */
    expandedSections: Record<'inputs' | 'outputs' | 'properties' | 'styles', boolean> = {
        inputs: true,
        outputs: true,
        properties: false,
        styles: false,
    };

    mcpStatus$: Observable<McpStatus>;

    constructor(
        private promptGenerator: PromptGeneratorService,
        private mcpService: McpService
    ) {
        this.mcpStatus$ = this.mcpService.status$;
    }

    /**
     * 發送標註給 Agent (MCP)
     */
    async sendToAgent(): Promise<void> {
        if (!this.selectedNode) return;

        const annotation: UserAnnotation = {
            target: this.selectedNode,
            intent: this.userIntent || '(No specific intent provided)',
            timestamp: Date.now(),
        };

        try {
            await this.mcpService.sendAnnotation(annotation);
            this.sent = true;
            setTimeout(() => (this.sent = false), 2000);
        } catch (err) {
            console.error('[ng-directive-zero] Failed to send annotation:', err);
            // TODO: Error feedback to user
        }
    }

    /**
     * 複製 Markdown 到剪貼板
     */
    async copyToClipboard(): Promise<void> {
        if (!this.selectedNode) return;

        const annotation: UserAnnotation = {
            target: this.selectedNode,
            intent: this.userIntent || '(No specific intent provided)',
            timestamp: Date.now(),
        };

        const markdown = this.promptGenerator.generatePrompt(annotation);

        try {
            await navigator.clipboard.writeText(markdown);
            this.copied = true;
            setTimeout(() => (this.copied = false), 2000);
        } catch (err) {
            console.error('[ng-directive-zero] Failed to copy:', err);
            // Fallback
            this.fallbackCopy(markdown);
        }
    }

    /**
     * 僅複製組件資訊（不含使用者意圖）
     */
    async copyComponentInfo(): Promise<void> {
        if (!this.selectedNode) return;

        const markdown = this.promptGenerator.generateComponentInfo(this.selectedNode);

        try {
            await navigator.clipboard.writeText(markdown);
            this.copied = true;
            setTimeout(() => (this.copied = false), 2000);
        } catch (err) {
            console.error('[ng-directive-zero] Failed to copy:', err);
            this.fallbackCopy(markdown);
        }
    }

    /**
     * 清除選擇
     */
    clearSelection(): void {
        this.selectedNode = null;
        this.userIntent = '';
        this.closed.emit();
    }

    /**
     * 切換區塊展開狀態
     */
    toggleSection(section: 'inputs' | 'outputs' | 'properties' | 'styles'): void {
        this.expandedSections[section] = !this.expandedSections[section];
    }

    /**
     * 獲取 Input 的條目
     */
    getInputEntries(): Array<{ key: string; value: unknown }> {
        if (!this.selectedNode) return [];
        return Object.entries(this.selectedNode.inputs).map(([key, value]) => ({
            key,
            value,
        }));
    }

    /**
     * 獲取公開屬性條目
     */
    getPropertyEntries(): Array<{ key: string; value: unknown }> {
        if (!this.selectedNode) return [];
        return Object.entries(this.selectedNode.publicProperties).map(([key, value]) => ({
            key,
            value,
        }));
    }

    /**
     * 獲取樣式條目
     */
    getStyleEntries(): Array<{ key: string; value: string }> {
        if (!this.selectedNode) return [];
        return Object.entries(this.selectedNode.computedStyles)
            .filter(([, value]) => value && value !== 'none' && value !== 'normal')
            .map(([key, value]) => ({ key, value }));
    }

    /**
     * 格式化值為顯示字串
     */
    formatValue(value: unknown): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return `"${value}"`;
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }

    /**
     * 獲取值的類型顏色
     */
    getValueColor(value: unknown): string {
        if (value === null || value === undefined) return '#808080';
        if (typeof value === 'string') return '#98c379';
        if (typeof value === 'number') return '#d19a66';
        if (typeof value === 'boolean') return '#56b6c2';
        return '#abb2bf';
    }

    /**
     * Fallback 複製方式
     */
    private fallbackCopy(text: string): void {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.copied = true;
        setTimeout(() => (this.copied = false), 2000);
    }
}
