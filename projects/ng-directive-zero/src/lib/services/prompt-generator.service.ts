import { Injectable } from '@angular/core';
import { ComponentNode, UserAnnotation, OutputDetail } from '../models/component-node.interface';
import { DataSanitizerService } from './data-sanitizer.service';

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
@Injectable({
    providedIn: 'root',
})
export class PromptGeneratorService {
    constructor(private dataSanitizer: DataSanitizerService) { }

    /**
     * 生成 Page Feedback 輸出（多標記）
     */
    generatePageFeedback(
        markers: Array<{ target: ComponentNode; intent: string }>,
        options: {
            outputDetail: OutputDetail;
            pageUrl?: string;
            viewport?: { width: number; height: number };
            userAgent?: string;
            timestamp?: number;
        }
    ): string {
        const lines: string[] = [];

        // 環境資訊（standard 及以上）
        if (options.outputDetail !== 'compact') {
            lines.push(`## Page Feedback: ${this.getPathFromUrl(options.pageUrl)}`);
            lines.push('');
            lines.push('**Environment:**');

            if (options.viewport) {
                lines.push(`- Viewport: ${options.viewport.width}×${options.viewport.height}`);
            }
            if (options.pageUrl) {
                lines.push(`- URL: ${options.pageUrl}`);
            }
            if (options.userAgent && options.outputDetail !== 'standard') {
                lines.push(`- User Agent: ${options.userAgent}`);
            }
            if (options.timestamp) {
                lines.push(`- Timestamp: ${new Date(options.timestamp).toISOString()}`);
            }
            lines.push('');
            lines.push('---');
            lines.push('');
        } else {
            lines.push(`## Page Feedback`);
            lines.push('');
        }

        // 各個標記
        markers.forEach((marker, index) => {
            const markerOutput = this.generateMarkerOutput(
                marker.target,
                marker.intent,
                index + 1,
                options.outputDetail
            );
            lines.push(markerOutput);
            lines.push('');
        });

        return lines.join('\n');
    }

    /**
     * 生成單個標記的輸出
     */
    generateMarkerOutput(
        node: ComponentNode,
        intent: string,
        index: number,
        outputDetail: OutputDetail
    ): string {
        switch (outputDetail) {
            case 'compact':
                return this.generateCompact(node, intent, index);
            case 'standard':
                return this.generateStandard(node, intent, index);
            case 'detailed':
                return this.generateDetailed(node, intent, index);
            case 'forensic':
            default:
                return this.generateForensic(node, intent, index);
        }
    }

    /**
     * Compact 模式：最簡潔
     */
    private generateCompact(node: ComponentNode, intent: string, index: number): string {
        const elementType = this.getElementType(node);
        const lines = [
            `### ${index}. ${elementType}`,
        ];

        if (node.selector) {
            lines.push(`**Selector:** \`<${node.selector}>\``);
        }

        if (intent) {
            lines.push(`**Feedback:** ${intent}`);
        }

        return lines.join('\n');
    }

    /**
     * Standard 模式：標準
     */
    private generateStandard(node: ComponentNode, intent: string, index: number): string {
        const elementType = this.getElementType(node);
        const lines = [
            `### ${index}. ${elementType}`,
            `**Full DOM Path:** ${this.formatDomPath(node.domPath)}`,
        ];

        // CSS Classes
        const cssClasses = this.extractCssClasses(node);
        if (cssClasses.length > 0) {
            lines.push(`**CSS Classes:** ${cssClasses.join(', ')}`);
        }

        // Position
        lines.push(`**Position:** x:${Math.round(node.rect.x)}, y:${Math.round(node.rect.y)} (${Math.round(node.rect.width)}×${Math.round(node.rect.height)}px)`);

        // 基本 Styles（只顯示重要的）
        const keyStyles = this.extractKeyStyles(node.computedStyles);
        if (keyStyles) {
            lines.push(`**Computed Styles:** ${keyStyles}`);
        }

        if (intent) {
            lines.push(`**Feedback:** ${intent}`);
        }

        return lines.join('\n');
    }

    /**
     * Detailed 模式：詳細
     */
    private generateDetailed(node: ComponentNode, intent: string, index: number): string {
        const elementType = this.getElementType(node);
        const lines = [
            `### ${index}. ${elementType}`,
            `**Full DOM Path:** ${this.formatDomPath(node.domPath)}`,
        ];

        // CSS Classes
        const cssClasses = this.extractCssClasses(node);
        if (cssClasses.length > 0) {
            lines.push(`**CSS Classes:** ${cssClasses.join(', ')}`);
        }

        // Position
        lines.push(`**Position:** x:${Math.round(node.rect.x)}, y:${Math.round(node.rect.y)} (${Math.round(node.rect.width)}×${Math.round(node.rect.height)}px)`);

        // Annotation position
        const annotationX = ((node.rect.x + node.rect.width / 2) / window.innerWidth * 100).toFixed(1);
        const annotationY = Math.round(node.rect.y + node.rect.height / 2);
        lines.push(`**Annotation at:** ${annotationX}% from left, ${annotationY}px from top`);

        // Context (text content)
        const textContent = this.getTextContent(node);
        if (textContent) {
            lines.push(`**Context:** ${textContent}`);
        }

        // Computed Styles
        const allStyles = this.formatAllStyles(node.computedStyles);
        if (allStyles) {
            lines.push(`**Computed Styles:** ${allStyles}`);
        }

        // Accessibility
        const accessibility = this.getAccessibility(node);
        if (accessibility) {
            lines.push(`**Accessibility:** ${accessibility}`);
        }

        // Nearby Elements
        const nearbyElements = this.getNearbyElements(node);
        if (nearbyElements) {
            lines.push(`**Nearby Elements:** ${nearbyElements}`);
        }

        if (intent) {
            lines.push(`**Feedback:** ${intent}`);
        }

        return lines.join('\n');
    }

    /**
     * Forensic 模式：完整（舊版相容格式）
     */
    private generateForensic(node: ComponentNode, intent: string, index: number): string {
        const elementType = this.getElementType(node);
        const lines = [
            `### ${index}. ${elementType}`,
            `**Full DOM Path:** ${this.formatDomPath(node.domPath)}`,
        ];

        // CSS Classes
        const cssClasses = this.extractCssClasses(node);
        if (cssClasses.length > 0) {
            lines.push(`**CSS Classes:** ${cssClasses.join(', ')}`);
        }

        // Position
        lines.push(`**Position:** x:${Math.round(node.rect.x)}, y:${Math.round(node.rect.y)} (${Math.round(node.rect.width)}×${Math.round(node.rect.height)}px)`);

        // Annotation position
        const annotationX = ((node.rect.x + node.rect.width / 2) / window.innerWidth * 100).toFixed(1);
        const annotationY = Math.round(node.rect.y + node.rect.height / 2);
        lines.push(`**Annotation at:** ${annotationX}% from left, ${annotationY}px from top`);

        // Selected text / Context
        const textContent = this.getTextContent(node);
        if (textContent) {
            if (textContent.length > 100) {
                lines.push(`**Selected text:** "${textContent}"`);
            } else {
                lines.push(`**Context:** ${textContent}`);
            }
        }

        // Full Computed Styles
        const allStyles = this.formatAllStyles(node.computedStyles);
        if (allStyles) {
            lines.push(`**Computed Styles:** ${allStyles}`);
        }

        // Accessibility
        const accessibility = this.getAccessibility(node);
        if (accessibility) {
            lines.push(`**Accessibility:** ${accessibility}`);
        }

        // Nearby Elements
        const nearbyElements = this.getNearbyElements(node);
        if (nearbyElements) {
            lines.push(`**Nearby Elements:** ${nearbyElements}`);
        }

        if (intent) {
            lines.push(`**Feedback:** ${intent}`);
        }

        return lines.join('\n');
    }

    // ==================== 輔助方法 ====================

    /**
     * 生成完整的 AI Prompt（舊版兼容）
     */
    generatePrompt(annotation: UserAnnotation): string {
        return this.generateForensic(annotation.target, annotation.intent, 1);
    }

    /**
     * 僅生成組件資訊（舊版兼容）
     */
    generateComponentInfo(node: ComponentNode): string {
        return this.generateForensic(node, '', 1);
    }

    private getPathFromUrl(url?: string): string {
        if (!url) return '/';
        try {
            const urlObj = new URL(url);
            return urlObj.pathname || '/';
        } catch {
            return '/';
        }
    }

    private getElementType(node: ComponentNode): string {
        // 嘗試從 DOM 元素獲取更詳細的類型描述
        const tag = node.domElement.tagName.toLowerCase();
        const role = node.domElement.getAttribute('role');
        const ariaLabel = node.domElement.getAttribute('aria-label');
        const textContent = node.domElement.textContent?.trim().substring(0, 30);

        if (node.displayName && node.displayName !== tag) {
            // Angular 組件
            return `${node.displayName}`;
        }

        if (role) {
            return `${role}: "${textContent || tag}"`;
        }

        if (tag === 'button') {
            return `button "${textContent || '(no text)'}"`;
        }

        if (tag === 'a') {
            return `link "${textContent || ariaLabel || '(no text)'}"`;
        }

        if (tag === 'input') {
            const type = node.domElement.getAttribute('type') || 'text';
            return `input[${type}]`;
        }

        if (tag === 'p') {
            return `paragraph: "${textContent ? textContent.substring(0, 40) + '...' : ''}"`;
        }

        if (tag === 'section' || tag === 'div') {
            const className = node.domElement.className;
            if (className && typeof className === 'string') {
                const mainClass = className.split(' ')[0];
                return `${tag}.${mainClass}`;
            }
        }

        return node.selector ? `<${node.selector}>` : tag;
    }

    private formatDomPath(domPath: string): string {
        return domPath;
    }

    private extractCssClasses(node: ComponentNode): string[] {
        const className = node.domElement.className;
        if (!className || typeof className !== 'string') return [];
        return className.split(' ').filter(c => c.trim());
    }

    private extractKeyStyles(styles: Record<string, string>): string {
        const keyProps = ['color', 'background-color', 'font-size', 'font-weight', 'display', 'position'];
        const parts: string[] = [];

        for (const prop of keyProps) {
            if (styles[prop] && styles[prop] !== 'none' && styles[prop] !== 'normal') {
                parts.push(`${prop}: ${styles[prop]}`);
            }
        }

        return parts.join('; ');
    }

    private formatAllStyles(styles: Record<string, string>): string {
        const parts: string[] = [];

        for (const [prop, value] of Object.entries(styles)) {
            if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
                parts.push(`${prop}: ${value}`);
            }
        }

        return parts.join('; ');
    }

    private getTextContent(node: ComponentNode): string {
        const text = node.domElement.textContent?.trim() || '';
        if (text.length > 200) {
            return text.substring(0, 200) + '...';
        }
        return text;
    }

    private getAccessibility(node: ComponentNode): string {
        const parts: string[] = [];

        if (node.domElement.getAttribute('tabindex') !== null) {
            parts.push('focusable');
        }

        const ariaLabel = node.domElement.getAttribute('aria-label');
        if (ariaLabel) {
            parts.push(`aria-label: "${ariaLabel}"`);
        }

        const role = node.domElement.getAttribute('role');
        if (role) {
            parts.push(`role: ${role}`);
        }

        return parts.join(', ');
    }

    private getNearbyElements(node: ComponentNode): string {
        const parent = node.domElement.parentElement;
        if (!parent) return '';

        const siblings = Array.from(parent.children);
        const nearby: string[] = [];

        siblings.forEach((sibling) => {
            if (sibling !== node.domElement) {
                const tag = sibling.tagName.toLowerCase();
                const className = sibling.className;
                const text = sibling.textContent?.trim().substring(0, 20);
                const classStr = className && typeof className === 'string' ? `.${className.split(' ')[0]}` : '';
                nearby.push(`${tag}${classStr}${text ? ` "${text}"` : ''}`);
            }
        });

        if (nearby.length > 5) {
            return nearby.slice(0, 3).join(', ') + ` (${siblings.length} total in .${parent.className?.split(' ')[0] || 'parent'})`;
        }

        return nearby.join(', ');
    }

    private escapeMarkdown(text: string): string {
        return text
            .replace(/\|/g, '\\|')
            .replace(/`/g, '\\`')
            .replace(/\*/g, '\\*')
            .replace(/\n/g, ' ');
    }
}
