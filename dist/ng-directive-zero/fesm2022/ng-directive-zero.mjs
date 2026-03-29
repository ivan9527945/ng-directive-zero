import * as i0 from '@angular/core';
import { Injectable, EventEmitter, Output, Input, Component, HostListener, HostBinding, isDevMode, NgModule } from '@angular/core';
import * as i1 from '@angular/common';
import { CommonModule } from '@angular/common';
import * as i2 from '@angular/forms';
import { FormsModule } from '@angular/forms';
import * as i1$1 from '@angular/common/http';
import { HttpClientModule } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, timer, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { v4 } from 'uuid';

/**
 * Angular Agentation - Component Node Interface
 * 定義從 DOM 元素解析出的 Angular 組件資訊結構
 */
/**
 * 需要提取的關鍵 CSS 屬性列表
 */
const KEY_COMPUTED_STYLES = [
    'display',
    'position',
    'width',
    'height',
    'padding',
    'margin',
    'background-color',
    'color',
    'font-size',
    'font-family',
    'border',
    'border-radius',
    'opacity',
    'cursor',
    'z-index',
];
/**
 * 標記顏色對應 HEX 值
 */
const MARKER_COLORS = {
    purple: '#a855f7',
    blue: '#3b82f6',
    cyan: '#06b6d4',
    green: '#22c55e',
    yellow: '#eab308',
    orange: '#f97316',
    red: '#ef4444',
};
/**
 * 預設設定
 */
const DEFAULT_SETTINGS = {
    isDarkMode: false,
    outputDetail: 'forensic',
    showAngularComponents: true,
    markerColor: 'blue',
    clearOnCopy: false,
    blockPageInteractions: false,
};

/**
 * ComponentWalkerService
 *
 * 核心服務：從 DOM 元素獲取 Angular 組件資訊
 * 使用 Angular 的 ng.getComponent() 等開發模式 API
 *
 * 效能要求：執行時間 < 16ms (1 frame)
 */
class ComponentWalkerService {
    uidCounter = 0;
    /**
     * 檢查是否在開發模式下且 ng API 可用
     */
    isAvailable() {
        return typeof window.ng?.getComponent === 'function';
    }
    /**
     * 從 DOM 元素獲取 Angular 組件節點資訊
     *
     * @param element - 目標 DOM 元素
     * @returns ComponentNode 或 null（如果不是 Angular 組件）
     */
    getComponentNode(element) {
        if (!this.isAvailable()) {
            console.warn('[ng-directive-zero] Angular debug API not available. Overlay disabled.');
            return null;
        }
        const ng = window.ng;
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
                }
                else {
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
            const displayName = component.constructor.name;
            const selector = this.extractSelector(componentDef);
            // 提取 @Input 值
            const inputs = this.extractInputValues(component, componentDef);
            // 提取 @Output 名稱
            const outputs = this.extractOutputNames(componentDef);
            // 提取公開屬性
            const publicProperties = this.extractPublicProperties(component, componentDef);
            // 獲取應用的指令
            const directives = ng.getDirectives(targetElement)
                .map((d) => d.constructor.name)
                .filter((name) => name !== 'Object');
            // 獲取父組件資訊
            const parent = this.getParentInfo(targetElement, ng);
            // 計算 DOM 路徑
            const domPath = this.computeDomPath(targetElement);
            // 獲取 computed styles
            const computedStyles = this.extractComputedStyles(targetElement);
            const node = {
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
        }
        catch (error) {
            console.error('[ng-directive-zero] Error walking component:', error);
            return null;
        }
    }
    /**
     * 創建 DOM 節點組件資訊 (用於 Root Component 內的普通元素)
     */
    createDomNode(element, owningComponent) {
        const componentDef = this.getComponentDef(owningComponent);
        // 父組件是 Root Component
        const parentInfo = {
            displayName: owningComponent.constructor.name,
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
        }
        else if (element.classList.length > 0) {
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
    getComponentDef(component) {
        const constructor = component.constructor;
        return constructor.ɵcmp ?? null;
    }
    /**
     * 從組件定義提取 selector
     */
    extractSelector(componentDef) {
        if (!componentDef?.selectors?.[0]) {
            return 'unknown';
        }
        // selectors 是嵌套陣列，第一個元素通常是 tag selector
        return componentDef.selectors[0].filter(Boolean).join('') || 'unknown';
    }
    /**
     * 提取 @Input 綁定的當前值
     */
    extractInputValues(component, componentDef) {
        const inputs = {};
        const inputDefs = componentDef?.inputs ?? {};
        for (const [publicName, propertyName] of Object.entries(inputDefs)) {
            const value = component[propertyName];
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
    extractOutputNames(componentDef) {
        const outputDefs = componentDef?.outputs ?? {};
        return Object.keys(outputDefs);
    }
    /**
     * 提取非 Input/Output 的公開屬性
     */
    extractPublicProperties(component, componentDef) {
        const properties = {};
        const inputProps = new Set(Object.values(componentDef?.inputs ?? {}));
        const outputProps = new Set(Object.values(componentDef?.outputs ?? {}));
        // 獲取組件實例上的所有可枚舉屬性
        for (const key of Object.keys(component)) {
            // 跳過 Angular 內部屬性
            if (key.startsWith('_') || key.startsWith('ɵ') || key.startsWith('ng')) {
                continue;
            }
            // 跳過 Input/Output 屬性
            if (inputProps.has(key) || outputProps.has(key)) {
                continue;
            }
            const value = component[key];
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
    sanitizeValue(value) {
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
            const sanitized = {};
            for (const [k, v] of Object.entries(value)) {
                if (typeof v !== 'object' || v === null) {
                    sanitized[k] = this.sanitizeValue(v);
                }
                else {
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
    isObservable(value) {
        return (value !== null &&
            typeof value === 'object' &&
            typeof value.subscribe === 'function');
    }
    /**
     * 獲取父組件資訊
     */
    getParentInfo(element, ng) {
        let parent = element.parentElement;
        while (parent) {
            const parentComponent = ng.getComponent(parent);
            if (parentComponent) {
                const parentDef = this.getComponentDef(parentComponent);
                return {
                    displayName: parentComponent.constructor.name,
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
    findComponentHost(startElement, component) {
        const ng = window.ng;
        let current = startElement;
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
    computeDomPath(element) {
        const parts = [];
        let current = element;
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
    extractComputedStyles(element) {
        const styles = {};
        const computed = window.getComputedStyle(element);
        for (const prop of KEY_COMPUTED_STYLES) {
            styles[prop] = computed.getPropertyValue(prop);
        }
        return styles;
    }
    /**
     * 生成唯一 ID
     */
    generateUid() {
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
    getAncestorChain(element, maxDepth = 10) {
        if (!this.isAvailable()) {
            return [];
        }
        const chain = [];
        let current = element;
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
    getAncestorBreadcrumbs(element, maxDepth = 10) {
        if (!this.isAvailable()) {
            return [];
        }
        const ng = window.ng;
        const breadcrumbs = [];
        let current = element;
        let depth = 0;
        while (current && current !== document.body && depth < maxDepth) {
            const component = ng.getComponent(current);
            const owningComponent = ng.getOwningComponent(current);
            let label;
            let isComponent = false;
            if (component) {
                // 這是一個 Angular 組件的 host 元素
                const componentDef = this.getComponentDef(component);
                label = this.extractSelector(componentDef);
                isComponent = true;
            }
            else if (owningComponent) {
                // 這是組件內的普通 DOM 元素
                const tagName = current.tagName.toLowerCase();
                if (current.id) {
                    label = `${tagName}#${current.id}`;
                }
                else if (current.classList.length > 0) {
                    label = `${tagName}.${current.classList[0]}`;
                }
                else {
                    label = tagName;
                }
            }
            else {
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: ComponentWalkerService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: ComponentWalkerService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: ComponentWalkerService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root',
                }]
        }] });

/**
 * InlineEditorComponent
 *
 * 內嵌編輯器：用於編輯已標記元素的 intent
 * 參考 React Agentation 的設計
 */
class InlineEditorComponent {
    /** 正在編輯的標記 */
    marker = null;
    /** 編輯器位置 */
    position = { top: 0, left: 0 };
    /** 儲存時觸發 */
    save = new EventEmitter();
    /** 刪除時觸發 */
    delete = new EventEmitter();
    /** 取消時觸發 */
    cancel = new EventEmitter();
    /** 暫存的 intent 值 */
    tempIntent = '';
    /** 樣式面板是否展開 */
    isStyleExpanded = false;
    ngOnChanges() {
        if (this.marker) {
            this.tempIntent = this.marker.intent || '';
        }
    }
    /** 儲存 */
    onSave() {
        if (this.marker) {
            this.save.emit({
                index: this.marker.index,
                intent: this.tempIntent,
            });
        }
    }
    /** 刪除 */
    onDelete() {
        if (this.marker) {
            this.delete.emit(this.marker.index);
        }
    }
    /** 取消 */
    onCancel() {
        this.cancel.emit();
    }
    /** 獲取編輯器樣式 */
    getEditorStyle() {
        return {
            position: 'absolute',
            top: `${this.position.top}px`,
            left: `${this.position.left}px`,
            zIndex: '999999',
        };
    }
    /** 獲取元素描述 */
    getElementDescription() {
        if (!this.marker)
            return '';
        const target = this.marker.target;
        return `${target.selector || target.displayName}`;
    }
    /** 切換樣式面板 */
    toggleStylePanel() {
        this.isStyleExpanded = !this.isStyleExpanded;
    }
    /** 獲取樣式條目 */
    getStyleEntries() {
        if (!this.marker)
            return [];
        return Object.entries(this.marker.target.computedStyles)
            .filter(([, value]) => value && value !== 'none' && value !== 'normal')
            .map(([key, value]) => ({ key, value }));
    }
    /** 格式化值為顯示字串 */
    formatValue(value) {
        if (!value)
            return '';
        // 如果值太長，截斷它
        return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: InlineEditorComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "19.2.18", type: InlineEditorComponent, isStandalone: false, selector: "ag-inline-editor", inputs: { marker: "marker", position: "position" }, outputs: { save: "save", delete: "delete", cancel: "cancel" }, usesOnChanges: true, ngImport: i0, template: "<div class=\"ag-inline-editor\" [ngStyle]=\"getEditorStyle()\">\n  <!-- \u6A19\u984C -->\n  <div class=\"ag-editor-header\">\n    <button class=\"ag-editor-title\" (click)=\"toggleStylePanel()\" title=\"Toggle styles\">\n      <svg \n        viewBox=\"0 0 24 24\" \n        fill=\"none\" \n        stroke=\"currentColor\" \n        stroke-width=\"2\"\n        [class.expanded]=\"isStyleExpanded\"\n      >\n        <polyline points=\"6 9 12 15 18 9\"></polyline>\n      </svg>\n      {{ getElementDescription() }}\n    </button>\n  </div>\n\n  <!-- \u8F38\u5165\u6846 -->\n  <div class=\"ag-editor-body\">\n    <textarea\n      class=\"ag-editor-input\"\n      [(ngModel)]=\"tempIntent\"\n      placeholder=\"Enter your feedback or intent...\"\n      rows=\"4\"\n      (keydown.ctrl.enter)=\"onSave()\"\n      (keydown.esc)=\"onCancel()\"\n      autofocus\n    ></textarea>\n  </div>\n\n  <!-- \u6A23\u5F0F\u8A73\u60C5\u5340\u584A -->\n  <div class=\"ag-editor-styles\" *ngIf=\"isStyleExpanded\">\n    <div class=\"ag-styles-header\">Computed Styles</div>\n    <div class=\"ag-styles-list\">\n      <div class=\"ag-style-item\" *ngFor=\"let style of getStyleEntries()\">\n        <span class=\"ag-style-key\">{{ style.key }}:</span>\n        <span class=\"ag-style-value\">{{ formatValue(style.value) }}</span>\n      </div>\n      <div class=\"ag-styles-empty\" *ngIf=\"getStyleEntries().length === 0\">\n        No significant styles found\n      </div>\n    </div>\n  </div>\n\n  <!-- \u64CD\u4F5C\u6309\u9215 -->\n  <div class=\"ag-editor-footer\">\n    <button class=\"ag-btn ag-btn-delete\" (click)=\"onDelete()\" title=\"Delete marker\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <polyline points=\"3 6 5 6 21 6\"></polyline>\n        <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"></path>\n      </svg>\n    </button>\n    <div class=\"ag-btn-group\">\n      <button class=\"ag-btn ag-btn-cancel\" (click)=\"onCancel()\">Cancel</button>\n      <button class=\"ag-btn ag-btn-save\" (click)=\"onSave()\">Save</button>\n    </div>\n  </div>\n</div>\n", styles: [".ag-inline-editor{width:420px;background:#12121a;border:1px solid #2a2a3a;clip-path:polygon(0 10px,10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px));font-family:JetBrains Mono,monospace;box-shadow:0 0 20px #00ff880f,0 10px 40px #000000b3;position:relative}.ag-inline-editor:before{content:\"\";position:absolute;top:0;left:10px;right:10px;height:1px;background:linear-gradient(90deg,transparent,#00ff88,transparent);pointer-events:none;z-index:1}.ag-editor-header{padding:12px 16px;border-bottom:1px solid #2a2a3a;background:#0a0a0f}.ag-editor-title{display:flex;align-items:center;gap:8px;width:100%;padding:0;border:none;background:transparent;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;text-align:left;cursor:pointer;transition:color .15s}.ag-editor-title:before{content:\">\";color:#00ff8880;font-family:Share Tech Mono,monospace}.ag-editor-title svg{width:12px;height:12px;stroke:currentColor;stroke-width:1.5;transform:rotate(-90deg);transition:transform .2s ease,stroke .15s}.ag-editor-title svg.expanded{transform:rotate(0)}.ag-editor-title:hover{color:#e0e0e0}.ag-editor-title:hover svg{stroke:#e0e0e0}.ag-editor-body{padding:14px 16px}.ag-editor-input{width:100%;padding:10px 12px;font-family:JetBrains Mono,monospace;font-size:13px;letter-spacing:.03em;color:#0f8;background:#0a0a0f;border:1px solid #2a2a3a;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));resize:vertical;box-sizing:border-box;transition:border-color .15s,box-shadow .15s}.ag-editor-input::placeholder{color:#6b728080}.ag-editor-input:focus{outline:none;border-color:#00ff8880;box-shadow:0 0 8px #00ff881a,inset 0 0 4px #00ff880a}.ag-editor-footer{display:flex;align-items:center;justify-content:space-between;padding:10px 16px 14px}.ag-btn{display:flex;align-items:center;justify-content:center;padding:7px 14px;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;border:none;background:transparent;cursor:pointer;transition:all .15s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-btn:active{transform:scale(.96)}.ag-btn-delete{width:34px;height:34px;padding:0;border:1px solid rgba(255,51,102,.25);color:#ff336680}.ag-btn-delete svg{width:16px;height:16px;stroke-width:1.5}.ag-btn-delete:hover{background:#ff33661f;border-color:#ff336680;color:#f36;box-shadow:0 0 8px #f363}.ag-btn-group{display:flex;gap:8px}.ag-btn-cancel{border:1px solid #2a2a3a;color:#6b7280}.ag-btn-cancel:hover{border-color:#6b728066;color:#e0e0e0;background:#6b72800d}.ag-btn-save{border:1px solid #00ff88;color:#0f8;text-shadow:0 0 5px rgba(0,255,136,.3)}.ag-btn-save:hover{background:#0f8;color:#0a0a0f;text-shadow:none;box-shadow:0 0 10px #0f86}.ag-editor-styles{border-top:1px solid #2a2a3a;max-height:250px;overflow:hidden;animation:slideDown .15s ease-out}@keyframes slideDown{0%{max-height:0;opacity:0}to{max-height:250px;opacity:1}}.ag-styles-header{padding:10px 16px;font-family:Share Tech Mono,monospace;font-size:10px;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:#6b7280;background:#0a0a0f;border-bottom:1px solid #2a2a3a}.ag-styles-header:before{content:\"// \";color:#0f86}.ag-styles-list{padding:8px 16px 12px;max-height:200px;overflow-y:auto}.ag-styles-list::-webkit-scrollbar{width:4px}.ag-styles-list::-webkit-scrollbar-track{background:#0a0a0f}.ag-styles-list::-webkit-scrollbar-thumb{background:#2a2a3a}.ag-style-item{display:flex;gap:8px;padding:4px 0;border-bottom:1px solid rgba(42,42,58,.4)}.ag-style-item:last-child{border-bottom:none}.ag-style-key{font-family:Share Tech Mono,monospace;font-size:11px;color:#6b7280;min-width:120px;flex-shrink:0}.ag-style-value{font-family:Share Tech Mono,monospace;font-size:11px;color:#f0f;word-break:break-word;opacity:.8}.ag-styles-empty{padding:20px 0;text-align:center;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;color:#6b728080}.ag-styles-empty:before{content:\"// \";color:#00ff884d}@media (max-width: 768px){.ag-inline-editor{position:fixed!important;inset:auto 0 0!important;width:100%!important;max-width:100vw!important;clip-path:polygon(0 10px,10px 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)!important;transform:none!important;margin:0!important;max-height:80vh;overflow-y:auto;box-shadow:0 -4px 20px #00000080;z-index:9999999!important}}\n"], dependencies: [{ kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i1.NgStyle, selector: "[ngStyle]", inputs: ["ngStyle"] }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: InlineEditorComponent, decorators: [{
            type: Component,
            args: [{ selector: 'ag-inline-editor', standalone: false, template: "<div class=\"ag-inline-editor\" [ngStyle]=\"getEditorStyle()\">\n  <!-- \u6A19\u984C -->\n  <div class=\"ag-editor-header\">\n    <button class=\"ag-editor-title\" (click)=\"toggleStylePanel()\" title=\"Toggle styles\">\n      <svg \n        viewBox=\"0 0 24 24\" \n        fill=\"none\" \n        stroke=\"currentColor\" \n        stroke-width=\"2\"\n        [class.expanded]=\"isStyleExpanded\"\n      >\n        <polyline points=\"6 9 12 15 18 9\"></polyline>\n      </svg>\n      {{ getElementDescription() }}\n    </button>\n  </div>\n\n  <!-- \u8F38\u5165\u6846 -->\n  <div class=\"ag-editor-body\">\n    <textarea\n      class=\"ag-editor-input\"\n      [(ngModel)]=\"tempIntent\"\n      placeholder=\"Enter your feedback or intent...\"\n      rows=\"4\"\n      (keydown.ctrl.enter)=\"onSave()\"\n      (keydown.esc)=\"onCancel()\"\n      autofocus\n    ></textarea>\n  </div>\n\n  <!-- \u6A23\u5F0F\u8A73\u60C5\u5340\u584A -->\n  <div class=\"ag-editor-styles\" *ngIf=\"isStyleExpanded\">\n    <div class=\"ag-styles-header\">Computed Styles</div>\n    <div class=\"ag-styles-list\">\n      <div class=\"ag-style-item\" *ngFor=\"let style of getStyleEntries()\">\n        <span class=\"ag-style-key\">{{ style.key }}:</span>\n        <span class=\"ag-style-value\">{{ formatValue(style.value) }}</span>\n      </div>\n      <div class=\"ag-styles-empty\" *ngIf=\"getStyleEntries().length === 0\">\n        No significant styles found\n      </div>\n    </div>\n  </div>\n\n  <!-- \u64CD\u4F5C\u6309\u9215 -->\n  <div class=\"ag-editor-footer\">\n    <button class=\"ag-btn ag-btn-delete\" (click)=\"onDelete()\" title=\"Delete marker\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <polyline points=\"3 6 5 6 21 6\"></polyline>\n        <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"></path>\n      </svg>\n    </button>\n    <div class=\"ag-btn-group\">\n      <button class=\"ag-btn ag-btn-cancel\" (click)=\"onCancel()\">Cancel</button>\n      <button class=\"ag-btn ag-btn-save\" (click)=\"onSave()\">Save</button>\n    </div>\n  </div>\n</div>\n", styles: [".ag-inline-editor{width:420px;background:#12121a;border:1px solid #2a2a3a;clip-path:polygon(0 10px,10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px));font-family:JetBrains Mono,monospace;box-shadow:0 0 20px #00ff880f,0 10px 40px #000000b3;position:relative}.ag-inline-editor:before{content:\"\";position:absolute;top:0;left:10px;right:10px;height:1px;background:linear-gradient(90deg,transparent,#00ff88,transparent);pointer-events:none;z-index:1}.ag-editor-header{padding:12px 16px;border-bottom:1px solid #2a2a3a;background:#0a0a0f}.ag-editor-title{display:flex;align-items:center;gap:8px;width:100%;padding:0;border:none;background:transparent;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;text-align:left;cursor:pointer;transition:color .15s}.ag-editor-title:before{content:\">\";color:#00ff8880;font-family:Share Tech Mono,monospace}.ag-editor-title svg{width:12px;height:12px;stroke:currentColor;stroke-width:1.5;transform:rotate(-90deg);transition:transform .2s ease,stroke .15s}.ag-editor-title svg.expanded{transform:rotate(0)}.ag-editor-title:hover{color:#e0e0e0}.ag-editor-title:hover svg{stroke:#e0e0e0}.ag-editor-body{padding:14px 16px}.ag-editor-input{width:100%;padding:10px 12px;font-family:JetBrains Mono,monospace;font-size:13px;letter-spacing:.03em;color:#0f8;background:#0a0a0f;border:1px solid #2a2a3a;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));resize:vertical;box-sizing:border-box;transition:border-color .15s,box-shadow .15s}.ag-editor-input::placeholder{color:#6b728080}.ag-editor-input:focus{outline:none;border-color:#00ff8880;box-shadow:0 0 8px #00ff881a,inset 0 0 4px #00ff880a}.ag-editor-footer{display:flex;align-items:center;justify-content:space-between;padding:10px 16px 14px}.ag-btn{display:flex;align-items:center;justify-content:center;padding:7px 14px;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;border:none;background:transparent;cursor:pointer;transition:all .15s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-btn:active{transform:scale(.96)}.ag-btn-delete{width:34px;height:34px;padding:0;border:1px solid rgba(255,51,102,.25);color:#ff336680}.ag-btn-delete svg{width:16px;height:16px;stroke-width:1.5}.ag-btn-delete:hover{background:#ff33661f;border-color:#ff336680;color:#f36;box-shadow:0 0 8px #f363}.ag-btn-group{display:flex;gap:8px}.ag-btn-cancel{border:1px solid #2a2a3a;color:#6b7280}.ag-btn-cancel:hover{border-color:#6b728066;color:#e0e0e0;background:#6b72800d}.ag-btn-save{border:1px solid #00ff88;color:#0f8;text-shadow:0 0 5px rgba(0,255,136,.3)}.ag-btn-save:hover{background:#0f8;color:#0a0a0f;text-shadow:none;box-shadow:0 0 10px #0f86}.ag-editor-styles{border-top:1px solid #2a2a3a;max-height:250px;overflow:hidden;animation:slideDown .15s ease-out}@keyframes slideDown{0%{max-height:0;opacity:0}to{max-height:250px;opacity:1}}.ag-styles-header{padding:10px 16px;font-family:Share Tech Mono,monospace;font-size:10px;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:#6b7280;background:#0a0a0f;border-bottom:1px solid #2a2a3a}.ag-styles-header:before{content:\"// \";color:#0f86}.ag-styles-list{padding:8px 16px 12px;max-height:200px;overflow-y:auto}.ag-styles-list::-webkit-scrollbar{width:4px}.ag-styles-list::-webkit-scrollbar-track{background:#0a0a0f}.ag-styles-list::-webkit-scrollbar-thumb{background:#2a2a3a}.ag-style-item{display:flex;gap:8px;padding:4px 0;border-bottom:1px solid rgba(42,42,58,.4)}.ag-style-item:last-child{border-bottom:none}.ag-style-key{font-family:Share Tech Mono,monospace;font-size:11px;color:#6b7280;min-width:120px;flex-shrink:0}.ag-style-value{font-family:Share Tech Mono,monospace;font-size:11px;color:#f0f;word-break:break-word;opacity:.8}.ag-styles-empty{padding:20px 0;text-align:center;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;color:#6b728080}.ag-styles-empty:before{content:\"// \";color:#00ff884d}@media (max-width: 768px){.ag-inline-editor{position:fixed!important;inset:auto 0 0!important;width:100%!important;max-width:100vw!important;clip-path:polygon(0 10px,10px 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)!important;transform:none!important;margin:0!important;max-height:80vh;overflow-y:auto;box-shadow:0 -4px 20px #00000080;z-index:9999999!important}}\n"] }]
        }], propDecorators: { marker: [{
                type: Input
            }], position: [{
                type: Input
            }], save: [{
                type: Output
            }], delete: [{
                type: Output
            }], cancel: [{
                type: Output
            }] } });

/**
 * OverlayComponent (v2)
 *
 * 支援多選標記的視覺化 DOM 檢查器
 */
class OverlayComponent {
    componentWalker;
    /** 已有的標記列表 */
    markers = [];
    /** 當前設定 */
    settings = DEFAULT_SETTINGS;
    /** 是否處於錄製模式 */
    isRecording = false;
    /** 工具列是否最小化 */
    isMinimized = false;
    /** 新增標記時觸發（多選模式） */
    markerAdded = new EventEmitter();
    /** 選中組件時觸發（兼容舊版） */
    componentSelected = new EventEmitter();
    /** 懸停組件變化時觸發 */
    componentHovered = new EventEmitter();
    /** 錄製模式變化時觸發 */
    recordingChanged = new EventEmitter();
    /** 標記被刪除時觸發 */
    markerDeleted = new EventEmitter();
    /** 高亮框樣式 */
    highlightStyle = { display: 'none' };
    /** Tooltip 內容 */
    tooltipContent = '';
    /** Tooltip 位置 */
    tooltipStyle = {};
    /** 是否顯示 tooltip */
    showTooltip = false;
    /** 當前懸停的節點 */
    hoveredNode = null;
    /** 顏色對應的 HEX 值 */
    colorHex = MARKER_COLORS;
    /** 綁定的 click handler（用於移除監聽器） */
    boundClickHandler = null;
    /** 正在編輯的標記 */
    editingMarker = null;
    /** 編輯器位置 */
    editorPosition = { top: 0, left: 0 };
    /** 祖先麵包屑列表 */
    ancestorBreadcrumbs = [];
    /** 麵包屑位置 */
    breadcrumbStyle = { display: 'none' };
    /** 當前選中的麵包屑索引 */
    selectedBreadcrumbIndex = 0;
    /** 是否顯示麵包屑 */
    showBreadcrumb = false;
    /** 是否鎖定當前選取（Click-to-lock） */
    isLocked = false;
    /** 鎖定的節點 */
    lockedNode = null;
    constructor(componentWalker) {
        this.componentWalker = componentWalker;
    }
    ngOnInit() {
        if (!this.componentWalker.isAvailable()) {
            console.warn('[ng-directive-zero] Angular debug API not available. Overlay disabled.');
        }
        // 使用 capture phase 攔截點擊事件
        this.boundClickHandler = this.onDocumentClick.bind(this);
        document.addEventListener('click', this.boundClickHandler, true);
    }
    ngOnDestroy() {
        this.stopRecording();
        if (this.boundClickHandler) {
            document.removeEventListener('click', this.boundClickHandler, true);
        }
    }
    ngOnChanges(changes) {
        if (changes['isRecording']) {
            if (this.isRecording) {
                if (this.componentWalker.isAvailable()) {
                    document.body.style.cursor = 'crosshair';
                }
            }
            else {
                this.cleanupRecording();
            }
        }
        // 當工具列最小化時，隱藏所有 overlay 元素
        if (changes['isMinimized'] && this.isMinimized) {
            this.clearHighlight();
        }
    }
    /**
     * 開始錄製模式
     */
    startRecording() {
        if (!this.componentWalker.isAvailable()) {
            console.error('[ng-directive-zero] Cannot start recording: Angular debug API not available.');
            return;
        }
        this.isRecording = true;
        this.recordingChanged.emit(true);
        document.body.style.cursor = 'crosshair';
    }
    /**
     * 停止錄製模式
     */
    stopRecording() {
        this.isRecording = false;
        this.cleanupRecording();
        this.recordingChanged.emit(false);
    }
    cleanupRecording() {
        this.hoveredNode = null;
        this.highlightStyle = { display: 'none' }; // 明確隱藏高亮框
        this.showTooltip = false;
        this.showBreadcrumb = false; // 隱藏麵包屑
        this.ancestorBreadcrumbs = [];
        this.showBreadcrumb = false; // 隱藏麵包屑
        this.ancestorBreadcrumbs = [];
        this.selectedBreadcrumbIndex = 0;
        this.isLocked = false;
        this.lockedNode = null;
        document.body.style.cursor = '';
    }
    /**
     * 切換錄製模式
     */
    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        }
        else {
            this.startRecording();
        }
    }
    /**
     * 處理滑鼠移動
     */
    onMouseMove(event) {
        if (!this.isRecording)
            return;
        if (this.isLocked)
            return; // 鎖定時停止更新懸停狀態
        let target = event.target;
        // 特殊處理：如果是我們的點擊捕捉層 (處理 disabled 元素)
        if (target.classList.contains('ag-click-overlay')) {
            target.style.display = 'none'; // 暫時隱藏
            const underlying = document.elementFromPoint(event.clientX, event.clientY);
            target.style.display = 'block'; // 恢復顯示
            if (underlying && underlying instanceof HTMLElement) {
                target = underlying;
            }
        }
        if (this.isOverlayElement(target))
            return;
        const node = this.componentWalker.getComponentNode(target);
        if (node) {
            this.hoveredNode = node;
            this.updateHighlight(node, this.settings.markerColor);
            this.updateTooltip(node, event);
            this.updateBreadcrumbs(target, event);
            this.componentHovered.emit(node);
        }
        else {
            this.clearHighlight();
        }
    }
    /**
     * 處理點擊（capture phase，優先攔截）
     */
    /**
     * 處理點擊（capture phase，優先攔截）
     */
    onDocumentClick(event) {
        if (!this.isRecording)
            return;
        let target = event.target;
        // 特殊處理：如果是我們的點擊捕捉層
        if (target.classList.contains('ag-click-overlay')) {
            target.style.display = 'none'; // 暫時隱藏
            const underlying = document.elementFromPoint(event.clientX, event.clientY);
            target.style.display = 'block'; // 恢復顯示
            if (underlying && underlying instanceof HTMLElement) {
                target = underlying;
            }
        }
        if (this.isOverlayElement(target))
            return;
        // 立即阻止事件傳播，防止觸發按鈕等元素的功能
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const node = this.componentWalker.getComponentNode(target);
        // 如果處於鎖定狀態
        if (this.isLocked) {
            // 如果點擊的是當前鎖定的節點（或其高亮範圍內），則確認標記
            // 直覺上：第二次點擊 = 確認
            if (node && this.lockedNode && this.isSameNode(node, this.lockedNode)) {
                this.confirmMarker(this.lockedNode);
                this.unlock();
            }
            else {
                // 點擊其他地方 -> 解鎖
                // 如果點擊了另一個有效節點，則立即鎖定該新節點（流暢體驗）
                this.unlock();
                if (node) {
                    this.lockNode(node, event);
                }
            }
        }
        else {
            // 未鎖定狀態 -> 第一次點擊 -> 鎖定
            if (node) {
                this.lockNode(node, event);
            }
        }
    }
    /**
     * 鎖定節點
     */
    lockNode(node, event) {
        this.isLocked = true;
        this.lockedNode = node;
        this.hoveredNode = node;
        this.updateHighlight(node, this.settings.markerColor);
        this.updateTooltip(node, event);
        this.updateBreadcrumbs(node.domElement, event);
        this.componentHovered.emit(node);
    }
    /**
     * 解鎖
     */
    unlock() {
        this.isLocked = false;
        this.lockedNode = null;
        this.clearHighlight();
    }
    /**
     * 確認新增標記
     */
    confirmMarker(node) {
        // 檢查是否已存在標記
        const existingMarker = this.markers.find(m => m.target.domElement === node.domElement);
        if (existingMarker) {
            // 顯示編輯器
            const rect = node.domElement.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            this.editorPosition = {
                top: rect.bottom + scrollTop + 10,
                left: rect.left + scrollLeft
            };
            this.editingMarker = existingMarker;
        }
        else {
            // 新增標記
            this.markerAdded.emit(node);
            this.componentSelected.emit(node);
        }
    }
    /**
     * 比較兩個節點是否相同
     */
    isSameNode(a, b) {
        return a.domElement === b.domElement;
    }
    /**
     * 處理編輯器儲存
     */
    onEditorSave(event) {
        const marker = this.markers.find(m => m.index === event.index);
        if (marker) {
            marker.intent = event.intent;
        }
        this.editingMarker = null;
    }
    /**
     * 處理編輯器刪除
     */
    onEditorDelete(index) {
        this.editingMarker = null;
        this.markerDeleted.emit(index);
    }
    /**
     * 處理編輯器取消
     */
    onEditorCancel() {
        this.editingMarker = null;
    }
    /**
     * 處理 Escape 鍵
     */
    onEscape() {
        if (this.isRecording) {
            this.stopRecording();
        }
    }
    /**
     * 處理快捷鍵 Ctrl+Shift+I
     */
    onKeyDown(event) {
        if (event.ctrlKey && event.shiftKey && event.key === 'I') {
            event.preventDefault();
            this.toggleRecording();
        }
    }
    /**
     * 處理點擊標記編號
     */
    onMarkerClick(marker, event) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.isRecording)
            return;
        const rect = marker.target.domElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        this.editorPosition = {
            top: rect.bottom + scrollTop + 10,
            left: rect.left + scrollLeft
        };
        this.editingMarker = marker;
    }
    /**
     * 獲取標記的位置樣式
     */
    getMarkerStyle(marker) {
        const element = marker.target.domElement;
        const rect = element.getBoundingClientRect();
        // 計算相對於 document 的絕對位置
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        return {
            position: 'absolute',
            top: `${rect.top + scrollTop + rect.height / 2 - 14}px`,
            left: `${rect.left + scrollLeft + rect.width - 14}px`,
            backgroundColor: this.colorHex[marker.color],
        };
    }
    /**
     * 更新高亮框
     */
    updateHighlight(node, color) {
        const rect = node.rect;
        const hex = this.colorHex[color];
        this.highlightStyle = {
            display: 'block',
            position: 'absolute',
            top: `${rect.top + window.scrollY}px`,
            left: `${rect.left + window.scrollX}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: `${hex}33`,
            border: `2px solid ${hex}`,
            pointerEvents: 'none',
            zIndex: '999998',
            transition: 'all 0.1s ease-out',
        };
    }
    /**
     * 更新 tooltip
     */
    updateTooltip(node, event) {
        this.tooltipContent = `<${node.selector}> ${node.displayName}`;
        const tooltipX = event.clientX + 12;
        const tooltipY = event.clientY + 12;
        this.tooltipStyle = {
            display: 'block',
            position: 'fixed',
            top: `${tooltipY}px`,
            left: `${tooltipX}px`,
            zIndex: '999999',
        };
        this.showTooltip = true;
    }
    /**
     * 清除高亮
     */
    clearHighlight() {
        this.highlightStyle = { display: 'none' };
        this.showTooltip = false;
        this.showBreadcrumb = false;
        this.hoveredNode = null;
        this.ancestorBreadcrumbs = [];
        this.selectedBreadcrumbIndex = 0;
        this.componentHovered.emit(null);
    }
    /**
     * 更新祖先麵包屑
     */
    updateBreadcrumbs(element, event) {
        const breadcrumbs = this.componentWalker.getAncestorBreadcrumbs(element);
        // 只有超過 1 個層級時才顯示麵包屑
        if (breadcrumbs.length > 1) {
            this.ancestorBreadcrumbs = breadcrumbs;
            this.selectedBreadcrumbIndex = 0;
            this.showBreadcrumb = true;
            // 固定在畫面頂部中間（錄製提示下方）
            const viewportWidth = window.innerWidth;
            this.breadcrumbStyle = {
                display: 'flex',
                position: 'fixed',
                top: '60px', // 在錄製提示下方
                left: '50%',
                transform: 'translateX(-50%)',
                maxWidth: `${viewportWidth - 32}px`,
                zIndex: '999999',
            };
        }
        else {
            this.showBreadcrumb = false;
            this.ancestorBreadcrumbs = [];
        }
    }
    /**
     * 處理麵包屑項目點擊
     */
    onBreadcrumbClick(breadcrumb, index, event) {
        event.preventDefault();
        event.stopPropagation();
        const node = this.componentWalker.getComponentNode(breadcrumb.element);
        if (!node)
            return;
        // 手機版優化：如果是點擊當前已選中的麵包屑 -> 確認標記
        if (this.selectedBreadcrumbIndex === index) {
            this.confirmMarker(node);
            this.unlock();
            return;
        }
        this.selectedBreadcrumbIndex = index;
        // 更新鎖定狀態到新的祖先節點
        this.isLocked = true;
        this.lockedNode = node;
        this.hoveredNode = node;
        this.updateHighlight(node, this.settings.markerColor);
        this.componentHovered.emit(node);
    }
    /**
     * 處理麵包屑項目雙擊（選取該元素）
     */
    /**
     * 處理麵包屑項目雙擊（直接選取）
     */
    onBreadcrumbDoubleClick(breadcrumb, event) {
        event.preventDefault();
        event.stopPropagation();
        const node = this.componentWalker.getComponentNode(breadcrumb.element);
        if (node) {
            this.confirmMarker(node);
            this.unlock();
        }
    }
    /**
     * 檢查是否為 overlay 元素
     */
    isOverlayElement(element) {
        return element.closest('ag-overlay') !== null ||
            element.closest('ag-annotation-panel') !== null ||
            element.closest('ag-toolbar') !== null ||
            element.closest('ag-settings-panel') !== null ||
            element.closest('ag-markers-panel') !== null;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: OverlayComponent, deps: [{ token: ComponentWalkerService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "19.2.18", type: OverlayComponent, isStandalone: false, selector: "ag-overlay", inputs: { markers: "markers", settings: "settings", isRecording: "isRecording", isMinimized: "isMinimized" }, outputs: { markerAdded: "markerAdded", componentSelected: "componentSelected", componentHovered: "componentHovered", recordingChanged: "recordingChanged", markerDeleted: "markerDeleted" }, host: { listeners: { "document:mousemove": "onMouseMove($event)", "document:keydown.escape": "onEscape()", "document:keydown": "onKeyDown($event)" } }, usesOnChanges: true, ngImport: i0, template: "<!-- \u4E92\u52D5\u6355\u6349\u5C64 (\u7528\u65BC\u8655\u7406 disabled \u5143\u7D20) -->\n<div class=\"ag-click-overlay\" *ngIf=\"isRecording && !isMinimized\"></div>\n\n<!-- \u9AD8\u4EAE\u6846 -->\n<div class=\"ag-highlight\" *ngIf=\"isRecording && !isMinimized && hoveredNode\" [ngStyle]=\"highlightStyle\"></div>\n\n<!-- Tooltip -->\n<div class=\"ag-tooltip\" *ngIf=\"showTooltip && !isMinimized\" [ngStyle]=\"tooltipStyle\">\n  {{ tooltipContent }}\n</div>\n\n<!-- \u7956\u5148\u9EB5\u5305\u5C51\u5C0E\u822A -->\n<div class=\"ag-breadcrumb\" *ngIf=\"showBreadcrumb && !isMinimized && ancestorBreadcrumbs.length > 1\"\n  [ngStyle]=\"breadcrumbStyle\">\n  <span class=\"ag-breadcrumb-hint\">\u5C64\u7D1A:</span>\n  <ng-container *ngFor=\"let crumb of ancestorBreadcrumbs; let i = index; let last = last\">\n    <button class=\"ag-breadcrumb-item\" [class.ag-breadcrumb-active]=\"i === selectedBreadcrumbIndex\"\n      [class.ag-breadcrumb-component]=\"crumb.isComponent\" (click)=\"onBreadcrumbClick(crumb, i, $event)\"\n      (dblclick)=\"onBreadcrumbDoubleClick(crumb, $event)\" [title]=\"'\u55AE\u64CA\u5207\u63DB / \u518D\u6B21\u55AE\u64CA\u78BA\u8A8D: ' + crumb.label\">\n      {{ crumb.label }}\n    </button>\n    <span class=\"ag-breadcrumb-separator\" *ngIf=\"!last\">\u203A</span>\n  </ng-container>\n  <button class=\"ag-breadcrumb-close\" (click)=\"unlock()\" title=\"\u53D6\u6D88\u9396\u5B9A\">\u2715</button>\n</div>\n\n\n<!-- \u6A19\u8A18\u7DE8\u865F\u6C23\u6CE1 -->\n<div *ngFor=\"let marker of markers\" class=\"ag-marker-bubble\" [ngStyle]=\"getMarkerStyle(marker)\"\n  (click)=\"onMarkerClick(marker, $event)\" title=\"\u9EDE\u64CA\u7DE8\u8F2F\">\n  {{ marker.index }}\n</div>\n\n<!-- \u9304\u88FD\u72C0\u614B\u63D0\u793A -->\n<div class=\"ag-recording-hint\" *ngIf=\"isRecording && !isMinimized\">\n  <div class=\"ag-hint-content\">\n    <span class=\"ag-hint-icon\">\uD83D\uDD34</span>\n    <span class=\"ag-hint-text\">Click to lock \u2022 Click again to mark \u2022 Use breadcrumb to select parent \u2022 <kbd>Esc</kbd> to\n      stop</span>\n  </div>\n</div>\n\n<!-- \u5167\u5D4C\u7DE8\u8F2F\u5668 -->\n<ag-inline-editor *ngIf=\"editingMarker && !isMinimized\" [marker]=\"editingMarker\" [position]=\"editorPosition\"\n  (save)=\"onEditorSave($event)\" (delete)=\"onEditorDelete($event)\" (cancel)=\"onEditorCancel()\"></ag-inline-editor>", styles: [".ag-click-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999990;cursor:crosshair;background:transparent;pointer-events:auto}.ag-highlight{pointer-events:none;border:1px solid #00ff88;background:#00ff880a;box-shadow:0 0 0 1px #00ff884d,0 0 10px #00ff8826,inset 0 0 10px #00ff880a}.ag-tooltip{background:#12121a;border:1px solid rgba(0,255,136,.25);color:#0f8;padding:5px 10px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;pointer-events:none;box-shadow:0 0 8px #00ff8826,0 4px 16px #00000080;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-tooltip:before{content:\"> \";color:#00ff8880}.ag-breadcrumb{display:flex;align-items:center;gap:4px;background:#12121af5;border:1px solid #2a2a3a;backdrop-filter:blur(8px);padding:5px 10px;font-family:Share Tech Mono,monospace;font-size:11px;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));box-shadow:0 4px 20px #0009,0 0 12px #00ff880f;pointer-events:auto;max-width:90vw;overflow-x:auto;flex-wrap:nowrap}.ag-breadcrumb::-webkit-scrollbar{height:3px}.ag-breadcrumb::-webkit-scrollbar-thumb{background:#0f83}.ag-breadcrumb-hint{font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#6b728099;margin-right:4px;white-space:nowrap}.ag-breadcrumb-item{background:#6b72800f;border:1px solid rgba(107,114,128,.15);color:#6b7280;padding:3px 8px;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.06em;cursor:pointer;transition:all .15s ease;white-space:nowrap;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-breadcrumb-item:hover{background:#6b72801f;border-color:#6b72804d;color:#e0e0e0}.ag-breadcrumb-item.ag-breadcrumb-active{background:#00d4ff1a;border-color:#00d4ff66;color:#00d4ff;box-shadow:0 0 6px #00d4ff33}.ag-breadcrumb-item.ag-breadcrumb-component{color:#ff00ffb3;border-color:#ff00ff26}.ag-breadcrumb-item.ag-breadcrumb-component.ag-breadcrumb-active{background:#ff00ff1a;border-color:#f0f6;color:#f0f;box-shadow:0 0 6px #f0f3}.ag-breadcrumb-separator{color:#6b72804d;font-size:12px;-webkit-user-select:none;user-select:none;font-family:Share Tech Mono,monospace}.ag-breadcrumb-close{background:transparent;border:1px solid rgba(255,51,102,.3);color:#f369;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;padding:0;line-height:1;transition:all .15s ease;margin-left:6px;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-breadcrumb-close:hover{background:#ff336626;border-color:#f36;color:#f36;box-shadow:0 0 6px #ff33664d}.ag-marker-bubble{display:flex;align-items:center;justify-content:center;width:26px;height:26px;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));color:#0a0a0f;font-family:Orbitron,monospace;font-size:10px;font-weight:700;box-shadow:0 0 8px #00000080,0 0 6px currentColor;pointer-events:auto;cursor:pointer;z-index:999997;transform:translate(-50%,-50%);animation:markerPop .2s ease-out;transition:filter .15s ease,transform .15s ease}.ag-marker-bubble:hover{transform:translate(-50%,-50%) scale(1.15);filter:brightness(1.2)}@keyframes markerPop{0%{transform:translate(-50%,-50%) scale(0) rotate(-10deg);opacity:0}60%{transform:translate(-50%,-50%) scale(1.2) rotate(3deg)}to{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1}}.ag-recording-hint{position:fixed;top:16px;left:50%;transform:translate(-50%);z-index:999999;pointer-events:none;display:none!important}@media (max-width: 768px){.ag-recording-hint{display:none!important}}.ag-hint-content{display:flex;align-items:center;gap:10px;background:#12121a;border:1px solid rgba(255,51,102,.4);color:#6b7280;padding:8px 16px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));box-shadow:0 0 12px #ff336626,0 4px 20px #00000080}.ag-hint-icon{animation:hintBlink 1s step-end infinite;filter:drop-shadow(0 0 4px #ff3366)}@keyframes hintBlink{0%,to{opacity:1}50%{opacity:.3}}.ag-hint-text kbd{display:inline-block;background:#00ff8814;border:1px solid rgba(0,255,136,.3);padding:1px 5px;font-family:Share Tech Mono,monospace;font-size:10px;color:#0f8;clip-path:polygon(0 2px,2px 0,calc(100% - 2px) 0,100% 2px,100% calc(100% - 2px),calc(100% - 2px) 100%,2px 100%,0 calc(100% - 2px))}\n"], dependencies: [{ kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i1.NgStyle, selector: "[ngStyle]", inputs: ["ngStyle"] }, { kind: "component", type: InlineEditorComponent, selector: "ag-inline-editor", inputs: ["marker", "position"], outputs: ["save", "delete", "cancel"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: OverlayComponent, decorators: [{
            type: Component,
            args: [{ selector: 'ag-overlay', standalone: false, template: "<!-- \u4E92\u52D5\u6355\u6349\u5C64 (\u7528\u65BC\u8655\u7406 disabled \u5143\u7D20) -->\n<div class=\"ag-click-overlay\" *ngIf=\"isRecording && !isMinimized\"></div>\n\n<!-- \u9AD8\u4EAE\u6846 -->\n<div class=\"ag-highlight\" *ngIf=\"isRecording && !isMinimized && hoveredNode\" [ngStyle]=\"highlightStyle\"></div>\n\n<!-- Tooltip -->\n<div class=\"ag-tooltip\" *ngIf=\"showTooltip && !isMinimized\" [ngStyle]=\"tooltipStyle\">\n  {{ tooltipContent }}\n</div>\n\n<!-- \u7956\u5148\u9EB5\u5305\u5C51\u5C0E\u822A -->\n<div class=\"ag-breadcrumb\" *ngIf=\"showBreadcrumb && !isMinimized && ancestorBreadcrumbs.length > 1\"\n  [ngStyle]=\"breadcrumbStyle\">\n  <span class=\"ag-breadcrumb-hint\">\u5C64\u7D1A:</span>\n  <ng-container *ngFor=\"let crumb of ancestorBreadcrumbs; let i = index; let last = last\">\n    <button class=\"ag-breadcrumb-item\" [class.ag-breadcrumb-active]=\"i === selectedBreadcrumbIndex\"\n      [class.ag-breadcrumb-component]=\"crumb.isComponent\" (click)=\"onBreadcrumbClick(crumb, i, $event)\"\n      (dblclick)=\"onBreadcrumbDoubleClick(crumb, $event)\" [title]=\"'\u55AE\u64CA\u5207\u63DB / \u518D\u6B21\u55AE\u64CA\u78BA\u8A8D: ' + crumb.label\">\n      {{ crumb.label }}\n    </button>\n    <span class=\"ag-breadcrumb-separator\" *ngIf=\"!last\">\u203A</span>\n  </ng-container>\n  <button class=\"ag-breadcrumb-close\" (click)=\"unlock()\" title=\"\u53D6\u6D88\u9396\u5B9A\">\u2715</button>\n</div>\n\n\n<!-- \u6A19\u8A18\u7DE8\u865F\u6C23\u6CE1 -->\n<div *ngFor=\"let marker of markers\" class=\"ag-marker-bubble\" [ngStyle]=\"getMarkerStyle(marker)\"\n  (click)=\"onMarkerClick(marker, $event)\" title=\"\u9EDE\u64CA\u7DE8\u8F2F\">\n  {{ marker.index }}\n</div>\n\n<!-- \u9304\u88FD\u72C0\u614B\u63D0\u793A -->\n<div class=\"ag-recording-hint\" *ngIf=\"isRecording && !isMinimized\">\n  <div class=\"ag-hint-content\">\n    <span class=\"ag-hint-icon\">\uD83D\uDD34</span>\n    <span class=\"ag-hint-text\">Click to lock \u2022 Click again to mark \u2022 Use breadcrumb to select parent \u2022 <kbd>Esc</kbd> to\n      stop</span>\n  </div>\n</div>\n\n<!-- \u5167\u5D4C\u7DE8\u8F2F\u5668 -->\n<ag-inline-editor *ngIf=\"editingMarker && !isMinimized\" [marker]=\"editingMarker\" [position]=\"editorPosition\"\n  (save)=\"onEditorSave($event)\" (delete)=\"onEditorDelete($event)\" (cancel)=\"onEditorCancel()\"></ag-inline-editor>", styles: [".ag-click-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999990;cursor:crosshair;background:transparent;pointer-events:auto}.ag-highlight{pointer-events:none;border:1px solid #00ff88;background:#00ff880a;box-shadow:0 0 0 1px #00ff884d,0 0 10px #00ff8826,inset 0 0 10px #00ff880a}.ag-tooltip{background:#12121a;border:1px solid rgba(0,255,136,.25);color:#0f8;padding:5px 10px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;pointer-events:none;box-shadow:0 0 8px #00ff8826,0 4px 16px #00000080;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-tooltip:before{content:\"> \";color:#00ff8880}.ag-breadcrumb{display:flex;align-items:center;gap:4px;background:#12121af5;border:1px solid #2a2a3a;backdrop-filter:blur(8px);padding:5px 10px;font-family:Share Tech Mono,monospace;font-size:11px;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));box-shadow:0 4px 20px #0009,0 0 12px #00ff880f;pointer-events:auto;max-width:90vw;overflow-x:auto;flex-wrap:nowrap}.ag-breadcrumb::-webkit-scrollbar{height:3px}.ag-breadcrumb::-webkit-scrollbar-thumb{background:#0f83}.ag-breadcrumb-hint{font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#6b728099;margin-right:4px;white-space:nowrap}.ag-breadcrumb-item{background:#6b72800f;border:1px solid rgba(107,114,128,.15);color:#6b7280;padding:3px 8px;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.06em;cursor:pointer;transition:all .15s ease;white-space:nowrap;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-breadcrumb-item:hover{background:#6b72801f;border-color:#6b72804d;color:#e0e0e0}.ag-breadcrumb-item.ag-breadcrumb-active{background:#00d4ff1a;border-color:#00d4ff66;color:#00d4ff;box-shadow:0 0 6px #00d4ff33}.ag-breadcrumb-item.ag-breadcrumb-component{color:#ff00ffb3;border-color:#ff00ff26}.ag-breadcrumb-item.ag-breadcrumb-component.ag-breadcrumb-active{background:#ff00ff1a;border-color:#f0f6;color:#f0f;box-shadow:0 0 6px #f0f3}.ag-breadcrumb-separator{color:#6b72804d;font-size:12px;-webkit-user-select:none;user-select:none;font-family:Share Tech Mono,monospace}.ag-breadcrumb-close{background:transparent;border:1px solid rgba(255,51,102,.3);color:#f369;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;padding:0;line-height:1;transition:all .15s ease;margin-left:6px;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-breadcrumb-close:hover{background:#ff336626;border-color:#f36;color:#f36;box-shadow:0 0 6px #ff33664d}.ag-marker-bubble{display:flex;align-items:center;justify-content:center;width:26px;height:26px;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));color:#0a0a0f;font-family:Orbitron,monospace;font-size:10px;font-weight:700;box-shadow:0 0 8px #00000080,0 0 6px currentColor;pointer-events:auto;cursor:pointer;z-index:999997;transform:translate(-50%,-50%);animation:markerPop .2s ease-out;transition:filter .15s ease,transform .15s ease}.ag-marker-bubble:hover{transform:translate(-50%,-50%) scale(1.15);filter:brightness(1.2)}@keyframes markerPop{0%{transform:translate(-50%,-50%) scale(0) rotate(-10deg);opacity:0}60%{transform:translate(-50%,-50%) scale(1.2) rotate(3deg)}to{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1}}.ag-recording-hint{position:fixed;top:16px;left:50%;transform:translate(-50%);z-index:999999;pointer-events:none;display:none!important}@media (max-width: 768px){.ag-recording-hint{display:none!important}}.ag-hint-content{display:flex;align-items:center;gap:10px;background:#12121a;border:1px solid rgba(255,51,102,.4);color:#6b7280;padding:8px 16px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));box-shadow:0 0 12px #ff336626,0 4px 20px #00000080}.ag-hint-icon{animation:hintBlink 1s step-end infinite;filter:drop-shadow(0 0 4px #ff3366)}@keyframes hintBlink{0%,to{opacity:1}50%{opacity:.3}}.ag-hint-text kbd{display:inline-block;background:#00ff8814;border:1px solid rgba(0,255,136,.3);padding:1px 5px;font-family:Share Tech Mono,monospace;font-size:10px;color:#0f8;clip-path:polygon(0 2px,2px 0,calc(100% - 2px) 0,100% 2px,100% calc(100% - 2px),calc(100% - 2px) 100%,2px 100%,0 calc(100% - 2px))}\n"] }]
        }], ctorParameters: () => [{ type: ComponentWalkerService }], propDecorators: { markers: [{
                type: Input
            }], settings: [{
                type: Input
            }], isRecording: [{
                type: Input
            }], isMinimized: [{
                type: Input
            }], markerAdded: [{
                type: Output
            }], componentSelected: [{
                type: Output
            }], componentHovered: [{
                type: Output
            }], recordingChanged: [{
                type: Output
            }], markerDeleted: [{
                type: Output
            }], onMouseMove: [{
                type: HostListener,
                args: ['document:mousemove', ['$event']]
            }], onEscape: [{
                type: HostListener,
                args: ['document:keydown.escape']
            }], onKeyDown: [{
                type: HostListener,
                args: ['document:keydown', ['$event']]
            }] } });

/**
 * DataSanitizerService
 *
 * 資料清洗服務：將組件資料轉換為 AI 友好的格式
 *
 * 清洗規則：
 * 1. 移除 Angular 內部屬性 (__ngContext__, ɵcmp 等)
 * 2. 將 Function 類型轉為描述字串
 * 3. 過濾 Observable/Subject（只保留類型名稱）
 * 4. 過濾大型資料（Base64 > 1KB）
 * 5. 避免循環引用
 */
class DataSanitizerService {
    /** Angular 內部屬性前綴 */
    INTERNAL_PREFIXES = ['__', 'ɵ', 'ng'];
    /** 最大字串長度 */
    MAX_STRING_LENGTH = 1024;
    /** 最大陣列長度 */
    MAX_ARRAY_LENGTH = 20;
    /** 最大物件深度 */
    MAX_DEPTH = 3;
    /**
     * 清洗單一值
     */
    sanitize(value, depth = 0) {
        // 深度限制
        if (depth > this.MAX_DEPTH) {
            return '[MaxDepthReached]';
        }
        // 處理 null/undefined
        if (value === null)
            return null;
        if (value === undefined)
            return undefined;
        // 處理原始類型
        if (typeof value === 'boolean' || typeof value === 'number') {
            return value;
        }
        // 處理字串
        if (typeof value === 'string') {
            return this.sanitizeString(value);
        }
        // 處理函數
        if (typeof value === 'function') {
            return this.sanitizeFunction(value);
        }
        // 處理 Symbol
        if (typeof value === 'symbol') {
            return `[Symbol: ${value.description ?? 'unknown'}]`;
        }
        // 處理 BigInt
        if (typeof value === 'bigint') {
            return value.toString();
        }
        // 處理陣列
        if (Array.isArray(value)) {
            return this.sanitizeArray(value, depth);
        }
        // 處理物件
        if (typeof value === 'object') {
            return this.sanitizeObject(value, depth);
        }
        return String(value);
    }
    /**
     * 清洗字串
     */
    sanitizeString(value) {
        // 檢測 Base64 圖片
        if (value.startsWith('data:image/')) {
            return '[Base64Image]';
        }
        // 檢測過長字串
        if (value.length > this.MAX_STRING_LENGTH) {
            return `[String: ${value.length} chars, truncated: "${value.substring(0, 100)}..."]`;
        }
        return value;
    }
    /**
     * 清洗函數
     */
    sanitizeFunction(fn) {
        const name = fn.name || 'anonymous';
        // 嘗試取得函數簽名
        const fnString = fn.toString();
        const argsMatch = fnString.match(/\(([^)]*)\)/);
        const args = argsMatch ? argsMatch[1] : '';
        return `[Function: ${name}(${args})]`;
    }
    /**
     * 清洗陣列
     */
    sanitizeArray(arr, depth) {
        if (arr.length === 0) {
            return [];
        }
        if (arr.length > this.MAX_ARRAY_LENGTH) {
            const sample = arr.slice(0, 5).map((item) => this.sanitize(item, depth + 1));
            return {
                __type: 'TruncatedArray',
                length: arr.length,
                sample,
            };
        }
        return arr.map((item) => this.sanitize(item, depth + 1));
    }
    /**
     * 清洗物件
     */
    sanitizeObject(obj, depth) {
        // 處理特殊物件類型
        if (this.isObservable(obj)) {
            return '[Observable]';
        }
        if (this.isSubject(obj)) {
            return '[Subject]';
        }
        if (this.isPromise(obj)) {
            return '[Promise]';
        }
        if (obj instanceof Date) {
            return obj.toISOString();
        }
        if (obj instanceof RegExp) {
            return obj.toString();
        }
        if (obj instanceof Error) {
            return `[Error: ${obj.message}]`;
        }
        if (obj instanceof HTMLElement) {
            return `[HTMLElement: <${obj.tagName.toLowerCase()}>]`;
        }
        if (obj instanceof Event) {
            return `[Event: ${obj.type}]`;
        }
        // 處理一般物件
        const result = {};
        const keys = Object.keys(obj);
        for (const key of keys) {
            // 跳過內部屬性
            if (this.isInternalProperty(key)) {
                continue;
            }
            try {
                const value = obj[key];
                result[key] = this.sanitize(value, depth + 1);
            }
            catch {
                result[key] = '[AccessDenied]';
            }
        }
        // 如果物件為空，返回類型名稱
        if (Object.keys(result).length === 0) {
            return `[Object: ${obj.constructor.name}]`;
        }
        return result;
    }
    /**
     * 檢查是否為內部屬性
     */
    isInternalProperty(key) {
        return this.INTERNAL_PREFIXES.some((prefix) => key.startsWith(prefix));
    }
    /**
     * 檢查是否為 RxJS Observable
     */
    isObservable(obj) {
        return (obj !== null &&
            typeof obj === 'object' &&
            typeof obj.subscribe === 'function' &&
            !this.isSubject(obj));
    }
    /**
     * 檢查是否為 RxJS Subject
     */
    isSubject(obj) {
        return (obj !== null &&
            typeof obj === 'object' &&
            typeof obj.next === 'function' &&
            typeof obj.subscribe === 'function');
    }
    /**
     * 檢查是否為 Promise
     */
    isPromise(obj) {
        return (obj !== null &&
            typeof obj === 'object' &&
            typeof obj.then === 'function');
    }
    /**
     * 批量清洗 Record
     */
    sanitizeRecord(record) {
        const result = {};
        for (const [key, value] of Object.entries(record)) {
            if (!this.isInternalProperty(key)) {
                result[key] = this.sanitize(value);
            }
        }
        return result;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: DataSanitizerService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: DataSanitizerService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: DataSanitizerService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root',
                }]
        }] });

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
class PromptGeneratorService {
    dataSanitizer;
    constructor(dataSanitizer) {
        this.dataSanitizer = dataSanitizer;
    }
    /**
     * 生成 Page Feedback 輸出（多標記）
     */
    generatePageFeedback(markers, options) {
        const lines = [];
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
        }
        else {
            lines.push(`## Page Feedback`);
            lines.push('');
        }
        // 各個標記
        markers.forEach((marker, index) => {
            const markerOutput = this.generateMarkerOutput(marker.target, marker.intent, index + 1, options.outputDetail);
            lines.push(markerOutput);
            lines.push('');
        });
        return lines.join('\n');
    }
    /**
     * 生成單個標記的輸出
     */
    generateMarkerOutput(node, intent, index, outputDetail) {
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
    generateCompact(node, intent, index) {
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
    generateStandard(node, intent, index) {
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
    generateDetailed(node, intent, index) {
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
    generateForensic(node, intent, index) {
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
            }
            else {
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
    generatePrompt(annotation) {
        return this.generateForensic(annotation.target, annotation.intent, 1);
    }
    /**
     * 僅生成組件資訊（舊版兼容）
     */
    generateComponentInfo(node) {
        return this.generateForensic(node, '', 1);
    }
    getPathFromUrl(url) {
        if (!url)
            return '/';
        try {
            const urlObj = new URL(url);
            return urlObj.pathname || '/';
        }
        catch {
            return '/';
        }
    }
    getElementType(node) {
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
    formatDomPath(domPath) {
        return domPath;
    }
    extractCssClasses(node) {
        const className = node.domElement.className;
        if (!className || typeof className !== 'string')
            return [];
        return className.split(' ').filter(c => c.trim());
    }
    extractKeyStyles(styles) {
        const keyProps = ['color', 'background-color', 'font-size', 'font-weight', 'display', 'position'];
        const parts = [];
        for (const prop of keyProps) {
            if (styles[prop] && styles[prop] !== 'none' && styles[prop] !== 'normal') {
                parts.push(`${prop}: ${styles[prop]}`);
            }
        }
        return parts.join('; ');
    }
    formatAllStyles(styles) {
        const parts = [];
        for (const [prop, value] of Object.entries(styles)) {
            if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
                parts.push(`${prop}: ${value}`);
            }
        }
        return parts.join('; ');
    }
    getTextContent(node) {
        const text = node.domElement.textContent?.trim() || '';
        if (text.length > 200) {
            return text.substring(0, 200) + '...';
        }
        return text;
    }
    getAccessibility(node) {
        const parts = [];
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
    getNearbyElements(node) {
        const parent = node.domElement.parentElement;
        if (!parent)
            return '';
        const siblings = Array.from(parent.children);
        const nearby = [];
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
    escapeMarkdown(text) {
        return text
            .replace(/\|/g, '\\|')
            .replace(/`/g, '\\`')
            .replace(/\*/g, '\\*')
            .replace(/\n/g, ' ');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: PromptGeneratorService, deps: [{ token: DataSanitizerService }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: PromptGeneratorService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: PromptGeneratorService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root',
                }]
        }], ctorParameters: () => [{ type: DataSanitizerService }] });

class McpService {
    http;
    API_URL = 'http://localhost:4747';
    _status = new BehaviorSubject({ connected: false });
    status$ = this._status.asObservable();
    // Store annotations state locally for UI updates
    _annotations = new BehaviorSubject([]);
    annotations$ = this._annotations.asObservable();
    constructor(http) {
        this.http = http;
        // Attempt initial connection
        this.checkConnection();
    }
    /**
     * Check if the MCP server is reachable
     */
    async checkConnection() {
        try {
            await firstValueFrom(this.http.get(`${this.API_URL}/status`));
            this.updateStatus({ connected: true, lastError: undefined });
            return true;
        }
        catch (error) {
            this.updateStatus({ connected: false, lastError: 'Could not connect to MCP server' });
            return false;
        }
    }
    /**
     * Establish a new session or restore existing one
     */
    async connect(existingSessionId) {
        if (!await this.checkConnection()) {
            throw new Error('MCP Server not reachable');
        }
        const sessionId = existingSessionId || v4();
        // Register session - simulating for now, or real call if API exists
        // In real agentation-mcp, we heavily rely on the POST /session or implicit creation
        // For now we assume we just start using a session ID.
        this.updateStatus({ connected: true, sessionId });
        this.startPolling(sessionId);
        return sessionId;
    }
    /**
     * Send an annotation to the MCP server
     */
    async sendAnnotation(annotation) {
        const currentStatus = this._status.value;
        if (!currentStatus.connected || !currentStatus.sessionId) {
            throw new Error('Not connected to MCP server');
        }
        const mcpAnnotation = {
            ...annotation,
            id: v4(),
            sessionId: currentStatus.sessionId,
            url: window.location.href,
            status: 'pending'
        };
        try {
            await firstValueFrom(this.http.post(`${this.API_URL}/annotations`, mcpAnnotation));
            // Optimistic update
            const currentList = this._annotations.value;
            this._annotations.next([...currentList, mcpAnnotation]);
        }
        catch (error) {
            console.error('Failed to send annotation', error);
            throw error;
        }
    }
    /**
     * Poll for updates (e.g., resolve/dismiss status from agent)
     */
    startPolling(sessionId) {
        // Simple polling every 2 seconds
        timer(0, 2000).pipe(switchMap(() => this.http.get(`${this.API_URL}/sessions/${sessionId}/annotations`).pipe(catchError(() => of([])) // Handle errors silently in polling
        ))).subscribe(annotations => {
            if (annotations && annotations.length > 0) {
                this._annotations.next(annotations);
            }
        });
    }
    updateStatus(newStatus) {
        this._status.next({ ...this._status.value, ...newStatus });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: McpService, deps: [{ token: i1$1.HttpClient }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: McpService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: McpService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }], ctorParameters: () => [{ type: i1$1.HttpClient }] });

class AnnotationPanelComponent {
    promptGenerator;
    mcpService;
    /** 選中的組件節點 */
    selectedNode = null;
    /** 面板關閉時觸發 */
    closed = new EventEmitter();
    /** 使用者輸入的意圖 */
    userIntent = '';
    /** 是否已複製到剪貼板 */
    copied = false;
    /** 是否已發送到 MCP */
    sent = false;
    /** 展開的區塊 */
    expandedSections = {
        inputs: true,
        outputs: true,
        properties: false,
        styles: false,
    };
    mcpStatus$;
    constructor(promptGenerator, mcpService) {
        this.promptGenerator = promptGenerator;
        this.mcpService = mcpService;
        this.mcpStatus$ = this.mcpService.status$;
    }
    /**
     * 發送標註給 Agent (MCP)
     */
    async sendToAgent() {
        if (!this.selectedNode)
            return;
        const annotation = {
            target: this.selectedNode,
            intent: this.userIntent || '(No specific intent provided)',
            timestamp: Date.now(),
        };
        try {
            await this.mcpService.sendAnnotation(annotation);
            this.sent = true;
            setTimeout(() => (this.sent = false), 2000);
        }
        catch (err) {
            console.error('[ng-directive-zero] Failed to send annotation:', err);
            // TODO: Error feedback to user
        }
    }
    /**
     * 複製 Markdown 到剪貼板
     */
    async copyToClipboard() {
        if (!this.selectedNode)
            return;
        const annotation = {
            target: this.selectedNode,
            intent: this.userIntent || '(No specific intent provided)',
            timestamp: Date.now(),
        };
        const markdown = this.promptGenerator.generatePrompt(annotation);
        try {
            await navigator.clipboard.writeText(markdown);
            this.copied = true;
            setTimeout(() => (this.copied = false), 2000);
        }
        catch (err) {
            console.error('[ng-directive-zero] Failed to copy:', err);
            // Fallback
            this.fallbackCopy(markdown);
        }
    }
    /**
     * 僅複製組件資訊（不含使用者意圖）
     */
    async copyComponentInfo() {
        if (!this.selectedNode)
            return;
        const markdown = this.promptGenerator.generateComponentInfo(this.selectedNode);
        try {
            await navigator.clipboard.writeText(markdown);
            this.copied = true;
            setTimeout(() => (this.copied = false), 2000);
        }
        catch (err) {
            console.error('[ng-directive-zero] Failed to copy:', err);
            this.fallbackCopy(markdown);
        }
    }
    /**
     * 清除選擇
     */
    clearSelection() {
        this.selectedNode = null;
        this.userIntent = '';
        this.closed.emit();
    }
    /**
     * 切換區塊展開狀態
     */
    toggleSection(section) {
        this.expandedSections[section] = !this.expandedSections[section];
    }
    /**
     * 獲取 Input 的條目
     */
    getInputEntries() {
        if (!this.selectedNode)
            return [];
        return Object.entries(this.selectedNode.inputs).map(([key, value]) => ({
            key,
            value,
        }));
    }
    /**
     * 獲取公開屬性條目
     */
    getPropertyEntries() {
        if (!this.selectedNode)
            return [];
        return Object.entries(this.selectedNode.publicProperties).map(([key, value]) => ({
            key,
            value,
        }));
    }
    /**
     * 獲取樣式條目
     */
    getStyleEntries() {
        if (!this.selectedNode)
            return [];
        return Object.entries(this.selectedNode.computedStyles)
            .filter(([, value]) => value && value !== 'none' && value !== 'normal')
            .map(([key, value]) => ({ key, value }));
    }
    /**
     * 格式化值為顯示字串
     */
    formatValue(value) {
        if (value === null)
            return 'null';
        if (value === undefined)
            return 'undefined';
        if (typeof value === 'string')
            return `"${value}"`;
        if (typeof value === 'object')
            return JSON.stringify(value);
        return String(value);
    }
    /**
     * 獲取值的類型顏色
     */
    getValueColor(value) {
        if (value === null || value === undefined)
            return '#808080';
        if (typeof value === 'string')
            return '#98c379';
        if (typeof value === 'number')
            return '#d19a66';
        if (typeof value === 'boolean')
            return '#56b6c2';
        return '#abb2bf';
    }
    /**
     * Fallback 複製方式
     */
    fallbackCopy(text) {
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: AnnotationPanelComponent, deps: [{ token: PromptGeneratorService }, { token: McpService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "19.2.18", type: AnnotationPanelComponent, isStandalone: false, selector: "ag-annotation-panel", inputs: { selectedNode: "selectedNode" }, outputs: { closed: "closed" }, ngImport: i0, template: "<div class=\"ag-panel\" *ngIf=\"selectedNode\">\n  <!-- \u6A19\u984C\u5217 -->\n  <header class=\"ag-panel-header\">\n    <div class=\"ag-panel-title\">\n      <span class=\"ag-component-icon\">\uD83D\uDCE6</span>\n      <span class=\"ag-component-name\">{{ selectedNode.displayName }}</span>\n    </div>\n    <button class=\"ag-close-button\" (click)=\"clearSelection()\" title=\"Close (Esc)\">\n      <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <path d=\"M18 6L6 18M6 6l12 12\"/>\n      </svg>\n    </button>\n  </header>\n\n  <!-- \u7D44\u4EF6\u57FA\u672C\u8CC7\u8A0A -->\n  <section class=\"ag-section ag-info-section\">\n    <div class=\"ag-info-row\">\n      <span class=\"ag-info-label\">Selector</span>\n      <code class=\"ag-info-value\">&lt;{{ selectedNode.selector }}&gt;</code>\n    </div>\n    <div class=\"ag-info-row\" *ngIf=\"selectedNode.parent\">\n      <span class=\"ag-info-label\">Parent</span>\n      <code class=\"ag-info-value\">{{ selectedNode.parent.displayName }}</code>\n    </div>\n    <div class=\"ag-info-row\" *ngIf=\"selectedNode.directives.length > 0\">\n      <span class=\"ag-info-label\">Directives</span>\n      <div class=\"ag-directive-list\">\n        <span class=\"ag-directive-tag\" *ngFor=\"let dir of selectedNode.directives\">{{ dir }}</span>\n      </div>\n    </div>\n  </section>\n\n  <!-- @Input \u7D81\u5B9A -->\n  <section class=\"ag-section\">\n    <header class=\"ag-section-header\" (click)=\"toggleSection('inputs')\">\n      <span class=\"ag-section-icon\">{{ expandedSections.inputs ? '\u25BC' : '\u25B6' }}</span>\n      <span class=\"ag-section-title\">&#64;Input Bindings</span>\n      <span class=\"ag-section-count\">{{ getInputEntries().length }}</span>\n    </header>\n    <div class=\"ag-section-content\" *ngIf=\"expandedSections.inputs && getInputEntries().length > 0\">\n      <div class=\"ag-prop-row\" *ngFor=\"let entry of getInputEntries()\">\n        <span class=\"ag-prop-name\">{{ entry.key }}</span>\n        <span class=\"ag-prop-value\" [style.color]=\"getValueColor(entry.value)\">\n          {{ formatValue(entry.value) }}\n        </span>\n      </div>\n    </div>\n    <div class=\"ag-section-empty\" *ngIf=\"expandedSections.inputs && getInputEntries().length === 0\">\n      No &#64;Input bindings\n    </div>\n  </section>\n\n  <!-- @Output \u4E8B\u4EF6 -->\n  <section class=\"ag-section\" *ngIf=\"selectedNode.outputs.length > 0\">\n    <header class=\"ag-section-header\" (click)=\"toggleSection('outputs')\">\n      <span class=\"ag-section-icon\">{{ expandedSections.outputs ? '\u25BC' : '\u25B6' }}</span>\n      <span class=\"ag-section-title\">&#64;Output Events</span>\n      <span class=\"ag-section-count\">{{ selectedNode.outputs.length }}</span>\n    </header>\n    <div class=\"ag-section-content\" *ngIf=\"expandedSections.outputs\">\n      <div class=\"ag-output-row\" *ngFor=\"let output of selectedNode.outputs\">\n        <span class=\"ag-output-name\">{{ output }}</span>\n        <span class=\"ag-output-type\">EventEmitter</span>\n      </div>\n    </div>\n  </section>\n\n  <!-- \u516C\u958B\u5C6C\u6027 -->\n  <section class=\"ag-section\" *ngIf=\"getPropertyEntries().length > 0\">\n    <header class=\"ag-section-header\" (click)=\"toggleSection('properties')\">\n      <span class=\"ag-section-icon\">{{ expandedSections.properties ? '\u25BC' : '\u25B6' }}</span>\n      <span class=\"ag-section-title\">Public Properties</span>\n      <span class=\"ag-section-count\">{{ getPropertyEntries().length }}</span>\n    </header>\n    <div class=\"ag-section-content\" *ngIf=\"expandedSections.properties\">\n      <div class=\"ag-prop-row\" *ngFor=\"let entry of getPropertyEntries()\">\n        <span class=\"ag-prop-name\">{{ entry.key }}</span>\n        <span class=\"ag-prop-value\" [style.color]=\"getValueColor(entry.value)\">\n          {{ formatValue(entry.value) }}\n        </span>\n      </div>\n    </div>\n  </section>\n\n  <!-- Computed Styles -->\n  <section class=\"ag-section\">\n    <header class=\"ag-section-header\" (click)=\"toggleSection('styles')\">\n      <span class=\"ag-section-icon\">{{ expandedSections.styles ? '\u25BC' : '\u25B6' }}</span>\n      <span class=\"ag-section-title\">Computed Styles</span>\n      <span class=\"ag-section-count\">{{ getStyleEntries().length }}</span>\n    </header>\n    <div class=\"ag-section-content\" *ngIf=\"expandedSections.styles\">\n      <div class=\"ag-style-row\" *ngFor=\"let entry of getStyleEntries()\">\n        <span class=\"ag-style-name\">{{ entry.key }}</span>\n        <span class=\"ag-style-value\">{{ entry.value }}</span>\n      </div>\n    </div>\n  </section>\n\n  <!-- \u4F7F\u7528\u8005\u610F\u5716\u8F38\u5165 -->\n  <section class=\"ag-section ag-intent-section\">\n    <label class=\"ag-intent-label\" for=\"userIntent\">\n      \uD83D\uDCAC Your Instruction for AI\n    </label>\n    <textarea\n      id=\"userIntent\"\n      class=\"ag-intent-input\"\n      [(ngModel)]=\"userIntent\"\n      placeholder=\"e.g., 'This button should be disabled when loading'\"\n      rows=\"3\"\n    ></textarea>\n  </section>\n\n  <!-- \u64CD\u4F5C\u6309\u9215 -->\n  <footer class=\"ag-panel-footer\">\n    <!-- MCP Send Button -->\n    <button\n      *ngIf=\"(mcpStatus$ | async)?.connected\"\n      class=\"ag-button ag-button-primary ag-mcp-button\"\n      (click)=\"sendToAgent()\"\n      [class.ag-button-success]=\"sent\"\n    >\n      <span *ngIf=\"!sent\">\uD83E\uDD16 Send to Agent</span>\n      <span *ngIf=\"sent\">\u2705 Sent!</span>\n    </button>\n\n    <button\n      class=\"ag-button ag-button-primary\"\n      (click)=\"copyToClipboard()\"\n      [class.ag-button-success]=\"copied\"\n    >\n      <span *ngIf=\"!copied\">\uD83D\uDCCB Copy with Intent</span>\n      <span *ngIf=\"copied\">\u2705 Copied!</span>\n    </button>\n    <button\n      class=\"ag-button ag-button-secondary\"\n      (click)=\"copyComponentInfo()\"\n    >\n      \uD83D\uDCC4 Copy Info Only\n    </button>\n  </footer>\n</div>\n", styles: ["@charset \"UTF-8\";:host{display:block}.ag-panel{position:fixed;top:20px;right:20px;width:380px;max-height:calc(100vh - 40px);background:#0a0a0f;border:1px solid #2a2a3a;clip-path:polygon(0 12px,12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px));font-family:JetBrains Mono,Fira Code,monospace;font-size:12px;color:#e0e0e0;overflow:hidden;display:flex;flex-direction:column;z-index:999999;animation:slideInRight .15s ease-out;box-shadow:0 0 20px #00ff8814,0 8px 32px #0009}.ag-panel:before{content:\"\";position:absolute;top:0;left:12px;right:12px;height:1px;background:linear-gradient(90deg,transparent,#00ff88,transparent);z-index:1}@keyframes slideInRight{0%{opacity:0;transform:translate(16px)}to{opacity:1;transform:translate(0)}}.ag-panel-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#12121a;border-bottom:1px solid #2a2a3a;flex-shrink:0;position:relative}.ag-panel-header:before{content:\"\\25cf  \\25cf  \\25cf\";position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:7px;letter-spacing:3px;color:transparent;text-shadow:0 0 0 #ff3366,8px 0 0 #f59e0b,16px 0 0 #00ff88;pointer-events:none}.ag-panel-title{display:flex;align-items:center;gap:8px;padding-left:36px}.ag-component-icon{font-size:14px}.ag-component-name{font-family:Share Tech Mono,monospace;font-size:13px;font-weight:600;color:#0f8;letter-spacing:.05em;text-shadow:0 0 6px rgba(0,255,136,.4)}.ag-close-button{display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:transparent;border:1px solid rgba(255,51,102,.3);color:#6b7280;cursor:pointer;transition:all .15s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-close-button svg{width:13px;height:13px}.ag-close-button:hover{background:#ff336626;border-color:#f36;color:#f36;box-shadow:0 0 6px #ff33664d}.ag-section{border-bottom:1px solid #2a2a3a;flex-shrink:0}.ag-section:last-of-type{border-bottom:none}.ag-info-section{padding:10px 16px;background:#0f0f18}.ag-info-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:7px}.ag-info-row:last-child{margin-bottom:0}.ag-info-label{flex-shrink:0;width:66px;color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.ag-info-value{font-family:Share Tech Mono,monospace;font-size:12px;color:#00d4ff;background:#00d4ff0f;border:1px solid rgba(0,212,255,.15);padding:1px 6px;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-directive-list{display:flex;flex-wrap:wrap;gap:4px}.ag-directive-tag{background:#ff00ff14;border:1px solid rgba(255,0,255,.2);color:#f0f;padding:1px 7px;font-size:10px;font-family:Share Tech Mono,monospace;letter-spacing:.05em;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-section-header{display:flex;align-items:center;gap:8px;padding:9px 16px;background:#12121a;cursor:pointer;-webkit-user-select:none;user-select:none;transition:background .1s}.ag-section-header:hover{background:#1c1c2e}.ag-section-icon{font-size:9px;color:#00ff8880;width:12px}.ag-section-title{flex:1;font-family:Share Tech Mono,monospace;font-size:11px;font-weight:400;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}.ag-section-count{background:#00ff8814;border:1px solid rgba(0,255,136,.2);color:#0f8;padding:1px 7px;font-size:10px;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-section-content{padding:6px 16px 10px;max-height:180px;overflow-y:auto}.ag-section-content::-webkit-scrollbar{width:4px}.ag-section-content::-webkit-scrollbar-track{background:#0a0a0f}.ag-section-content::-webkit-scrollbar-thumb{background:#2a2a3a}.ag-section-empty{padding:10px 16px;color:#6b7280;font-size:11px;letter-spacing:.05em}.ag-section-empty:before{content:\"// \";color:#00ff884d}.ag-prop-row,.ag-output-row,.ag-style-row{display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid rgba(42,42,58,.5)}.ag-prop-row:last-child,.ag-output-row:last-child,.ag-style-row:last-child{border-bottom:none}.ag-prop-name,.ag-output-name,.ag-style-name{font-family:Share Tech Mono,monospace;font-size:11px;color:#6b7280}.ag-prop-name:before,.ag-output-name:before,.ag-style-name:before{content:\".\";color:#0f86}.ag-prop-value,.ag-style-value{font-family:Share Tech Mono,monospace;font-size:11px;max-width:200px;word-break:break-all;text-align:right}.ag-output-type{font-size:10px;color:#6b7280;background:#ff00ff0f;border:1px solid rgba(255,0,255,.15);color:#ff00ffb3;padding:1px 6px;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-intent-section{padding:12px 16px;background:#0f0f18}.ag-intent-label{display:block;margin-bottom:8px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}.ag-intent-label:before{content:\"$ \";color:#0f8}.ag-intent-input{width:100%;padding:9px 12px;background:#12121a;border:1px solid #2a2a3a;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));color:#0f8;font-family:JetBrains Mono,monospace;font-size:12px;letter-spacing:.03em;resize:vertical;transition:border-color .15s,box-shadow .15s}.ag-intent-input::placeholder{color:#6b728080}.ag-intent-input:focus{outline:none;border-color:#00ff8880;box-shadow:0 0 8px #00ff881f,inset 0 0 4px #00ff880a}.ag-panel-footer{display:flex;gap:8px;padding:12px 16px;background:#12121a;border-top:1px solid #2a2a3a;flex-shrink:0}.ag-button{flex:1;padding:9px 12px;border:none;background:transparent;font-family:Share Tech Mono,monospace;font-size:11px;font-weight:400;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:all .15s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-button:active{transform:scale(.97)}.ag-button-primary{border:1px solid #00ff88;color:#0f8;text-shadow:0 0 5px rgba(0,255,136,.3)}.ag-button-primary:hover{background:#0f8;color:#0a0a0f;text-shadow:none;box-shadow:0 0 10px #0f86}.ag-button-success{background:#00ff881a;border:1px solid #00ff88;color:#0f8;box-shadow:0 0 8px #0f83}.ag-button-secondary{border:1px solid #2a2a3a;color:#6b7280}.ag-button-secondary:hover{border-color:#6b728066;color:#e0e0e0;background:#6b72800d}.ag-mcp-button{border:1px solid #f59e0b;color:#f59e0b;text-shadow:0 0 5px rgba(245,158,11,.3)}.ag-mcp-button:hover{background:#f59e0b;color:#0a0a0f;text-shadow:none;box-shadow:0 0 10px #f59e0b66}.ag-mcp-button.ag-button-success{border-color:#0f8;color:#0f8;background:#00ff881a;text-shadow:none}\n"], dependencies: [{ kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "pipe", type: i1.AsyncPipe, name: "async" }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: AnnotationPanelComponent, decorators: [{
            type: Component,
            args: [{ selector: 'ag-annotation-panel', standalone: false, template: "<div class=\"ag-panel\" *ngIf=\"selectedNode\">\n  <!-- \u6A19\u984C\u5217 -->\n  <header class=\"ag-panel-header\">\n    <div class=\"ag-panel-title\">\n      <span class=\"ag-component-icon\">\uD83D\uDCE6</span>\n      <span class=\"ag-component-name\">{{ selectedNode.displayName }}</span>\n    </div>\n    <button class=\"ag-close-button\" (click)=\"clearSelection()\" title=\"Close (Esc)\">\n      <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <path d=\"M18 6L6 18M6 6l12 12\"/>\n      </svg>\n    </button>\n  </header>\n\n  <!-- \u7D44\u4EF6\u57FA\u672C\u8CC7\u8A0A -->\n  <section class=\"ag-section ag-info-section\">\n    <div class=\"ag-info-row\">\n      <span class=\"ag-info-label\">Selector</span>\n      <code class=\"ag-info-value\">&lt;{{ selectedNode.selector }}&gt;</code>\n    </div>\n    <div class=\"ag-info-row\" *ngIf=\"selectedNode.parent\">\n      <span class=\"ag-info-label\">Parent</span>\n      <code class=\"ag-info-value\">{{ selectedNode.parent.displayName }}</code>\n    </div>\n    <div class=\"ag-info-row\" *ngIf=\"selectedNode.directives.length > 0\">\n      <span class=\"ag-info-label\">Directives</span>\n      <div class=\"ag-directive-list\">\n        <span class=\"ag-directive-tag\" *ngFor=\"let dir of selectedNode.directives\">{{ dir }}</span>\n      </div>\n    </div>\n  </section>\n\n  <!-- @Input \u7D81\u5B9A -->\n  <section class=\"ag-section\">\n    <header class=\"ag-section-header\" (click)=\"toggleSection('inputs')\">\n      <span class=\"ag-section-icon\">{{ expandedSections.inputs ? '\u25BC' : '\u25B6' }}</span>\n      <span class=\"ag-section-title\">&#64;Input Bindings</span>\n      <span class=\"ag-section-count\">{{ getInputEntries().length }}</span>\n    </header>\n    <div class=\"ag-section-content\" *ngIf=\"expandedSections.inputs && getInputEntries().length > 0\">\n      <div class=\"ag-prop-row\" *ngFor=\"let entry of getInputEntries()\">\n        <span class=\"ag-prop-name\">{{ entry.key }}</span>\n        <span class=\"ag-prop-value\" [style.color]=\"getValueColor(entry.value)\">\n          {{ formatValue(entry.value) }}\n        </span>\n      </div>\n    </div>\n    <div class=\"ag-section-empty\" *ngIf=\"expandedSections.inputs && getInputEntries().length === 0\">\n      No &#64;Input bindings\n    </div>\n  </section>\n\n  <!-- @Output \u4E8B\u4EF6 -->\n  <section class=\"ag-section\" *ngIf=\"selectedNode.outputs.length > 0\">\n    <header class=\"ag-section-header\" (click)=\"toggleSection('outputs')\">\n      <span class=\"ag-section-icon\">{{ expandedSections.outputs ? '\u25BC' : '\u25B6' }}</span>\n      <span class=\"ag-section-title\">&#64;Output Events</span>\n      <span class=\"ag-section-count\">{{ selectedNode.outputs.length }}</span>\n    </header>\n    <div class=\"ag-section-content\" *ngIf=\"expandedSections.outputs\">\n      <div class=\"ag-output-row\" *ngFor=\"let output of selectedNode.outputs\">\n        <span class=\"ag-output-name\">{{ output }}</span>\n        <span class=\"ag-output-type\">EventEmitter</span>\n      </div>\n    </div>\n  </section>\n\n  <!-- \u516C\u958B\u5C6C\u6027 -->\n  <section class=\"ag-section\" *ngIf=\"getPropertyEntries().length > 0\">\n    <header class=\"ag-section-header\" (click)=\"toggleSection('properties')\">\n      <span class=\"ag-section-icon\">{{ expandedSections.properties ? '\u25BC' : '\u25B6' }}</span>\n      <span class=\"ag-section-title\">Public Properties</span>\n      <span class=\"ag-section-count\">{{ getPropertyEntries().length }}</span>\n    </header>\n    <div class=\"ag-section-content\" *ngIf=\"expandedSections.properties\">\n      <div class=\"ag-prop-row\" *ngFor=\"let entry of getPropertyEntries()\">\n        <span class=\"ag-prop-name\">{{ entry.key }}</span>\n        <span class=\"ag-prop-value\" [style.color]=\"getValueColor(entry.value)\">\n          {{ formatValue(entry.value) }}\n        </span>\n      </div>\n    </div>\n  </section>\n\n  <!-- Computed Styles -->\n  <section class=\"ag-section\">\n    <header class=\"ag-section-header\" (click)=\"toggleSection('styles')\">\n      <span class=\"ag-section-icon\">{{ expandedSections.styles ? '\u25BC' : '\u25B6' }}</span>\n      <span class=\"ag-section-title\">Computed Styles</span>\n      <span class=\"ag-section-count\">{{ getStyleEntries().length }}</span>\n    </header>\n    <div class=\"ag-section-content\" *ngIf=\"expandedSections.styles\">\n      <div class=\"ag-style-row\" *ngFor=\"let entry of getStyleEntries()\">\n        <span class=\"ag-style-name\">{{ entry.key }}</span>\n        <span class=\"ag-style-value\">{{ entry.value }}</span>\n      </div>\n    </div>\n  </section>\n\n  <!-- \u4F7F\u7528\u8005\u610F\u5716\u8F38\u5165 -->\n  <section class=\"ag-section ag-intent-section\">\n    <label class=\"ag-intent-label\" for=\"userIntent\">\n      \uD83D\uDCAC Your Instruction for AI\n    </label>\n    <textarea\n      id=\"userIntent\"\n      class=\"ag-intent-input\"\n      [(ngModel)]=\"userIntent\"\n      placeholder=\"e.g., 'This button should be disabled when loading'\"\n      rows=\"3\"\n    ></textarea>\n  </section>\n\n  <!-- \u64CD\u4F5C\u6309\u9215 -->\n  <footer class=\"ag-panel-footer\">\n    <!-- MCP Send Button -->\n    <button\n      *ngIf=\"(mcpStatus$ | async)?.connected\"\n      class=\"ag-button ag-button-primary ag-mcp-button\"\n      (click)=\"sendToAgent()\"\n      [class.ag-button-success]=\"sent\"\n    >\n      <span *ngIf=\"!sent\">\uD83E\uDD16 Send to Agent</span>\n      <span *ngIf=\"sent\">\u2705 Sent!</span>\n    </button>\n\n    <button\n      class=\"ag-button ag-button-primary\"\n      (click)=\"copyToClipboard()\"\n      [class.ag-button-success]=\"copied\"\n    >\n      <span *ngIf=\"!copied\">\uD83D\uDCCB Copy with Intent</span>\n      <span *ngIf=\"copied\">\u2705 Copied!</span>\n    </button>\n    <button\n      class=\"ag-button ag-button-secondary\"\n      (click)=\"copyComponentInfo()\"\n    >\n      \uD83D\uDCC4 Copy Info Only\n    </button>\n  </footer>\n</div>\n", styles: ["@charset \"UTF-8\";:host{display:block}.ag-panel{position:fixed;top:20px;right:20px;width:380px;max-height:calc(100vh - 40px);background:#0a0a0f;border:1px solid #2a2a3a;clip-path:polygon(0 12px,12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px));font-family:JetBrains Mono,Fira Code,monospace;font-size:12px;color:#e0e0e0;overflow:hidden;display:flex;flex-direction:column;z-index:999999;animation:slideInRight .15s ease-out;box-shadow:0 0 20px #00ff8814,0 8px 32px #0009}.ag-panel:before{content:\"\";position:absolute;top:0;left:12px;right:12px;height:1px;background:linear-gradient(90deg,transparent,#00ff88,transparent);z-index:1}@keyframes slideInRight{0%{opacity:0;transform:translate(16px)}to{opacity:1;transform:translate(0)}}.ag-panel-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#12121a;border-bottom:1px solid #2a2a3a;flex-shrink:0;position:relative}.ag-panel-header:before{content:\"\\25cf  \\25cf  \\25cf\";position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:7px;letter-spacing:3px;color:transparent;text-shadow:0 0 0 #ff3366,8px 0 0 #f59e0b,16px 0 0 #00ff88;pointer-events:none}.ag-panel-title{display:flex;align-items:center;gap:8px;padding-left:36px}.ag-component-icon{font-size:14px}.ag-component-name{font-family:Share Tech Mono,monospace;font-size:13px;font-weight:600;color:#0f8;letter-spacing:.05em;text-shadow:0 0 6px rgba(0,255,136,.4)}.ag-close-button{display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:transparent;border:1px solid rgba(255,51,102,.3);color:#6b7280;cursor:pointer;transition:all .15s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-close-button svg{width:13px;height:13px}.ag-close-button:hover{background:#ff336626;border-color:#f36;color:#f36;box-shadow:0 0 6px #ff33664d}.ag-section{border-bottom:1px solid #2a2a3a;flex-shrink:0}.ag-section:last-of-type{border-bottom:none}.ag-info-section{padding:10px 16px;background:#0f0f18}.ag-info-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:7px}.ag-info-row:last-child{margin-bottom:0}.ag-info-label{flex-shrink:0;width:66px;color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.ag-info-value{font-family:Share Tech Mono,monospace;font-size:12px;color:#00d4ff;background:#00d4ff0f;border:1px solid rgba(0,212,255,.15);padding:1px 6px;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-directive-list{display:flex;flex-wrap:wrap;gap:4px}.ag-directive-tag{background:#ff00ff14;border:1px solid rgba(255,0,255,.2);color:#f0f;padding:1px 7px;font-size:10px;font-family:Share Tech Mono,monospace;letter-spacing:.05em;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-section-header{display:flex;align-items:center;gap:8px;padding:9px 16px;background:#12121a;cursor:pointer;-webkit-user-select:none;user-select:none;transition:background .1s}.ag-section-header:hover{background:#1c1c2e}.ag-section-icon{font-size:9px;color:#00ff8880;width:12px}.ag-section-title{flex:1;font-family:Share Tech Mono,monospace;font-size:11px;font-weight:400;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}.ag-section-count{background:#00ff8814;border:1px solid rgba(0,255,136,.2);color:#0f8;padding:1px 7px;font-size:10px;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-section-content{padding:6px 16px 10px;max-height:180px;overflow-y:auto}.ag-section-content::-webkit-scrollbar{width:4px}.ag-section-content::-webkit-scrollbar-track{background:#0a0a0f}.ag-section-content::-webkit-scrollbar-thumb{background:#2a2a3a}.ag-section-empty{padding:10px 16px;color:#6b7280;font-size:11px;letter-spacing:.05em}.ag-section-empty:before{content:\"// \";color:#00ff884d}.ag-prop-row,.ag-output-row,.ag-style-row{display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid rgba(42,42,58,.5)}.ag-prop-row:last-child,.ag-output-row:last-child,.ag-style-row:last-child{border-bottom:none}.ag-prop-name,.ag-output-name,.ag-style-name{font-family:Share Tech Mono,monospace;font-size:11px;color:#6b7280}.ag-prop-name:before,.ag-output-name:before,.ag-style-name:before{content:\".\";color:#0f86}.ag-prop-value,.ag-style-value{font-family:Share Tech Mono,monospace;font-size:11px;max-width:200px;word-break:break-all;text-align:right}.ag-output-type{font-size:10px;color:#6b7280;background:#ff00ff0f;border:1px solid rgba(255,0,255,.15);color:#ff00ffb3;padding:1px 6px;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-intent-section{padding:12px 16px;background:#0f0f18}.ag-intent-label{display:block;margin-bottom:8px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}.ag-intent-label:before{content:\"$ \";color:#0f8}.ag-intent-input{width:100%;padding:9px 12px;background:#12121a;border:1px solid #2a2a3a;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));color:#0f8;font-family:JetBrains Mono,monospace;font-size:12px;letter-spacing:.03em;resize:vertical;transition:border-color .15s,box-shadow .15s}.ag-intent-input::placeholder{color:#6b728080}.ag-intent-input:focus{outline:none;border-color:#00ff8880;box-shadow:0 0 8px #00ff881f,inset 0 0 4px #00ff880a}.ag-panel-footer{display:flex;gap:8px;padding:12px 16px;background:#12121a;border-top:1px solid #2a2a3a;flex-shrink:0}.ag-button{flex:1;padding:9px 12px;border:none;background:transparent;font-family:Share Tech Mono,monospace;font-size:11px;font-weight:400;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:all .15s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-button:active{transform:scale(.97)}.ag-button-primary{border:1px solid #00ff88;color:#0f8;text-shadow:0 0 5px rgba(0,255,136,.3)}.ag-button-primary:hover{background:#0f8;color:#0a0a0f;text-shadow:none;box-shadow:0 0 10px #0f86}.ag-button-success{background:#00ff881a;border:1px solid #00ff88;color:#0f8;box-shadow:0 0 8px #0f83}.ag-button-secondary{border:1px solid #2a2a3a;color:#6b7280}.ag-button-secondary:hover{border-color:#6b728066;color:#e0e0e0;background:#6b72800d}.ag-mcp-button{border:1px solid #f59e0b;color:#f59e0b;text-shadow:0 0 5px rgba(245,158,11,.3)}.ag-mcp-button:hover{background:#f59e0b;color:#0a0a0f;text-shadow:none;box-shadow:0 0 10px #f59e0b66}.ag-mcp-button.ag-button-success{border-color:#0f8;color:#0f8;background:#00ff881a;text-shadow:none}\n"] }]
        }], ctorParameters: () => [{ type: PromptGeneratorService }, { type: McpService }], propDecorators: { selectedNode: [{
                type: Input
            }], closed: [{
                type: Output
            }] } });

/**
 * ToolbarComponent
 *
 * 浮動工具列：提供錄製控制、檢視、複製、設定等功能
 */
class ToolbarComponent {
    /** 當前錄製會話 */
    session = null;
    /** 當前設定 */
    settings = DEFAULT_SETTINGS;
    /** 綁定 dark mode class 到 host */
    get isDarkMode() {
        return this.settings.isDarkMode;
    }
    /** 工具列狀態 */
    state = {
        showSettings: false,
        showMarkers: false,
        isRecording: false,
        isMinimized: false,
    };
    /** 開始錄製 */
    startRecording = new EventEmitter();
    /** 結束錄製 */
    stopRecording = new EventEmitter();
    /** 切換檢視標記列表 */
    toggleMarkers = new EventEmitter();
    /** 複製到剪貼簿 */
    copyToClipboard = new EventEmitter();
    /** 清除所有標記 */
    clearMarkers = new EventEmitter();
    /** 切換設定面板 */
    toggleSettings = new EventEmitter();
    /** 關閉工具 */
    closeToolbar = new EventEmitter();
    /** 切換最小化狀態 */
    toggleMinimize = new EventEmitter();
    /** 設定變更 */
    settingsChange = new EventEmitter();
    /** 標記數量 */
    get markerCount() {
        return this.session?.markers.length ?? 0;
    }
    /** 是否有標記 */
    get hasMarkers() {
        return this.markerCount > 0;
    }
    /** 切換錄製狀態 */
    onToggleRecording() {
        if (this.state.isRecording) {
            this.stopRecording.emit();
        }
        else {
            this.startRecording.emit();
        }
    }
    /** 處理複製 */
    onCopy() {
        if (this.hasMarkers) {
            this.copyToClipboard.emit();
        }
    }
    /** 處理清除 */
    onClear() {
        if (this.hasMarkers) {
            this.clearMarkers.emit();
        }
    }
    /** 處理設定切換 */
    onToggleSettings() {
        this.toggleSettings.emit();
    }
    /** 處理標記列表切換 */
    onToggleMarkers() {
        this.toggleMarkers.emit();
    }
    /** 處理關閉 */
    onClose() {
        this.closeToolbar.emit();
    }
    /** 處理最小化切換 */
    onToggleMinimize() {
        this.toggleMinimize.emit();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: ToolbarComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "19.2.18", type: ToolbarComponent, isStandalone: false, selector: "ag-toolbar", inputs: { session: "session", settings: "settings", state: "state" }, outputs: { startRecording: "startRecording", stopRecording: "stopRecording", toggleMarkers: "toggleMarkers", copyToClipboard: "copyToClipboard", clearMarkers: "clearMarkers", toggleSettings: "toggleSettings", closeToolbar: "closeToolbar", toggleMinimize: "toggleMinimize", settingsChange: "settingsChange" }, host: { properties: { "class.ag-dark-mode": "this.isDarkMode" } }, ngImport: i0, template: "<div class=\"ag-toolbar\" [class.collapsed]=\"state.isMinimized\" [class.recording]=\"state.isRecording\">\n  <!-- \u6536\u5408\u72C0\u614B\uFF1A\u986F\u793A\u5C55\u958B\u6309\u9215 -->\n  <button\n    *ngIf=\"state.isMinimized\"\n    class=\"ag-toolbar-btn ag-btn-expand\"\n    (click)=\"onToggleMinimize()\"\n    title=\"Expand Toolbar\"\n  >\n    <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n      <!-- \u4E09\u6A6B\u7DDA + \u83F1\u5F62\u5716\u6A19 -->\n      <line x1=\"4\" y1=\"6\" x2=\"14\" y2=\"6\"/>\n      <line x1=\"4\" y1=\"12\" x2=\"14\" y2=\"12\"/>\n      <line x1=\"4\" y1=\"18\" x2=\"14\" y2=\"18\"/>\n      <path d=\"M17 9l3 3-3 3\" fill=\"none\"/>\n    </svg>\n  </button>\n\n  <!-- \u5C55\u958B\u72C0\u614B\uFF1A\u986F\u793A\u5B8C\u6574\u5DE5\u5177\u5217 -->\n  <ng-container *ngIf=\"!state.isMinimized\">\n    <!-- \u6A19\u8A18\u8A08\u6578\u5FBD\u7AE0 -->\n    <div class=\"ag-marker-badge\" *ngIf=\"hasMarkers\">\n      {{ markerCount }}\n    </div>\n\n    <!-- \u4E3B\u5DE5\u5177\u5217 -->\n    <div class=\"ag-toolbar-buttons\">\n      <!-- \u9304\u88FD\u6309\u9215 -->\n      <button\n        class=\"ag-toolbar-btn ag-btn-record\"\n        [class.active]=\"state.isRecording\"\n        (click)=\"onToggleRecording()\"\n        [title]=\"state.isRecording ? 'Stop Recording' : 'Start Recording'\"\n      >\n        <svg *ngIf=\"!state.isRecording\" viewBox=\"0 0 24 24\" fill=\"currentColor\">\n          <path d=\"M8 5v14l11-7z\"/>\n        </svg>\n        <svg *ngIf=\"state.isRecording\" viewBox=\"0 0 24 24\" fill=\"currentColor\">\n          <rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"2\"/>\n        </svg>\n      </button>\n\n      <!-- \u6AA2\u8996\u6A19\u8A18 -->\n      <button\n        class=\"ag-toolbar-btn\"\n        [class.active]=\"state.showMarkers\"\n        [disabled]=\"!hasMarkers\"\n        (click)=\"onToggleMarkers()\"\n        title=\"View Markers\"\n      >\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <circle cx=\"12\" cy=\"12\" r=\"3\"/>\n          <path d=\"M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z\"/>\n        </svg>\n      </button>\n\n      <!-- \u8907\u88FD -->\n      <button\n        class=\"ag-toolbar-btn\"\n        [disabled]=\"!hasMarkers\"\n        (click)=\"onCopy()\"\n        title=\"Copy to Clipboard\"\n      >\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\" ry=\"2\"/>\n          <path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/>\n        </svg>\n      </button>\n\n      <!-- \u6E05\u9664 -->\n      <button\n        class=\"ag-toolbar-btn\"\n        [disabled]=\"!hasMarkers\"\n        (click)=\"onClear()\"\n        title=\"Clear Markers\"\n      >\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <polyline points=\"3 6 5 6 21 6\"/>\n          <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>\n        </svg>\n      </button>\n\n      <!-- \u5206\u9694\u7DDA -->\n      <div class=\"ag-toolbar-divider\"></div>\n\n      <!-- \u8A2D\u5B9A -->\n      <!-- <button\n        class=\"ag-toolbar-btn\"\n        [class.active]=\"state.showSettings\"\n        (click)=\"onToggleSettings()\"\n        title=\"Settings\"\n      >\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <circle cx=\"12\" cy=\"12\" r=\"3\"/>\n          <path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z\"/>\n        </svg>\n      </button> -->\n\n      <!-- \u6536\u5408\u6309\u9215 -->\n      <button\n        class=\"ag-toolbar-btn ag-btn-collapse\"\n        (click)=\"onToggleMinimize()\"\n        title=\"Collapse Toolbar\"\n      >\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <line x1=\"4\" y1=\"6\" x2=\"14\" y2=\"6\"/>\n          <line x1=\"4\" y1=\"12\" x2=\"14\" y2=\"12\"/>\n          <line x1=\"4\" y1=\"18\" x2=\"14\" y2=\"18\"/>\n          <path d=\"M20 9l-3 3 3 3\"/>\n        </svg>\n      </button>\n    </div>\n  </ng-container>\n\n  <!-- Settings Panel -->\n  <!-- <ag-settings-panel\n    *ngIf=\"state.showSettings\"\n    [settings]=\"settings\"\n    (settingsChange)=\"settingsChange.emit($event)\"\n    (closed)=\"onToggleSettings()\"\n  ></ag-settings-panel> -->\n</div>\n", styles: [".ag-toolbar{position:fixed;bottom:24px;right:24px;z-index:999999;display:flex;align-items:center;gap:6px;background:#12121a;border:1px solid #2a2a3a;padding:8px 12px;clip-path:polygon(0 12px,12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px));transition:border-color .3s,box-shadow .3s}.ag-toolbar:before{content:\"\";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,255,136,.03) 0%,transparent 100%)}.ag-toolbar.recording{border-color:#f369;animation:recordingPulse 2s ease-in-out infinite}.ag-toolbar.collapsed{padding:0;clip-path:polygon(0 8px,8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px));width:48px;height:48px;justify-content:center;border-color:#00ff884d;box-shadow:0 0 8px #00ff8826}.ag-toolbar.collapsed .ag-toolbar-buttons,.ag-toolbar.collapsed .ag-marker-badge{display:none}.ag-marker-badge{position:absolute;top:-8px;left:-8px;min-width:20px;height:20px;padding:0 5px;display:flex;align-items:center;justify-content:center;background:#0f8;color:#0a0a0f;font-family:Orbitron,monospace;font-size:10px;font-weight:700;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px));box-shadow:0 0 8px #0f89}.ag-toolbar-buttons{display:flex;align-items:center;gap:2px}.ag-toolbar-btn{display:flex;align-items:center;justify-content:center;width:38px;height:38px;padding:0;border:1px solid transparent;background:transparent;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px));color:#6b7280;cursor:pointer;transition:all .15s ease}.ag-toolbar-btn svg{width:18px;height:18px;stroke-width:1.5}.ag-toolbar-btn:hover:not(:disabled){background:#00ff8814;border-color:#0f83;color:#0f8;filter:drop-shadow(0 0 4px rgba(0,255,136,.4))}.ag-toolbar-btn:active:not(:disabled){transform:scale(.93)}.ag-toolbar-btn:disabled{color:#6b72804d;cursor:not-allowed}.ag-toolbar-btn.active{background:#00ff881a;border-color:#00ff884d;color:#0f8;box-shadow:inset 0 0 6px #00ff881a}.ag-btn-expand{width:48px;height:48px}.ag-btn-expand:hover:not(:disabled){background:#00ff8814}.ag-btn-record.active{background:#ff33661a;border-color:#f366;color:#f36}.ag-btn-record.active svg{animation:recordBlink 1s step-end infinite;filter:drop-shadow(0 0 4px #ff3366)}.ag-toolbar-divider{width:1px;height:22px;background:#2a2a3a;margin:0 4px}@keyframes recordBlink{0%,to{opacity:1}50%{opacity:.4}}@keyframes recordingPulse{0%,to{box-shadow:0 0 5px #f36,0 0 15px #ff336640,0 0 0 1px #f366}50%{box-shadow:0 0 12px #f36,0 0 25px #f366,0 0 0 1px #f36}}\n"], dependencies: [{ kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: ToolbarComponent, decorators: [{
            type: Component,
            args: [{ selector: 'ag-toolbar', standalone: false, template: "<div class=\"ag-toolbar\" [class.collapsed]=\"state.isMinimized\" [class.recording]=\"state.isRecording\">\n  <!-- \u6536\u5408\u72C0\u614B\uFF1A\u986F\u793A\u5C55\u958B\u6309\u9215 -->\n  <button\n    *ngIf=\"state.isMinimized\"\n    class=\"ag-toolbar-btn ag-btn-expand\"\n    (click)=\"onToggleMinimize()\"\n    title=\"Expand Toolbar\"\n  >\n    <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n      <!-- \u4E09\u6A6B\u7DDA + \u83F1\u5F62\u5716\u6A19 -->\n      <line x1=\"4\" y1=\"6\" x2=\"14\" y2=\"6\"/>\n      <line x1=\"4\" y1=\"12\" x2=\"14\" y2=\"12\"/>\n      <line x1=\"4\" y1=\"18\" x2=\"14\" y2=\"18\"/>\n      <path d=\"M17 9l3 3-3 3\" fill=\"none\"/>\n    </svg>\n  </button>\n\n  <!-- \u5C55\u958B\u72C0\u614B\uFF1A\u986F\u793A\u5B8C\u6574\u5DE5\u5177\u5217 -->\n  <ng-container *ngIf=\"!state.isMinimized\">\n    <!-- \u6A19\u8A18\u8A08\u6578\u5FBD\u7AE0 -->\n    <div class=\"ag-marker-badge\" *ngIf=\"hasMarkers\">\n      {{ markerCount }}\n    </div>\n\n    <!-- \u4E3B\u5DE5\u5177\u5217 -->\n    <div class=\"ag-toolbar-buttons\">\n      <!-- \u9304\u88FD\u6309\u9215 -->\n      <button\n        class=\"ag-toolbar-btn ag-btn-record\"\n        [class.active]=\"state.isRecording\"\n        (click)=\"onToggleRecording()\"\n        [title]=\"state.isRecording ? 'Stop Recording' : 'Start Recording'\"\n      >\n        <svg *ngIf=\"!state.isRecording\" viewBox=\"0 0 24 24\" fill=\"currentColor\">\n          <path d=\"M8 5v14l11-7z\"/>\n        </svg>\n        <svg *ngIf=\"state.isRecording\" viewBox=\"0 0 24 24\" fill=\"currentColor\">\n          <rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"2\"/>\n        </svg>\n      </button>\n\n      <!-- \u6AA2\u8996\u6A19\u8A18 -->\n      <button\n        class=\"ag-toolbar-btn\"\n        [class.active]=\"state.showMarkers\"\n        [disabled]=\"!hasMarkers\"\n        (click)=\"onToggleMarkers()\"\n        title=\"View Markers\"\n      >\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <circle cx=\"12\" cy=\"12\" r=\"3\"/>\n          <path d=\"M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z\"/>\n        </svg>\n      </button>\n\n      <!-- \u8907\u88FD -->\n      <button\n        class=\"ag-toolbar-btn\"\n        [disabled]=\"!hasMarkers\"\n        (click)=\"onCopy()\"\n        title=\"Copy to Clipboard\"\n      >\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\" ry=\"2\"/>\n          <path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/>\n        </svg>\n      </button>\n\n      <!-- \u6E05\u9664 -->\n      <button\n        class=\"ag-toolbar-btn\"\n        [disabled]=\"!hasMarkers\"\n        (click)=\"onClear()\"\n        title=\"Clear Markers\"\n      >\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <polyline points=\"3 6 5 6 21 6\"/>\n          <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>\n        </svg>\n      </button>\n\n      <!-- \u5206\u9694\u7DDA -->\n      <div class=\"ag-toolbar-divider\"></div>\n\n      <!-- \u8A2D\u5B9A -->\n      <!-- <button\n        class=\"ag-toolbar-btn\"\n        [class.active]=\"state.showSettings\"\n        (click)=\"onToggleSettings()\"\n        title=\"Settings\"\n      >\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <circle cx=\"12\" cy=\"12\" r=\"3\"/>\n          <path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z\"/>\n        </svg>\n      </button> -->\n\n      <!-- \u6536\u5408\u6309\u9215 -->\n      <button\n        class=\"ag-toolbar-btn ag-btn-collapse\"\n        (click)=\"onToggleMinimize()\"\n        title=\"Collapse Toolbar\"\n      >\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <line x1=\"4\" y1=\"6\" x2=\"14\" y2=\"6\"/>\n          <line x1=\"4\" y1=\"12\" x2=\"14\" y2=\"12\"/>\n          <line x1=\"4\" y1=\"18\" x2=\"14\" y2=\"18\"/>\n          <path d=\"M20 9l-3 3 3 3\"/>\n        </svg>\n      </button>\n    </div>\n  </ng-container>\n\n  <!-- Settings Panel -->\n  <!-- <ag-settings-panel\n    *ngIf=\"state.showSettings\"\n    [settings]=\"settings\"\n    (settingsChange)=\"settingsChange.emit($event)\"\n    (closed)=\"onToggleSettings()\"\n  ></ag-settings-panel> -->\n</div>\n", styles: [".ag-toolbar{position:fixed;bottom:24px;right:24px;z-index:999999;display:flex;align-items:center;gap:6px;background:#12121a;border:1px solid #2a2a3a;padding:8px 12px;clip-path:polygon(0 12px,12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px));transition:border-color .3s,box-shadow .3s}.ag-toolbar:before{content:\"\";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,255,136,.03) 0%,transparent 100%)}.ag-toolbar.recording{border-color:#f369;animation:recordingPulse 2s ease-in-out infinite}.ag-toolbar.collapsed{padding:0;clip-path:polygon(0 8px,8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px));width:48px;height:48px;justify-content:center;border-color:#00ff884d;box-shadow:0 0 8px #00ff8826}.ag-toolbar.collapsed .ag-toolbar-buttons,.ag-toolbar.collapsed .ag-marker-badge{display:none}.ag-marker-badge{position:absolute;top:-8px;left:-8px;min-width:20px;height:20px;padding:0 5px;display:flex;align-items:center;justify-content:center;background:#0f8;color:#0a0a0f;font-family:Orbitron,monospace;font-size:10px;font-weight:700;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px));box-shadow:0 0 8px #0f89}.ag-toolbar-buttons{display:flex;align-items:center;gap:2px}.ag-toolbar-btn{display:flex;align-items:center;justify-content:center;width:38px;height:38px;padding:0;border:1px solid transparent;background:transparent;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px));color:#6b7280;cursor:pointer;transition:all .15s ease}.ag-toolbar-btn svg{width:18px;height:18px;stroke-width:1.5}.ag-toolbar-btn:hover:not(:disabled){background:#00ff8814;border-color:#0f83;color:#0f8;filter:drop-shadow(0 0 4px rgba(0,255,136,.4))}.ag-toolbar-btn:active:not(:disabled){transform:scale(.93)}.ag-toolbar-btn:disabled{color:#6b72804d;cursor:not-allowed}.ag-toolbar-btn.active{background:#00ff881a;border-color:#00ff884d;color:#0f8;box-shadow:inset 0 0 6px #00ff881a}.ag-btn-expand{width:48px;height:48px}.ag-btn-expand:hover:not(:disabled){background:#00ff8814}.ag-btn-record.active{background:#ff33661a;border-color:#f366;color:#f36}.ag-btn-record.active svg{animation:recordBlink 1s step-end infinite;filter:drop-shadow(0 0 4px #ff3366)}.ag-toolbar-divider{width:1px;height:22px;background:#2a2a3a;margin:0 4px}@keyframes recordBlink{0%,to{opacity:1}50%{opacity:.4}}@keyframes recordingPulse{0%,to{box-shadow:0 0 5px #f36,0 0 15px #ff336640,0 0 0 1px #f366}50%{box-shadow:0 0 12px #f36,0 0 25px #f366,0 0 0 1px #f36}}\n"] }]
        }], propDecorators: { session: [{
                type: Input
            }], settings: [{
                type: Input
            }], isDarkMode: [{
                type: HostBinding,
                args: ['class.ag-dark-mode']
            }], state: [{
                type: Input
            }], startRecording: [{
                type: Output
            }], stopRecording: [{
                type: Output
            }], toggleMarkers: [{
                type: Output
            }], copyToClipboard: [{
                type: Output
            }], clearMarkers: [{
                type: Output
            }], toggleSettings: [{
                type: Output
            }], closeToolbar: [{
                type: Output
            }], toggleMinimize: [{
                type: Output
            }], settingsChange: [{
                type: Output
            }] } });

/**
 * SettingsPanelComponent
 *
 * 設定面板：顏色選擇、輸出詳細程度、選項開關等
 */
class SettingsPanelComponent {
    mcpService;
    /** 當前設定 */
    settings = DEFAULT_SETTINGS;
    /** 綁定 dark mode class 到 host */
    get isDarkMode() {
        return this.settings.isDarkMode;
    }
    /** 面板關閉時觸發 */
    closed = new EventEmitter();
    /** 設定變更時觸發 */
    settingsChange = new EventEmitter();
    mcpStatus$;
    constructor(mcpService) {
        this.mcpService = mcpService;
        this.mcpStatus$ = this.mcpService.status$;
    }
    connectMcp() {
        this.mcpService.connect();
    }
    /** 可用顏色列表 */
    colors = ['purple', 'blue', 'cyan', 'green', 'yellow', 'orange', 'red'];
    /** 顏色對應的 HEX 值 */
    colorHex = MARKER_COLORS;
    /** 輸出詳細程度選項 */
    outputOptions = ['compact', 'standard', 'detailed', 'forensic'];
    /** 選擇顏色 */
    selectColor(color) {
        this.updateSettings({ markerColor: color });
    }
    /** 選擇輸出詳細程度 */
    selectOutputDetail(detail) {
        this.updateSettings({ outputDetail: detail });
    }
    /** 切換 Angular 組件顯示 */
    toggleAngularComponents() {
        this.updateSettings({ showAngularComponents: !this.settings.showAngularComponents });
    }
    /** 切換複製後清除 */
    toggleClearOnCopy() {
        this.updateSettings({ clearOnCopy: !this.settings.clearOnCopy });
    }
    /** 切換阻止頁面互動 */
    toggleBlockInteractions() {
        this.updateSettings({ blockPageInteractions: !this.settings.blockPageInteractions });
    }
    /** 切換主題（深色/淺色） */
    toggleTheme() {
        this.updateSettings({ isDarkMode: !this.settings.isDarkMode });
    }
    /** 關閉面板 */
    close() {
        this.closed.emit();
    }
    /** 更新設定 */
    updateSettings(partial) {
        this.settings = { ...this.settings, ...partial };
        this.settingsChange.emit(this.settings);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: SettingsPanelComponent, deps: [{ token: McpService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "19.2.18", type: SettingsPanelComponent, isStandalone: false, selector: "ag-settings-panel", inputs: { settings: "settings" }, outputs: { closed: "closed", settingsChange: "settingsChange" }, host: { properties: { "class.ag-dark-mode": "this.isDarkMode" } }, ngImport: i0, template: "<div class=\"ag-settings-panel\">\n  <!-- \u6A19\u984C -->\n  <header class=\"ag-settings-header\">\n    <div class=\"ag-settings-title\">\n      <span class=\"ag-logo\">/agentation</span>\n      <span class=\"ag-version\">v1.0.0</span>\n    </div>\n    <button class=\"ag-theme-toggle\" title=\"Toggle Theme\" (click)=\"toggleTheme()\">\n      <!-- \u6708\u4EAE\u5716\u793A (light mode) -->\n      <svg *ngIf=\"!settings.isDarkMode\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <path d=\"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z\"/>\n      </svg>\n      <!-- \u592A\u967D\u5716\u793A (dark mode) -->\n      <svg *ngIf=\"settings.isDarkMode\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <circle cx=\"12\" cy=\"12\" r=\"5\"/>\n        <line x1=\"12\" y1=\"1\" x2=\"12\" y2=\"3\"/>\n        <line x1=\"12\" y1=\"21\" x2=\"12\" y2=\"23\"/>\n        <line x1=\"4.22\" y1=\"4.22\" x2=\"5.64\" y2=\"5.64\"/>\n        <line x1=\"18.36\" y1=\"18.36\" x2=\"19.78\" y2=\"19.78\"/>\n        <line x1=\"1\" y1=\"12\" x2=\"3\" y2=\"12\"/>\n        <line x1=\"21\" y1=\"12\" x2=\"23\" y2=\"12\"/>\n        <line x1=\"4.22\" y1=\"19.78\" x2=\"5.64\" y2=\"18.36\"/>\n        <line x1=\"18.36\" y1=\"5.64\" x2=\"19.78\" y2=\"4.22\"/>\n      </svg>\n    </button>\n  </header>\n\n  <!-- \u8F38\u51FA\u8A73\u7D30\u7A0B\u5EA6 -->\n  <section class=\"ag-settings-section\">\n    <div class=\"ag-settings-row\">\n      <label class=\"ag-settings-label\">\n        Output Detail\n        <span class=\"ag-help-icon\" title=\"Level of detail in the generated output\">?</span>\n      </label>\n      <div class=\"ag-dropdown\">\n        <select\n          [value]=\"settings.outputDetail\"\n          (change)=\"selectOutputDetail($any($event.target).value)\"\n        >\n          <option value=\"compact\">Compact</option>\n          <option value=\"standard\">Standard</option>\n          <option value=\"detailed\">Detailed</option>\n          <option value=\"forensic\">Forensic</option>\n        </select>\n      </div>\n    </div>\n  </section>\n\n  <!-- Angular \u7D44\u4EF6\u958B\u95DC -->\n  <!-- <section class=\"ag-settings-section\">\n    <div class=\"ag-settings-row\">\n      <label class=\"ag-settings-label\">\n        Angular Components\n        <span class=\"ag-help-icon\" title=\"Include Angular component metadata in output\">?</span>\n      </label>\n      <label class=\"ag-toggle\">\n        <input\n          type=\"checkbox\"\n          [checked]=\"settings.showAngularComponents\"\n          (change)=\"toggleAngularComponents()\"\n        />\n        <span class=\"ag-toggle-slider\"></span>\n      </label>\n    </div>\n  </section> -->\n\n  <!-- \u6A19\u8A18\u984F\u8272 -->\n  <section class=\"ag-settings-section\">\n    <label class=\"ag-settings-label\">Marker Colour</label>\n    <div class=\"ag-color-picker\">\n      <button\n        *ngFor=\"let color of colors\"\n        class=\"ag-color-option\"\n        [class.selected]=\"settings.markerColor === color\"\n        [style.background-color]=\"colorHex[color]\"\n        (click)=\"selectColor(color)\"\n        [title]=\"color\"\n      ></button>\n    </div>\n  </section>\n\n  <!-- \u5176\u4ED6\u9078\u9805 -->\n  <section class=\"ag-settings-section ag-options-section\">\n    <label class=\"ag-checkbox-row\">\n      <input\n        type=\"checkbox\"\n        [checked]=\"settings.clearOnCopy\"\n        (change)=\"toggleClearOnCopy()\"\n      />\n      <span>Clear on copy/send</span>\n      <span class=\"ag-help-icon\" title=\"Clear markers after copying to clipboard\">?</span>\n    </label>\n\n    <!-- <label class=\"ag-checkbox-row\">\n      <input\n        type=\"checkbox\"\n        [checked]=\"settings.blockPageInteractions\"\n        (change)=\"toggleBlockInteractions()\"\n      />\n      <span>Block page interactions</span>\n    </label> -->\n  </section>\n\n  <!-- MCP & Webhooks \u9023\u7D50 -->\n  <!-- <section class=\"ag-settings-section ag-link-section\">\n    <a href=\"javascript:void(0)\" class=\"ag-settings-link\">\n      Manage MCP &amp; Webhooks\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <polyline points=\"9 18 15 12 9 6\"/>\n      </svg>\n    </a>\n  </section> -->\n</div>\n", styles: ["@charset \"UTF-8\";.ag-settings-panel{position:absolute;bottom:calc(100% + 12px);right:0;left:auto;transform:none;z-index:999998;width:320px;background:#12121a;border:1px solid #2a2a3a;clip-path:polygon(0 10px,10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px));font-family:JetBrains Mono,monospace;box-shadow:0 0 20px #00ff880f,0 10px 40px #000000b3}.ag-settings-panel:before{content:\"\";position:absolute;top:0;left:10px;right:10px;height:1px;background:linear-gradient(90deg,transparent,#00ff88,transparent);pointer-events:none}.ag-settings-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #2a2a3a;background:#0a0a0f;position:relative}.ag-settings-header:before{content:\"\\25cf  \\25cf  \\25cf\";position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:7px;letter-spacing:3px;color:transparent;text-shadow:0 0 0 #ff3366,8px 0 0 #f59e0b,16px 0 0 #00ff88;pointer-events:none}.ag-settings-title{display:flex;align-items:baseline;gap:8px;padding-left:36px}.ag-logo{font-family:Orbitron,monospace;font-size:13px;font-weight:700;letter-spacing:.1em;color:#0f8;text-shadow:0 0 6px rgba(0,255,136,.4)}.ag-version{font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.1em;color:#6b7280}.ag-theme-toggle{display:flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid rgba(0,255,136,.2);background:transparent;color:#6b7280;cursor:pointer;transition:all .15s ease;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-theme-toggle svg{width:16px;height:16px;stroke-width:1.5}.ag-theme-toggle:hover{background:#00ff8814;border-color:#0f86;color:#0f8;filter:drop-shadow(0 0 4px rgba(0,255,136,.4))}.ag-settings-section{padding:14px 18px;border-bottom:1px solid #2a2a3a}.ag-settings-section:last-child{border-bottom:none}.ag-settings-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.ag-settings-label{display:flex;align-items:center;gap:6px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280}.ag-help-icon{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;font-size:9px;font-family:Orbitron,monospace;color:#00ff8880;border:1px solid rgba(0,255,136,.2);clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px));cursor:help}.ag-dropdown select{padding:6px 28px 6px 10px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;color:#0f8;background:#0a0a0f;border:1px solid rgba(0,255,136,.25);clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px));cursor:pointer;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2300ff88' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 8px center;transition:border-color .15s,box-shadow .15s}.ag-dropdown select:focus{outline:none;border-color:#00ff8880;box-shadow:0 0 6px #00ff881f}.ag-dropdown select option{background:#12121a;color:#e0e0e0}.ag-toggle{position:relative;display:inline-block;width:40px;height:22px}.ag-toggle input{opacity:0;width:0;height:0}.ag-toggle-slider{position:absolute;cursor:pointer;inset:0;background:#1c1c2e;border:1px solid #2a2a3a;transition:.2s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-toggle-slider:before{position:absolute;content:\"\";height:14px;width:14px;left:3px;bottom:3px;background:#6b7280;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px));transition:.2s}input:checked+.ag-toggle-slider{background:#00ff881a;border-color:#0f86;box-shadow:0 0 6px #0f83}input:checked+.ag-toggle-slider:before{transform:translate(18px);background:#0f8;box-shadow:0 0 4px #00ff8880}.ag-color-picker{display:flex;gap:8px;margin-top:10px}.ag-color-option{width:28px;height:28px;padding:0;border:2px solid transparent;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));cursor:pointer;transition:all .15s ease;position:relative}.ag-color-option:hover{filter:brightness(1.2);transform:scale(1.1)}.ag-color-option.selected{border-color:#e0e0e0;box-shadow:0 0 8px #ffffff4d}.ag-options-section{display:flex;flex-direction:column;gap:10px}.ag-checkbox-row{display:flex;align-items:center;gap:10px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;cursor:pointer;transition:color .15s}.ag-checkbox-row:hover{color:#e0e0e0}.ag-checkbox-row input[type=checkbox]{width:16px;height:16px;accent-color:#00ff88;cursor:pointer}.ag-link-section{padding:12px 18px}.ag-settings-link{display:flex;align-items:center;justify-content:space-between;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;text-decoration:none;transition:color .15s}.ag-settings-link svg{width:14px;height:14px;color:#6b728080}.ag-settings-link:hover{color:#0f8}.ag-settings-link:hover svg{color:#0f8}.ag-status-indicator{display:flex;align-items:center;gap:8px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;padding:6px 10px;background:#0a0a0f;border:1px solid #2a2a3a;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-status-indicator .ag-status-dot{width:6px;height:6px;background:#6b728066;clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);transition:background-color .3s}.ag-status-indicator.connected{color:#0f8;border-color:#00ff884d;background:#00ff880a}.ag-status-indicator.connected .ag-status-dot{background:#0f8;box-shadow:0 0 4px #0f89}.ag-btn-small{padding:4px 10px;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#0a0a0f;background:#0f8;border:none;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px));cursor:pointer;transition:filter .15s;box-shadow:0 0 8px #00ff884d}.ag-btn-small:hover{filter:brightness(1.1)}.ag-error-text{color:#f36;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.05em;margin-top:4px}\n"], dependencies: [{ kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i2.NgSelectOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i2.ɵNgSelectMultipleOption, selector: "option", inputs: ["ngValue", "value"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: SettingsPanelComponent, decorators: [{
            type: Component,
            args: [{ selector: 'ag-settings-panel', standalone: false, template: "<div class=\"ag-settings-panel\">\n  <!-- \u6A19\u984C -->\n  <header class=\"ag-settings-header\">\n    <div class=\"ag-settings-title\">\n      <span class=\"ag-logo\">/agentation</span>\n      <span class=\"ag-version\">v1.0.0</span>\n    </div>\n    <button class=\"ag-theme-toggle\" title=\"Toggle Theme\" (click)=\"toggleTheme()\">\n      <!-- \u6708\u4EAE\u5716\u793A (light mode) -->\n      <svg *ngIf=\"!settings.isDarkMode\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <path d=\"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z\"/>\n      </svg>\n      <!-- \u592A\u967D\u5716\u793A (dark mode) -->\n      <svg *ngIf=\"settings.isDarkMode\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <circle cx=\"12\" cy=\"12\" r=\"5\"/>\n        <line x1=\"12\" y1=\"1\" x2=\"12\" y2=\"3\"/>\n        <line x1=\"12\" y1=\"21\" x2=\"12\" y2=\"23\"/>\n        <line x1=\"4.22\" y1=\"4.22\" x2=\"5.64\" y2=\"5.64\"/>\n        <line x1=\"18.36\" y1=\"18.36\" x2=\"19.78\" y2=\"19.78\"/>\n        <line x1=\"1\" y1=\"12\" x2=\"3\" y2=\"12\"/>\n        <line x1=\"21\" y1=\"12\" x2=\"23\" y2=\"12\"/>\n        <line x1=\"4.22\" y1=\"19.78\" x2=\"5.64\" y2=\"18.36\"/>\n        <line x1=\"18.36\" y1=\"5.64\" x2=\"19.78\" y2=\"4.22\"/>\n      </svg>\n    </button>\n  </header>\n\n  <!-- \u8F38\u51FA\u8A73\u7D30\u7A0B\u5EA6 -->\n  <section class=\"ag-settings-section\">\n    <div class=\"ag-settings-row\">\n      <label class=\"ag-settings-label\">\n        Output Detail\n        <span class=\"ag-help-icon\" title=\"Level of detail in the generated output\">?</span>\n      </label>\n      <div class=\"ag-dropdown\">\n        <select\n          [value]=\"settings.outputDetail\"\n          (change)=\"selectOutputDetail($any($event.target).value)\"\n        >\n          <option value=\"compact\">Compact</option>\n          <option value=\"standard\">Standard</option>\n          <option value=\"detailed\">Detailed</option>\n          <option value=\"forensic\">Forensic</option>\n        </select>\n      </div>\n    </div>\n  </section>\n\n  <!-- Angular \u7D44\u4EF6\u958B\u95DC -->\n  <!-- <section class=\"ag-settings-section\">\n    <div class=\"ag-settings-row\">\n      <label class=\"ag-settings-label\">\n        Angular Components\n        <span class=\"ag-help-icon\" title=\"Include Angular component metadata in output\">?</span>\n      </label>\n      <label class=\"ag-toggle\">\n        <input\n          type=\"checkbox\"\n          [checked]=\"settings.showAngularComponents\"\n          (change)=\"toggleAngularComponents()\"\n        />\n        <span class=\"ag-toggle-slider\"></span>\n      </label>\n    </div>\n  </section> -->\n\n  <!-- \u6A19\u8A18\u984F\u8272 -->\n  <section class=\"ag-settings-section\">\n    <label class=\"ag-settings-label\">Marker Colour</label>\n    <div class=\"ag-color-picker\">\n      <button\n        *ngFor=\"let color of colors\"\n        class=\"ag-color-option\"\n        [class.selected]=\"settings.markerColor === color\"\n        [style.background-color]=\"colorHex[color]\"\n        (click)=\"selectColor(color)\"\n        [title]=\"color\"\n      ></button>\n    </div>\n  </section>\n\n  <!-- \u5176\u4ED6\u9078\u9805 -->\n  <section class=\"ag-settings-section ag-options-section\">\n    <label class=\"ag-checkbox-row\">\n      <input\n        type=\"checkbox\"\n        [checked]=\"settings.clearOnCopy\"\n        (change)=\"toggleClearOnCopy()\"\n      />\n      <span>Clear on copy/send</span>\n      <span class=\"ag-help-icon\" title=\"Clear markers after copying to clipboard\">?</span>\n    </label>\n\n    <!-- <label class=\"ag-checkbox-row\">\n      <input\n        type=\"checkbox\"\n        [checked]=\"settings.blockPageInteractions\"\n        (change)=\"toggleBlockInteractions()\"\n      />\n      <span>Block page interactions</span>\n    </label> -->\n  </section>\n\n  <!-- MCP & Webhooks \u9023\u7D50 -->\n  <!-- <section class=\"ag-settings-section ag-link-section\">\n    <a href=\"javascript:void(0)\" class=\"ag-settings-link\">\n      Manage MCP &amp; Webhooks\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <polyline points=\"9 18 15 12 9 6\"/>\n      </svg>\n    </a>\n  </section> -->\n</div>\n", styles: ["@charset \"UTF-8\";.ag-settings-panel{position:absolute;bottom:calc(100% + 12px);right:0;left:auto;transform:none;z-index:999998;width:320px;background:#12121a;border:1px solid #2a2a3a;clip-path:polygon(0 10px,10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px));font-family:JetBrains Mono,monospace;box-shadow:0 0 20px #00ff880f,0 10px 40px #000000b3}.ag-settings-panel:before{content:\"\";position:absolute;top:0;left:10px;right:10px;height:1px;background:linear-gradient(90deg,transparent,#00ff88,transparent);pointer-events:none}.ag-settings-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #2a2a3a;background:#0a0a0f;position:relative}.ag-settings-header:before{content:\"\\25cf  \\25cf  \\25cf\";position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:7px;letter-spacing:3px;color:transparent;text-shadow:0 0 0 #ff3366,8px 0 0 #f59e0b,16px 0 0 #00ff88;pointer-events:none}.ag-settings-title{display:flex;align-items:baseline;gap:8px;padding-left:36px}.ag-logo{font-family:Orbitron,monospace;font-size:13px;font-weight:700;letter-spacing:.1em;color:#0f8;text-shadow:0 0 6px rgba(0,255,136,.4)}.ag-version{font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.1em;color:#6b7280}.ag-theme-toggle{display:flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid rgba(0,255,136,.2);background:transparent;color:#6b7280;cursor:pointer;transition:all .15s ease;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-theme-toggle svg{width:16px;height:16px;stroke-width:1.5}.ag-theme-toggle:hover{background:#00ff8814;border-color:#0f86;color:#0f8;filter:drop-shadow(0 0 4px rgba(0,255,136,.4))}.ag-settings-section{padding:14px 18px;border-bottom:1px solid #2a2a3a}.ag-settings-section:last-child{border-bottom:none}.ag-settings-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.ag-settings-label{display:flex;align-items:center;gap:6px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280}.ag-help-icon{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;font-size:9px;font-family:Orbitron,monospace;color:#00ff8880;border:1px solid rgba(0,255,136,.2);clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px));cursor:help}.ag-dropdown select{padding:6px 28px 6px 10px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;color:#0f8;background:#0a0a0f;border:1px solid rgba(0,255,136,.25);clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px));cursor:pointer;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2300ff88' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 8px center;transition:border-color .15s,box-shadow .15s}.ag-dropdown select:focus{outline:none;border-color:#00ff8880;box-shadow:0 0 6px #00ff881f}.ag-dropdown select option{background:#12121a;color:#e0e0e0}.ag-toggle{position:relative;display:inline-block;width:40px;height:22px}.ag-toggle input{opacity:0;width:0;height:0}.ag-toggle-slider{position:absolute;cursor:pointer;inset:0;background:#1c1c2e;border:1px solid #2a2a3a;transition:.2s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-toggle-slider:before{position:absolute;content:\"\";height:14px;width:14px;left:3px;bottom:3px;background:#6b7280;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px));transition:.2s}input:checked+.ag-toggle-slider{background:#00ff881a;border-color:#0f86;box-shadow:0 0 6px #0f83}input:checked+.ag-toggle-slider:before{transform:translate(18px);background:#0f8;box-shadow:0 0 4px #00ff8880}.ag-color-picker{display:flex;gap:8px;margin-top:10px}.ag-color-option{width:28px;height:28px;padding:0;border:2px solid transparent;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));cursor:pointer;transition:all .15s ease;position:relative}.ag-color-option:hover{filter:brightness(1.2);transform:scale(1.1)}.ag-color-option.selected{border-color:#e0e0e0;box-shadow:0 0 8px #ffffff4d}.ag-options-section{display:flex;flex-direction:column;gap:10px}.ag-checkbox-row{display:flex;align-items:center;gap:10px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;cursor:pointer;transition:color .15s}.ag-checkbox-row:hover{color:#e0e0e0}.ag-checkbox-row input[type=checkbox]{width:16px;height:16px;accent-color:#00ff88;cursor:pointer}.ag-link-section{padding:12px 18px}.ag-settings-link{display:flex;align-items:center;justify-content:space-between;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;text-decoration:none;transition:color .15s}.ag-settings-link svg{width:14px;height:14px;color:#6b728080}.ag-settings-link:hover{color:#0f8}.ag-settings-link:hover svg{color:#0f8}.ag-status-indicator{display:flex;align-items:center;gap:8px;font-family:Share Tech Mono,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;padding:6px 10px;background:#0a0a0f;border:1px solid #2a2a3a;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-status-indicator .ag-status-dot{width:6px;height:6px;background:#6b728066;clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);transition:background-color .3s}.ag-status-indicator.connected{color:#0f8;border-color:#00ff884d;background:#00ff880a}.ag-status-indicator.connected .ag-status-dot{background:#0f8;box-shadow:0 0 4px #0f89}.ag-btn-small{padding:4px 10px;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#0a0a0f;background:#0f8;border:none;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px));cursor:pointer;transition:filter .15s;box-shadow:0 0 8px #00ff884d}.ag-btn-small:hover{filter:brightness(1.1)}.ag-error-text{color:#f36;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.05em;margin-top:4px}\n"] }]
        }], ctorParameters: () => [{ type: McpService }], propDecorators: { settings: [{
                type: Input
            }], isDarkMode: [{
                type: HostBinding,
                args: ['class.ag-dark-mode']
            }], closed: [{
                type: Output
            }], settingsChange: [{
                type: Output
            }] } });

/**
 * MarkersPanelComponent
 *
 * 已標記組件列表：顯示、編輯意圖、刪除標記
 */
class MarkersPanelComponent {
    /** 標記列表 */
    markers = [];
    /** 面板關閉時觸發 */
    closed = new EventEmitter();
    /** 刪除標記時觸發 */
    deleteMarker = new EventEmitter();
    /** 更新標記意圖時觸發 */
    updateIntent = new EventEmitter();
    /** 跳轉到標記時觸發 */
    scrollToMarker = new EventEmitter();
    /** 顏色對應的 HEX 值 */
    colorHex = MARKER_COLORS;
    /** 當前編輯的標記索引 */
    editingIndex = null;
    /** 編輯中的意圖文字 */
    editingIntent = '';
    /** 開始編輯意圖 */
    startEdit(marker) {
        this.editingIndex = marker.index;
        this.editingIntent = marker.intent;
    }
    /** 保存編輯 */
    saveEdit() {
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
    cancelEdit() {
        this.editingIndex = null;
        this.editingIntent = '';
    }
    /** 刪除標記 */
    onDelete(index) {
        this.deleteMarker.emit(index);
    }
    /** 跳轉到標記 */
    onScrollTo(index) {
        this.scrollToMarker.emit(index);
    }
    /** 關閉面板 */
    close() {
        this.closed.emit();
    }
    /** 處理 Enter 鍵 */
    onKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.saveEdit();
        }
        else if (event.key === 'Escape') {
            this.cancelEdit();
        }
    }
    /** trackBy 函數 */
    trackByIndex(index, marker) {
        return marker.index;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: MarkersPanelComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "19.2.18", type: MarkersPanelComponent, isStandalone: false, selector: "ag-markers-panel", inputs: { markers: "markers" }, outputs: { closed: "closed", deleteMarker: "deleteMarker", updateIntent: "updateIntent", scrollToMarker: "scrollToMarker" }, ngImport: i0, template: "<div class=\"ag-markers-panel\">\n  <!-- \u6A19\u984C -->\n  <header class=\"ag-markers-header\">\n    <h3 class=\"ag-markers-title\">\n      <span class=\"ag-markers-icon\">\uD83D\uDCCC</span>\n      Marked Components\n      <span class=\"ag-markers-count\">{{ markers.length }}</span>\n    </h3>\n    <button class=\"ag-close-btn\" (click)=\"close()\" title=\"Close\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>\n        <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>\n      </svg>\n    </button>\n  </header>\n\n  <!-- \u6A19\u8A18\u5217\u8868 -->\n  <div class=\"ag-markers-list\" *ngIf=\"markers.length > 0\">\n    <div\n      class=\"ag-marker-item\"\n      *ngFor=\"let marker of markers; trackBy: trackByIndex\"\n    >\n      <!-- \u6A19\u8A18\u7DE8\u865F -->\n      <div\n        class=\"ag-marker-number\"\n        [style.background-color]=\"colorHex[marker.color]\"\n        (click)=\"onScrollTo(marker.index)\"\n      >\n        {{ marker.index }}\n      </div>\n\n      <!-- \u6A19\u8A18\u5167\u5BB9 -->\n      <div class=\"ag-marker-content\">\n        <div class=\"ag-marker-component\">\n          <span class=\"ag-marker-name\">{{ marker.target.displayName }}</span>\n          <code class=\"ag-marker-selector\">&lt;{{ marker.target.selector }}&gt;</code>\n        </div>\n\n        <!-- \u610F\u5716\u986F\u793A/\u7DE8\u8F2F -->\n        <div class=\"ag-marker-intent\" *ngIf=\"editingIndex !== marker.index\">\n          <span class=\"ag-intent-text\" *ngIf=\"marker.intent\">{{ marker.intent }}</span>\n          <button class=\"ag-edit-btn\" (click)=\"startEdit(marker)\" title=\"Edit intent\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n              <path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/>\n              <path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/>\n            </svg>\n            {{ marker.intent ? 'Edit' : 'Add intent' }}\n          </button>\n        </div>\n\n        <!-- \u7DE8\u8F2F\u6A21\u5F0F -->\n        <div class=\"ag-marker-edit\" *ngIf=\"editingIndex === marker.index\">\n          <textarea\n            class=\"ag-edit-textarea\"\n            [(ngModel)]=\"editingIntent\"\n            (keydown)=\"onKeyDown($event)\"\n            placeholder=\"Describe what you want AI to do...\"\n            rows=\"2\"\n          ></textarea>\n          <div class=\"ag-edit-actions\">\n            <button class=\"ag-save-btn\" (click)=\"saveEdit()\">Save</button>\n            <button class=\"ag-cancel-btn\" (click)=\"cancelEdit()\">Cancel</button>\n          </div>\n        </div>\n      </div>\n\n      <!-- \u522A\u9664\u6309\u9215 -->\n      <button class=\"ag-delete-btn\" (click)=\"onDelete(marker.index)\" title=\"Delete marker\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>\n          <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>\n        </svg>\n      </button>\n    </div>\n  </div>\n\n  <!-- \u7A7A\u72C0\u614B -->\n  <div class=\"ag-markers-empty\" *ngIf=\"markers.length === 0\">\n    <span class=\"ag-empty-icon\">\uD83D\uDCED</span>\n    <p>No markers yet</p>\n    <span class=\"ag-empty-hint\">Click on components to add markers</span>\n  </div>\n</div>\n", styles: ["@charset \"UTF-8\";.ag-markers-panel{position:fixed;bottom:80px;left:50%;transform:translate(-50%);z-index:999998;width:400px;max-height:420px;background:#12121a;border:1px solid #2a2a3a;clip-path:polygon(0 12px,12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px));overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 20px #00ff880f,0 10px 40px #000000b3}.ag-markers-panel:before{content:\"\";position:absolute;top:0;left:12px;right:12px;height:1px;background:linear-gradient(90deg,transparent,#00ff88,transparent);z-index:1;pointer-events:none}.ag-markers-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #2a2a3a;background:#0a0a0f;flex-shrink:0;position:relative}.ag-markers-header:before{content:\"\\25cf  \\25cf  \\25cf\";position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:7px;letter-spacing:3px;color:transparent;text-shadow:0 0 0 #ff3366,8px 0 0 #f59e0b,16px 0 0 #00ff88;pointer-events:none}.ag-markers-title{display:flex;align-items:center;gap:8px;margin:0;padding-left:36px;font-family:Orbitron,monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#e0e0e0}.ag-markers-icon{font-size:14px}.ag-markers-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;background:#0f8;color:#0a0a0f;font-family:Orbitron,monospace;font-size:10px;font-weight:700;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px));box-shadow:0 0 6px #00ff8880}.ag-close-btn{display:flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:1px solid rgba(255,51,102,.3);background:transparent;color:#6b7280;cursor:pointer;transition:all .15s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-close-btn svg{width:14px;height:14px}.ag-close-btn:hover{background:#ff336626;border-color:#f36;color:#f36;box-shadow:0 0 6px #ff33664d}.ag-markers-list{flex:1;overflow-y:auto;padding:8px}.ag-markers-list::-webkit-scrollbar{width:4px}.ag-markers-list::-webkit-scrollbar-track{background:#0a0a0f}.ag-markers-list::-webkit-scrollbar-thumb{background:#2a2a3a}.ag-marker-item{display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid transparent;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));transition:background .1s,border-color .1s}.ag-marker-item+.ag-marker-item{margin-top:4px}.ag-marker-item:hover{background:#1c1c2e;border-color:#00ff8826}.ag-marker-item:hover .ag-delete-btn{opacity:1}.ag-marker-number{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:26px;height:26px;color:#0a0a0f;font-family:Orbitron,monospace;font-size:11px;font-weight:700;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));cursor:pointer;transition:filter .15s,transform .1s}.ag-marker-number:hover{filter:brightness(1.2);transform:scale(1.1)}.ag-marker-content{flex:1;min-width:0}.ag-marker-component{display:flex;align-items:baseline;gap:7px;margin-bottom:5px;flex-wrap:wrap}.ag-marker-name{font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ag-marker-selector{font-family:Share Tech Mono,monospace;font-size:11px;color:#00d4ff;background:#00d4ff0f;border:1px solid rgba(0,212,255,.15);padding:0 5px;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-marker-intent{display:flex;align-items:center;gap:8px}.ag-intent-text{font-size:11px;color:#6b7280;line-height:1.4;letter-spacing:.02em}.ag-edit-btn{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid rgba(0,255,136,.2);background:transparent;color:#0f89;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .15s;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-edit-btn svg{width:10px;height:10px}.ag-edit-btn:hover{background:#00ff8814;border-color:#0f86;color:#0f8}.ag-marker-edit{margin-top:7px}.ag-edit-textarea{width:100%;padding:7px 10px;background:#0a0a0f;border:1px solid #2a2a3a;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px));color:#0f8;font-family:JetBrains Mono,monospace;font-size:12px;resize:none}.ag-edit-textarea::placeholder{color:#6b728080}.ag-edit-textarea:focus{outline:none;border-color:#00ff8880;box-shadow:0 0 6px #00ff881a}.ag-edit-actions{display:flex;gap:6px;margin-top:7px}.ag-save-btn,.ag-cancel-btn{padding:5px 12px;border:none;background:transparent;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:all .15s;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-save-btn{border:1px solid #00ff88;color:#0f8}.ag-save-btn:hover{background:#0f8;color:#0a0a0f;box-shadow:0 0 8px #0f86}.ag-cancel-btn{border:1px solid #2a2a3a;color:#6b7280}.ag-cancel-btn:hover{border-color:#6b728066;color:#e0e0e0;background:#6b72800d}.ag-delete-btn{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:1px solid transparent;background:transparent;color:#f366;cursor:pointer;opacity:0;transition:all .15s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-delete-btn svg{width:12px;height:12px}.ag-delete-btn:hover{background:#ff33661f;border-color:#f366;color:#f36;opacity:1;box-shadow:0 0 6px #f363}.ag-markers-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center;gap:10px}.ag-empty-icon{font-size:28px;opacity:.5}.ag-markers-empty p{margin:0;font-family:Orbitron,monospace;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}.ag-empty-hint{font-family:Share Tech Mono,monospace;font-size:11px;color:#6b728099;letter-spacing:.08em}.ag-empty-hint:before{content:\"> \";color:#0f86}\n"], dependencies: [{ kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: MarkersPanelComponent, decorators: [{
            type: Component,
            args: [{ selector: 'ag-markers-panel', standalone: false, template: "<div class=\"ag-markers-panel\">\n  <!-- \u6A19\u984C -->\n  <header class=\"ag-markers-header\">\n    <h3 class=\"ag-markers-title\">\n      <span class=\"ag-markers-icon\">\uD83D\uDCCC</span>\n      Marked Components\n      <span class=\"ag-markers-count\">{{ markers.length }}</span>\n    </h3>\n    <button class=\"ag-close-btn\" (click)=\"close()\" title=\"Close\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n        <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>\n        <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>\n      </svg>\n    </button>\n  </header>\n\n  <!-- \u6A19\u8A18\u5217\u8868 -->\n  <div class=\"ag-markers-list\" *ngIf=\"markers.length > 0\">\n    <div\n      class=\"ag-marker-item\"\n      *ngFor=\"let marker of markers; trackBy: trackByIndex\"\n    >\n      <!-- \u6A19\u8A18\u7DE8\u865F -->\n      <div\n        class=\"ag-marker-number\"\n        [style.background-color]=\"colorHex[marker.color]\"\n        (click)=\"onScrollTo(marker.index)\"\n      >\n        {{ marker.index }}\n      </div>\n\n      <!-- \u6A19\u8A18\u5167\u5BB9 -->\n      <div class=\"ag-marker-content\">\n        <div class=\"ag-marker-component\">\n          <span class=\"ag-marker-name\">{{ marker.target.displayName }}</span>\n          <code class=\"ag-marker-selector\">&lt;{{ marker.target.selector }}&gt;</code>\n        </div>\n\n        <!-- \u610F\u5716\u986F\u793A/\u7DE8\u8F2F -->\n        <div class=\"ag-marker-intent\" *ngIf=\"editingIndex !== marker.index\">\n          <span class=\"ag-intent-text\" *ngIf=\"marker.intent\">{{ marker.intent }}</span>\n          <button class=\"ag-edit-btn\" (click)=\"startEdit(marker)\" title=\"Edit intent\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n              <path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/>\n              <path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/>\n            </svg>\n            {{ marker.intent ? 'Edit' : 'Add intent' }}\n          </button>\n        </div>\n\n        <!-- \u7DE8\u8F2F\u6A21\u5F0F -->\n        <div class=\"ag-marker-edit\" *ngIf=\"editingIndex === marker.index\">\n          <textarea\n            class=\"ag-edit-textarea\"\n            [(ngModel)]=\"editingIntent\"\n            (keydown)=\"onKeyDown($event)\"\n            placeholder=\"Describe what you want AI to do...\"\n            rows=\"2\"\n          ></textarea>\n          <div class=\"ag-edit-actions\">\n            <button class=\"ag-save-btn\" (click)=\"saveEdit()\">Save</button>\n            <button class=\"ag-cancel-btn\" (click)=\"cancelEdit()\">Cancel</button>\n          </div>\n        </div>\n      </div>\n\n      <!-- \u522A\u9664\u6309\u9215 -->\n      <button class=\"ag-delete-btn\" (click)=\"onDelete(marker.index)\" title=\"Delete marker\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n          <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>\n          <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>\n        </svg>\n      </button>\n    </div>\n  </div>\n\n  <!-- \u7A7A\u72C0\u614B -->\n  <div class=\"ag-markers-empty\" *ngIf=\"markers.length === 0\">\n    <span class=\"ag-empty-icon\">\uD83D\uDCED</span>\n    <p>No markers yet</p>\n    <span class=\"ag-empty-hint\">Click on components to add markers</span>\n  </div>\n</div>\n", styles: ["@charset \"UTF-8\";.ag-markers-panel{position:fixed;bottom:80px;left:50%;transform:translate(-50%);z-index:999998;width:400px;max-height:420px;background:#12121a;border:1px solid #2a2a3a;clip-path:polygon(0 12px,12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px));overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 20px #00ff880f,0 10px 40px #000000b3}.ag-markers-panel:before{content:\"\";position:absolute;top:0;left:12px;right:12px;height:1px;background:linear-gradient(90deg,transparent,#00ff88,transparent);z-index:1;pointer-events:none}.ag-markers-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #2a2a3a;background:#0a0a0f;flex-shrink:0;position:relative}.ag-markers-header:before{content:\"\\25cf  \\25cf  \\25cf\";position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:7px;letter-spacing:3px;color:transparent;text-shadow:0 0 0 #ff3366,8px 0 0 #f59e0b,16px 0 0 #00ff88;pointer-events:none}.ag-markers-title{display:flex;align-items:center;gap:8px;margin:0;padding-left:36px;font-family:Orbitron,monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#e0e0e0}.ag-markers-icon{font-size:14px}.ag-markers-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;background:#0f8;color:#0a0a0f;font-family:Orbitron,monospace;font-size:10px;font-weight:700;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px));box-shadow:0 0 6px #00ff8880}.ag-close-btn{display:flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:1px solid rgba(255,51,102,.3);background:transparent;color:#6b7280;cursor:pointer;transition:all .15s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-close-btn svg{width:14px;height:14px}.ag-close-btn:hover{background:#ff336626;border-color:#f36;color:#f36;box-shadow:0 0 6px #ff33664d}.ag-markers-list{flex:1;overflow-y:auto;padding:8px}.ag-markers-list::-webkit-scrollbar{width:4px}.ag-markers-list::-webkit-scrollbar-track{background:#0a0a0f}.ag-markers-list::-webkit-scrollbar-thumb{background:#2a2a3a}.ag-marker-item{display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid transparent;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));transition:background .1s,border-color .1s}.ag-marker-item+.ag-marker-item{margin-top:4px}.ag-marker-item:hover{background:#1c1c2e;border-color:#00ff8826}.ag-marker-item:hover .ag-delete-btn{opacity:1}.ag-marker-number{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:26px;height:26px;color:#0a0a0f;font-family:Orbitron,monospace;font-size:11px;font-weight:700;clip-path:polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px));cursor:pointer;transition:filter .15s,transform .1s}.ag-marker-number:hover{filter:brightness(1.2);transform:scale(1.1)}.ag-marker-content{flex:1;min-width:0}.ag-marker-component{display:flex;align-items:baseline;gap:7px;margin-bottom:5px;flex-wrap:wrap}.ag-marker-name{font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ag-marker-selector{font-family:Share Tech Mono,monospace;font-size:11px;color:#00d4ff;background:#00d4ff0f;border:1px solid rgba(0,212,255,.15);padding:0 5px;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-marker-intent{display:flex;align-items:center;gap:8px}.ag-intent-text{font-size:11px;color:#6b7280;line-height:1.4;letter-spacing:.02em}.ag-edit-btn{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid rgba(0,255,136,.2);background:transparent;color:#0f89;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .15s;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-edit-btn svg{width:10px;height:10px}.ag-edit-btn:hover{background:#00ff8814;border-color:#0f86;color:#0f8}.ag-marker-edit{margin-top:7px}.ag-edit-textarea{width:100%;padding:7px 10px;background:#0a0a0f;border:1px solid #2a2a3a;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px));color:#0f8;font-family:JetBrains Mono,monospace;font-size:12px;resize:none}.ag-edit-textarea::placeholder{color:#6b728080}.ag-edit-textarea:focus{outline:none;border-color:#00ff8880;box-shadow:0 0 6px #00ff881a}.ag-edit-actions{display:flex;gap:6px;margin-top:7px}.ag-save-btn,.ag-cancel-btn{padding:5px 12px;border:none;background:transparent;font-family:Share Tech Mono,monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:all .15s;clip-path:polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px))}.ag-save-btn{border:1px solid #00ff88;color:#0f8}.ag-save-btn:hover{background:#0f8;color:#0a0a0f;box-shadow:0 0 8px #0f86}.ag-cancel-btn{border:1px solid #2a2a3a;color:#6b7280}.ag-cancel-btn:hover{border-color:#6b728066;color:#e0e0e0;background:#6b72800d}.ag-delete-btn{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:1px solid transparent;background:transparent;color:#f366;cursor:pointer;opacity:0;transition:all .15s;clip-path:polygon(0 4px,4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px))}.ag-delete-btn svg{width:12px;height:12px}.ag-delete-btn:hover{background:#ff33661f;border-color:#f366;color:#f36;opacity:1;box-shadow:0 0 6px #f363}.ag-markers-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center;gap:10px}.ag-empty-icon{font-size:28px;opacity:.5}.ag-markers-empty p{margin:0;font-family:Orbitron,monospace;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}.ag-empty-hint{font-family:Share Tech Mono,monospace;font-size:11px;color:#6b728099;letter-spacing:.08em}.ag-empty-hint:before{content:\"> \";color:#0f86}\n"] }]
        }], propDecorators: { markers: [{
                type: Input
            }], closed: [{
                type: Output
            }], deleteMarker: [{
                type: Output
            }], updateIntent: [{
                type: Output
            }], scrollToMarker: [{
                type: Output
            }] } });

class AgentationComponent {
    promptGenerator;
    isDev = isDevMode();
    /** 設定 */
    settings = { ...DEFAULT_SETTINGS };
    /** 工具列狀態 */
    toolbarState = {
        showSettings: false,
        showMarkers: false,
        isRecording: false,
        isMinimized: false,
    };
    /** 錄製會話 */
    session = {
        id: this.generateId(),
        markers: [],
        startTime: 0,
        isRecording: false,
    };
    // Just used for legacy panel if needed, but mainly for overlay
    selectedNode = null;
    constructor(promptGenerator) {
        this.promptGenerator = promptGenerator;
    }
    ngOnInit() {
    }
    // ==================== 工具列事件 ====================
    /** 開始錄製 */
    onStartRecording() {
        this.session = {
            id: this.generateId(),
            markers: [],
            startTime: Date.now(),
            isRecording: true,
        };
        this.toolbarState.isRecording = true;
        this.toolbarState.showSettings = false;
        this.toolbarState.showMarkers = false;
    }
    /** 停止錄製 */
    onStopRecording() {
        this.session.isRecording = false;
        this.session.endTime = Date.now();
        this.toolbarState.isRecording = false;
    }
    /** 處理錄製狀態變更（來自 Overlay 快捷鍵等） */
    onRecordingChanged(isRecording) {
        if (isRecording) {
            this.onStartRecording();
        }
        else {
            this.onStopRecording();
        }
    }
    /** 切換顯示標記列表 */
    onToggleMarkers() {
        this.toolbarState.showMarkers = !this.toolbarState.showMarkers;
        if (this.toolbarState.showMarkers) {
            this.toolbarState.showSettings = false;
        }
    }
    /** 複製到剪貼簿 */
    async onCopyToClipboard() {
        if (this.session.markers.length === 0)
            return;
        const markdown = this.generateMultiMarkerOutput();
        try {
            await navigator.clipboard.writeText(markdown);
            console.log('[Agentation] Copied to clipboard');
            if (this.settings.clearOnCopy) {
                this.onClearMarkers();
            }
        }
        catch (err) {
            console.error('[Agentation] Failed to copy:', err);
        }
    }
    /** 清除所有標記 */
    onClearMarkers() {
        this.session.markers = [];
    }
    /** 切換設定面板 */
    onToggleSettings() {
        this.toolbarState.showSettings = !this.toolbarState.showSettings;
        if (this.toolbarState.showSettings) {
            this.toolbarState.showMarkers = false;
        }
    }
    /** 關閉工具列 */
    onCloseToolbar() {
        this.toolbarState.isRecording = false;
        this.toolbarState.showSettings = false;
        this.toolbarState.showMarkers = false;
        this.session.markers = [];
    }
    /** 切換最小化 */
    onToggleMinimize() {
        this.toolbarState.isMinimized = !this.toolbarState.isMinimized;
        // 如果工具列收合，則關閉設定面板
        if (this.toolbarState.isMinimized) {
            this.toolbarState.showSettings = false;
        }
    }
    /** 設定變更 */
    onSettingsChange(newSettings) {
        // 如果顏色有變更，更新所有已存在的 markers
        if (newSettings.markerColor !== this.settings.markerColor) {
            this.session.markers = this.session.markers.map((m) => ({
                ...m,
                color: newSettings.markerColor,
            }));
        }
        this.settings = newSettings;
    }
    // ==================== 標記事件 ====================
    /** 新增標記 */
    onMarkerAdded(node) {
        const marker = {
            index: this.session.markers.length + 1,
            target: node,
            intent: '',
            color: this.settings.markerColor,
            timestamp: Date.now(),
        };
        this.session.markers = [...this.session.markers, marker];
        // console.log('[Agentation] Marker added:', marker);
    }
    /** 刪除標記 */
    onDeleteMarker(index) {
        this.session.markers = this.session.markers
            .filter((m) => m.index !== index)
            .map((m, i) => ({ ...m, index: i + 1 }));
    }
    /** 更新標記意圖 */
    onUpdateIntent(event) {
        this.session.markers = this.session.markers.map((m) => m.index === event.index ? { ...m, intent: event.intent } : m);
    }
    /** 跳轉到標記 */
    onScrollToMarker(index) {
        const marker = this.session.markers.find((m) => m.index === index);
        if (marker) {
            marker.target.domElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }
    // ==================== 輔助方法 ====================
    /** 生成多標記輸出 */
    generateMultiMarkerOutput() {
        const markers = this.session.markers.map((marker) => ({
            target: marker.target,
            intent: marker.intent || '',
        }));
        return this.promptGenerator.generatePageFeedback(markers, {
            outputDetail: this.settings.outputDetail,
            pageUrl: window.location.href,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
        });
    }
    /** 生成唯一 ID */
    generateId() {
        return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: AgentationComponent, deps: [{ token: PromptGeneratorService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "19.2.18", type: AgentationComponent, isStandalone: false, selector: "ag-directive-zero", ngImport: i0, template: "<ng-container *ngIf=\"isDev\">\n  <!-- Overlay (\u591A\u9078\u6A19\u8A18) -->\n  <ag-overlay [markers]=\"session.markers\" [settings]=\"settings\" [isRecording]=\"toolbarState.isRecording\"\n    [isMinimized]=\"toolbarState.isMinimized\" (markerAdded)=\"onMarkerAdded($event)\"\n    (markerDeleted)=\"onDeleteMarker($event)\" (recordingChanged)=\"onRecordingChanged($event)\"></ag-overlay>\n\n  <!-- Toolbar (\u6D6E\u52D5\u5DE5\u5177\u5217) -->\n  <ag-toolbar [session]=\"session\" [settings]=\"settings\" [state]=\"toolbarState\" (startRecording)=\"onStartRecording()\"\n    (stopRecording)=\"onStopRecording()\" (toggleMarkers)=\"onToggleMarkers()\" (copyToClipboard)=\"onCopyToClipboard()\"\n    (clearMarkers)=\"onClearMarkers()\" (toggleSettings)=\"onToggleSettings()\" (toggleMinimize)=\"onToggleMinimize()\"\n    (closeToolbar)=\"onCloseToolbar()\" (settingsChange)=\"onSettingsChange($event)\"></ag-toolbar>\n\n  <!-- Markers Panel -->\n  <ag-markers-panel *ngIf=\"toolbarState.showMarkers\" [markers]=\"session.markers\" (deleteMarker)=\"onDeleteMarker($event)\"\n    (updateIntent)=\"onUpdateIntent($event)\" (scrollToMarker)=\"onScrollToMarker($event)\"\n    (closed)=\"toolbarState.showMarkers = false\"></ag-markers-panel>\n</ng-container>", styles: [":host{display:block}\n"], dependencies: [{ kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "component", type: OverlayComponent, selector: "ag-overlay", inputs: ["markers", "settings", "isRecording", "isMinimized"], outputs: ["markerAdded", "componentSelected", "componentHovered", "recordingChanged", "markerDeleted"] }, { kind: "component", type: ToolbarComponent, selector: "ag-toolbar", inputs: ["session", "settings", "state"], outputs: ["startRecording", "stopRecording", "toggleMarkers", "copyToClipboard", "clearMarkers", "toggleSettings", "closeToolbar", "toggleMinimize", "settingsChange"] }, { kind: "component", type: MarkersPanelComponent, selector: "ag-markers-panel", inputs: ["markers"], outputs: ["closed", "deleteMarker", "updateIntent", "scrollToMarker"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: AgentationComponent, decorators: [{
            type: Component,
            args: [{ selector: 'ag-directive-zero', standalone: false, template: "<ng-container *ngIf=\"isDev\">\n  <!-- Overlay (\u591A\u9078\u6A19\u8A18) -->\n  <ag-overlay [markers]=\"session.markers\" [settings]=\"settings\" [isRecording]=\"toolbarState.isRecording\"\n    [isMinimized]=\"toolbarState.isMinimized\" (markerAdded)=\"onMarkerAdded($event)\"\n    (markerDeleted)=\"onDeleteMarker($event)\" (recordingChanged)=\"onRecordingChanged($event)\"></ag-overlay>\n\n  <!-- Toolbar (\u6D6E\u52D5\u5DE5\u5177\u5217) -->\n  <ag-toolbar [session]=\"session\" [settings]=\"settings\" [state]=\"toolbarState\" (startRecording)=\"onStartRecording()\"\n    (stopRecording)=\"onStopRecording()\" (toggleMarkers)=\"onToggleMarkers()\" (copyToClipboard)=\"onCopyToClipboard()\"\n    (clearMarkers)=\"onClearMarkers()\" (toggleSettings)=\"onToggleSettings()\" (toggleMinimize)=\"onToggleMinimize()\"\n    (closeToolbar)=\"onCloseToolbar()\" (settingsChange)=\"onSettingsChange($event)\"></ag-toolbar>\n\n  <!-- Markers Panel -->\n  <ag-markers-panel *ngIf=\"toolbarState.showMarkers\" [markers]=\"session.markers\" (deleteMarker)=\"onDeleteMarker($event)\"\n    (updateIntent)=\"onUpdateIntent($event)\" (scrollToMarker)=\"onScrollToMarker($event)\"\n    (closed)=\"toolbarState.showMarkers = false\"></ag-markers-panel>\n</ng-container>", styles: [":host{display:block}\n"] }]
        }], ctorParameters: () => [{ type: PromptGeneratorService }] });

/**
 * NgDirectiveZeroModule
 *
 * Angular 版本的 Agentation 工具
 * 提供視覺化 DOM 檢查器、組件樹遍歷、AI 語意化序列化等功能
 *
 * 使用方式：
 * ```typescript
 * @NgModule({
 *   imports: [NgDirectiveZeroModule.forRoot()]
 * })
 * export class AppModule {}
 * ```
 */
class NgDirectiveZeroModule {
    /**
     * 在根模組中使用，提供單例服務
     */
    static forRoot() {
        return {
            ngModule: NgDirectiveZeroModule,
            providers: [
                ComponentWalkerService,
                DataSanitizerService,
                PromptGeneratorService,
                McpService,
            ],
        };
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: NgDirectiveZeroModule, deps: [], target: i0.ɵɵFactoryTarget.NgModule });
    static ɵmod = i0.ɵɵngDeclareNgModule({ minVersion: "14.0.0", version: "19.2.18", ngImport: i0, type: NgDirectiveZeroModule, declarations: [OverlayComponent,
            AnnotationPanelComponent,
            ToolbarComponent,
            SettingsPanelComponent,
            MarkersPanelComponent,
            InlineEditorComponent,
            AgentationComponent], imports: [CommonModule,
            FormsModule,
            HttpClientModule], exports: [OverlayComponent,
            AnnotationPanelComponent,
            ToolbarComponent,
            SettingsPanelComponent,
            MarkersPanelComponent,
            InlineEditorComponent,
            AgentationComponent] });
    static ɵinj = i0.ɵɵngDeclareInjector({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: NgDirectiveZeroModule, imports: [CommonModule,
            FormsModule,
            HttpClientModule] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.18", ngImport: i0, type: NgDirectiveZeroModule, decorators: [{
            type: NgModule,
            args: [{
                    declarations: [
                        OverlayComponent,
                        AnnotationPanelComponent,
                        ToolbarComponent,
                        SettingsPanelComponent,
                        MarkersPanelComponent,
                        InlineEditorComponent,
                        AgentationComponent,
                    ],
                    imports: [
                        CommonModule,
                        FormsModule,
                        HttpClientModule,
                    ],
                    exports: [
                        OverlayComponent,
                        AnnotationPanelComponent,
                        ToolbarComponent,
                        SettingsPanelComponent,
                        MarkersPanelComponent,
                        InlineEditorComponent,
                        AgentationComponent,
                    ],
                }]
        }] });

/*
 * ng-directive-zero Public API
 */
// Module

/**
 * Generated bundle index. Do not edit.
 */

export { AgentationComponent, AnnotationPanelComponent, ComponentWalkerService, DEFAULT_SETTINGS, DataSanitizerService, InlineEditorComponent, KEY_COMPUTED_STYLES, MARKER_COLORS, MarkersPanelComponent, McpService, NgDirectiveZeroModule, OverlayComponent, PromptGeneratorService, SettingsPanelComponent, ToolbarComponent };
//# sourceMappingURL=ng-directive-zero.mjs.map
