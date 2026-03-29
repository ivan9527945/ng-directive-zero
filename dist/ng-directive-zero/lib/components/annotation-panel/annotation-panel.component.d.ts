import { EventEmitter } from '@angular/core';
import { ComponentNode } from '../../models/component-node.interface';
import { PromptGeneratorService } from '../../services/prompt-generator.service';
/**
 * AnnotationPanelComponent
 *
 * 標註面板：顯示選中組件的詳細資訊，並提供使用者輸入意圖的介面
 */
import { McpService, McpStatus } from '../../services/mcp.service';
import { Observable } from 'rxjs';
import * as i0 from "@angular/core";
export declare class AnnotationPanelComponent {
    private promptGenerator;
    private mcpService;
    /** 選中的組件節點 */
    selectedNode: ComponentNode | null;
    /** 面板關閉時觸發 */
    closed: EventEmitter<void>;
    /** 使用者輸入的意圖 */
    userIntent: string;
    /** 是否已複製到剪貼板 */
    copied: boolean;
    /** 是否已發送到 MCP */
    sent: boolean;
    /** 展開的區塊 */
    expandedSections: Record<'inputs' | 'outputs' | 'properties' | 'styles', boolean>;
    mcpStatus$: Observable<McpStatus>;
    constructor(promptGenerator: PromptGeneratorService, mcpService: McpService);
    /**
     * 發送標註給 Agent (MCP)
     */
    sendToAgent(): Promise<void>;
    /**
     * 複製 Markdown 到剪貼板
     */
    copyToClipboard(): Promise<void>;
    /**
     * 僅複製組件資訊（不含使用者意圖）
     */
    copyComponentInfo(): Promise<void>;
    /**
     * 清除選擇
     */
    clearSelection(): void;
    /**
     * 切換區塊展開狀態
     */
    toggleSection(section: 'inputs' | 'outputs' | 'properties' | 'styles'): void;
    /**
     * 獲取 Input 的條目
     */
    getInputEntries(): Array<{
        key: string;
        value: unknown;
    }>;
    /**
     * 獲取公開屬性條目
     */
    getPropertyEntries(): Array<{
        key: string;
        value: unknown;
    }>;
    /**
     * 獲取樣式條目
     */
    getStyleEntries(): Array<{
        key: string;
        value: string;
    }>;
    /**
     * 格式化值為顯示字串
     */
    formatValue(value: unknown): string;
    /**
     * 獲取值的類型顏色
     */
    getValueColor(value: unknown): string;
    /**
     * Fallback 複製方式
     */
    private fallbackCopy;
    static ɵfac: i0.ɵɵFactoryDeclaration<AnnotationPanelComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<AnnotationPanelComponent, "ag-annotation-panel", never, { "selectedNode": { "alias": "selectedNode"; "required": false; }; }, { "closed": "closed"; }, never, never, false, never>;
}
