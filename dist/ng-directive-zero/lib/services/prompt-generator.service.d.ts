import { ComponentNode, UserAnnotation, OutputDetail } from '../models/component-node.interface';
import { DataSanitizerService } from './data-sanitizer.service';
import * as i0 from "@angular/core";
/**
 * PromptGeneratorService
 *
 * 提示生成服務：根據 OutputDetail 模式生成不同詳細程度的輸出
 *
 * Modes:
 * - compact: 最簡潔，只有元素類型和 feedback
 * - standard: 標準，包含 DOM Path、Position、基本 Styles
 * - detailed: 詳細，包含所有屬性和上下文
 * - forensic: 完整，包含所有可用資訊（舊版相容）
 */
export declare class PromptGeneratorService {
    private dataSanitizer;
    constructor(dataSanitizer: DataSanitizerService);
    /**
     * 生成 Page Feedback 輸出（多標記）
     */
    generatePageFeedback(markers: Array<{
        target: ComponentNode;
        intent: string;
    }>, options: {
        outputDetail: OutputDetail;
        pageUrl?: string;
        viewport?: {
            width: number;
            height: number;
        };
        userAgent?: string;
        timestamp?: number;
    }): string;
    /**
     * 生成單個標記的輸出
     */
    generateMarkerOutput(node: ComponentNode, intent: string, index: number, outputDetail: OutputDetail): string;
    /**
     * Compact 模式：最簡潔
     */
    private generateCompact;
    /**
     * Standard 模式：標準
     */
    private generateStandard;
    /**
     * Detailed 模式：詳細
     */
    private generateDetailed;
    /**
     * Forensic 模式：完整（舊版相容格式）
     */
    private generateForensic;
    /**
     * 生成完整的 AI Prompt（舊版兼容）
     */
    generatePrompt(annotation: UserAnnotation): string;
    /**
     * 僅生成組件資訊（舊版兼容）
     */
    generateComponentInfo(node: ComponentNode): string;
    private getPathFromUrl;
    private getElementType;
    private formatDomPath;
    private extractCssClasses;
    private extractKeyStyles;
    private formatAllStyles;
    private getTextContent;
    private getAccessibility;
    private getNearbyElements;
    private escapeMarkdown;
    static ɵfac: i0.ɵɵFactoryDeclaration<PromptGeneratorService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<PromptGeneratorService>;
}
