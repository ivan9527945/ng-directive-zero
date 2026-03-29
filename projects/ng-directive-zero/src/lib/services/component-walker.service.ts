import { Injectable } from '@angular/core';
import {
    ComponentNode,
    ParentComponentInfo,
    KEY_COMPUTED_STYLES,
} from '../models/component-node.interface';

/**
 * Angular 全局除錯 API 類型定義
 * 僅在開發模式下可用
 */
interface NgGlobal {
    getComponent<T>(element: Element): T | null;
    getOwningComponent<T>(element: Element): T | null;
    getDirectives(element: Element): unknown[];
    getContext<T>(element: Element): T | null;
}

/**
 * Angular 組件定義內部結構
 */
interface ComponentDef {
    inputs?: Record<string, string>;
    outputs?: Record<string, string>;
    selectors?: Array<Array<string | null>>;
}

/**
 * ComponentWalkerService
 *
 * 核心服務：從 DOM 元素獲取 Angular 組件資訊
 * 使用 Angular 的 ng.getComponent() 等開發模式 API
 *
 * 效能要求：執行時間 < 16ms (1 frame)
 */
@Injectable({
    providedIn: 'root',
})
export class ComponentWalkerService {
    private uidCounter = 0;

    /**
     * 檢查是否在開發模式下且 ng API 可用
     */
    isAvailable(): boolean {
        return typeof (window as unknown as { ng?: NgGlobal }).ng?.getComponent === 'function';
    }

    /**
     * 從 DOM 元素獲取 Angular 組件節點資訊
     *
     * @param element - 目標 DOM 元素
     * @returns ComponentNode 或 null（如果不是 Angular 組件）
     */
    getComponentNode(element: HTMLElement): ComponentNode | null {
        if (!this.isAvailable()) {
            console.warn('[ng-directive-zero] Angular debug API not available. Overlay disabled.');
            return null;
        }

        const ng = (window as unknown as { ng: NgGlobal }).ng;
        const startTime = performance.now();

        try {
            // 嘗試獲取組件實例
            let component = ng.getComponent(element);
            let targetElement = element;
            let isDomNode = false;

            // 如果當前元素不是組件，向上查找最近的組件
            if (!component) {
                const owningComponent = ng.getOwningComponent(element);
                if (!owningComponent) {
                    return null;
                }

                // 檢查是否為 Root Component (沒有父組件)
                const componentHost = this.findComponentHost(element, owningComponent);
                // const parentOfOwning = this.getParentInfo(componentHost || element, ng);

                // 如果點擊的不是 host 本身，則將其視為 DOM 節點
                // (不再限制只能是 Root Component 的子元素)
                if (componentHost !== element) {
                    component = owningComponent;
                    targetElement = element;
                    isDomNode = true;
                } else {
                    component = owningComponent;
                    // 找到擁有該組件的元素
                    targetElement = componentHost ?? element;
                }
            }

            if (isDomNode) {
                return this.createDomNode(targetElement, component);
            }

            // 獲取組件定義
            const componentDef = this.getComponentDef(component);
            const displayName = (component as object).constructor.name;
            const selector = this.extractSelector(componentDef);

            // 提取 @Input 值
            const inputs = this.extractInputValues(component, componentDef);

            // 提取 @Output 名稱
            const outputs = this.extractOutputNames(componentDef);

            // 提取公開屬性
            const publicProperties = this.extractPublicProperties(component, componentDef);

            // 獲取應用的指令
            const directives = ng.getDirectives(targetElement)
                .map((d: unknown) => (d as object).constructor.name)
                .filter((name: string) => name !== 'Object');

            // 獲取父組件資訊
            const parent = this.getParentInfo(targetElement, ng);

            // 計算 DOM 路徑
            const domPath = this.computeDomPath(targetElement);

            // 獲取 computed styles
            const computedStyles = this.extractComputedStyles(targetElement);

            const node: ComponentNode = {
                uid: this.generateUid(),
                displayName,
                selector,
                filePath: null, // MVP 階段不支援
                domPath,
                inputs,
                outputs,
                publicProperties,
                domElement: targetElement,
                rect: targetElement.getBoundingClientRect(),
                computedStyles,
                directives,
                parent,
            };

            // 效能監控
            const elapsed = performance.now() - startTime;
            if (elapsed > 16) {
                console.warn(`[ng-directive-zero] ComponentWalker took ${elapsed.toFixed(2)}ms (> 16ms frame budget)`);
            }

            return node;
        } catch (error) {
            console.error('[ng-directive-zero] Error walking component:', error);
            return null;
        }
    }

    /**
     * 創建 DOM 節點組件資訊 (用於 Root Component 內的普通元素)
     */
    private createDomNode(element: HTMLElement, owningComponent: unknown): ComponentNode {
        const componentDef = this.getComponentDef(owningComponent);

        // 父組件是 Root Component
        const parentInfo: ParentComponentInfo = {
            displayName: (owningComponent as object).constructor.name,
            selector: this.extractSelector(componentDef),
        };

        const domPath = this.computeDomPath(element);
        const computedStyles = this.extractComputedStyles(element);

        // 使用 tag name 作為名稱
        const tagName = element.tagName.toLowerCase();

        // 加上 id 或 class 以便識別
        let displayName = tagName;
        if (element.id) {
            displayName += `#${element.id}`;
        } else if (element.classList.length > 0) {
            displayName += `.${element.classList[0]}`;
        }

        return {
            uid: this.generateUid(),
            displayName: displayName,
            selector: tagName,
            filePath: null,
            domPath,
            inputs: {},
            outputs: [],
            publicProperties: {},
            domElement: element,
            rect: element.getBoundingClientRect(),
            computedStyles,
            directives: [],
            parent: parentInfo,
        };
    }

    /**
     * 獲取組件定義 (ɵcmp)
     */
    private getComponentDef(component: unknown): ComponentDef | null {
        const constructor = (component as object).constructor as { ɵcmp?: ComponentDef };
        return constructor.ɵcmp ?? null;
    }

    /**
     * 從組件定義提取 selector
     */
    private extractSelector(componentDef: ComponentDef | null): string {
        if (!componentDef?.selectors?.[0]) {
            return 'unknown';
        }
        // selectors 是嵌套陣列，第一個元素通常是 tag selector
        return componentDef.selectors[0].filter(Boolean).join('') || 'unknown';
    }

    /**
     * 提取 @Input 綁定的當前值
     */
    private extractInputValues(
        component: unknown,
        componentDef: ComponentDef | null
    ): Record<string, unknown> {
        const inputs: Record<string, unknown> = {};
        const inputDefs = componentDef?.inputs ?? {};

        for (const [publicName, propertyName] of Object.entries(inputDefs)) {
            const value = (component as Record<string, unknown>)[propertyName];
            // 過濾掉 undefined 值
            if (value !== undefined) {
                inputs[publicName] = this.sanitizeValue(value);
            }
        }

        return inputs;
    }

    /**
     * 提取 @Output 事件名稱
     */
    private extractOutputNames(componentDef: ComponentDef | null): string[] {
        const outputDefs = componentDef?.outputs ?? {};
        return Object.keys(outputDefs);
    }

    /**
     * 提取非 Input/Output 的公開屬性
     */
    private extractPublicProperties(
        component: unknown,
        componentDef: ComponentDef | null
    ): Record<string, unknown> {
        const properties: Record<string, unknown> = {};
        const inputProps = new Set(Object.values(componentDef?.inputs ?? {}));
        const outputProps = new Set(Object.values(componentDef?.outputs ?? {}));

        // 獲取組件實例上的所有可枚舉屬性
        for (const key of Object.keys(component as object)) {
            // 跳過 Angular 內部屬性
            if (key.startsWith('_') || key.startsWith('ɵ') || key.startsWith('ng')) {
                continue;
            }
            // 跳過 Input/Output 屬性
            if (inputProps.has(key) || outputProps.has(key)) {
                continue;
            }
            const value = (component as Record<string, unknown>)[key];
            // 跳過函數
            if (typeof value === 'function') {
                continue;
            }
            properties[key] = this.sanitizeValue(value);
        }

        return properties;
    }

    /**
     * 清理值以便序列化
     */
    private sanitizeValue(value: unknown): unknown {
        if (value === null || value === undefined) {
            return value;
        }

        // 處理函數
        if (typeof value === 'function') {
            return `[Function: ${value.name || 'anonymous'}]`;
        }

        // 處理 Observable/Subject
        if (this.isObservable(value)) {
            return `[Observable]`;
        }

        // 處理 DOM 元素
        if (value instanceof HTMLElement) {
            return `[HTMLElement: ${value.tagName.toLowerCase()}]`;
        }

        // 處理大型字串 (可能是 Base64)
        if (typeof value === 'string' && value.length > 1024) {
            return `[String: ${value.length} chars]`;
        }

        // 處理陣列
        if (Array.isArray(value)) {
            if (value.length > 10) {
                return `[Array: ${value.length} items]`;
            }
            return value.map((v) => this.sanitizeValue(v));
        }

        // 處理物件
        if (typeof value === 'object') {
            // 避免循環引用，只展開一層
            const sanitized: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(value as object)) {
                if (typeof v !== 'object' || v === null) {
                    sanitized[k] = this.sanitizeValue(v);
                } else {
                    sanitized[k] = `[Object: ${v.constructor.name}]`;
                }
            }
            return sanitized;
        }

        return value;
    }

    /**
     * 檢查是否為 RxJS Observable
     */
    private isObservable(value: unknown): boolean {
        return (
            value !== null &&
            typeof value === 'object' &&
            typeof (value as { subscribe?: unknown }).subscribe === 'function'
        );
    }

    /**
     * 獲取父組件資訊
     */
    private getParentInfo(element: HTMLElement, ng: NgGlobal): ParentComponentInfo | undefined {
        let parent = element.parentElement;
        while (parent) {
            const parentComponent = ng.getComponent(parent);
            if (parentComponent) {
                const parentDef = this.getComponentDef(parentComponent);
                return {
                    displayName: (parentComponent as object).constructor.name,
                    selector: this.extractSelector(parentDef),
                };
            }
            parent = parent.parentElement;
        }
        return undefined;
    }

    /**
     * 找到組件的 host 元素
     */
    private findComponentHost(startElement: HTMLElement, component: unknown): HTMLElement | null {
        const ng = (window as unknown as { ng: NgGlobal }).ng;
        let current: HTMLElement | null = startElement;

        while (current) {
            if (ng.getComponent(current) === component) {
                return current;
            }
            current = current.parentElement;
        }

        return null;
    }

    /**
     * 計算 DOM 路徑
     */
    private computeDomPath(element: HTMLElement): string {
        const parts: string[] = [];
        let current: HTMLElement | null = element;

        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();

            // 加上 id（如果有）
            if (current.id) {
                selector += `#${current.id}`;
            }
            // 或加上第一個 class
            else if (current.classList.length > 0) {
                selector += `.${current.classList[0]}`;
            }

            parts.unshift(selector);
            current = current.parentElement;
        }

        parts.unshift('body');
        return parts.join(' > ');
    }

    /**
     * 提取關鍵 computed styles
     */
    private extractComputedStyles(element: HTMLElement): Record<string, string> {
        const styles: Record<string, string> = {};
        const computed = window.getComputedStyle(element);

        for (const prop of KEY_COMPUTED_STYLES) {
            styles[prop] = computed.getPropertyValue(prop);
        }

        return styles;
    }

    /**
     * 生成唯一 ID
     */
    private generateUid(): string {
        this.uidCounter++;
        return `ag-${Date.now()}-${this.uidCounter}`;
    }

    /**
     * 獲取元素的祖先鏈（從當前元素到根）
     * 用於層級麵包屑導航
     *
     * @param element - 起始 DOM 元素
     * @param maxDepth - 最大深度（預設 10，避免過長）
     * @returns ComponentNode 陣列，索引 0 為當前元素，依次向上
     */
    getAncestorChain(element: HTMLElement, maxDepth = 10): ComponentNode[] {
        if (!this.isAvailable()) {
            return [];
        }

        const chain: ComponentNode[] = [];
        let current: HTMLElement | null = element;
        let depth = 0;

        while (current && current !== document.body && depth < maxDepth) {
            const node = this.getComponentNode(current);
            if (node) {
                chain.push(node);
            }

            // 尋找下一個有效的父元素
            current = current.parentElement;
            depth++;
        }

        return chain;
    }

    /**
     * 簡化版：僅獲取祖先元素的基本資訊（用於麵包屑顯示）
     * 效能更佳，不需要完整的 ComponentNode
     *
     * @param element - 起始 DOM 元素
     * @param maxDepth - 最大深度
     * @returns 簡化的祖先資訊陣列
     */
    getAncestorBreadcrumbs(element: HTMLElement, maxDepth = 10): AncestorBreadcrumb[] {
        if (!this.isAvailable()) {
            return [];
        }

        const ng = (window as unknown as { ng: NgGlobal }).ng;
        const breadcrumbs: AncestorBreadcrumb[] = [];
        let current: HTMLElement | null = element;
        let depth = 0;

        while (current && current !== document.body && depth < maxDepth) {
            const component = ng.getComponent(current);
            const owningComponent = ng.getOwningComponent(current);

            let label: string;
            let isComponent = false;

            if (component) {
                // 這是一個 Angular 組件的 host 元素
                const componentDef = this.getComponentDef(component);
                label = this.extractSelector(componentDef);
                isComponent = true;
            } else if (owningComponent) {
                // 這是組件內的普通 DOM 元素
                const tagName = current.tagName.toLowerCase();
                if (current.id) {
                    label = `${tagName}#${current.id}`;
                } else if (current.classList.length > 0) {
                    label = `${tagName}.${current.classList[0]}`;
                } else {
                    label = tagName;
                }
            } else {
                // 不屬於任何 Angular 組件
                current = current.parentElement;
                depth++;
                continue;
            }

            breadcrumbs.push({
                label,
                element: current,
                isComponent,
                depth,
            });

            current = current.parentElement;
            depth++;
        }

        return breadcrumbs;
    }
}

/**
 * 祖先麵包屑項目（輕量版）
 */
export interface AncestorBreadcrumb {
    /** 顯示標籤 */
    label: string;
    /** 對應的 DOM 元素 */
    element: HTMLElement;
    /** 是否為 Angular 組件 */
    isComponent: boolean;
    /** 深度（0 = 當前元素） */
    depth: number;
}
