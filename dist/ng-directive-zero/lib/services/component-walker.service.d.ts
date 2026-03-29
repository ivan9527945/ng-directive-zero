import { ComponentNode } from '../models/component-node.interface';
import * as i0 from "@angular/core";
/**
 * ComponentWalkerService
 *
 * 核心服務：從 DOM 元素獲取 Angular 組件資訊
 * 使用 Angular 的 ng.getComponent() 等開發模式 API
 *
 * 效能要求：執行時間 < 16ms (1 frame)
 */
export declare class ComponentWalkerService {
    private uidCounter;
    /**
     * 檢查是否在開發模式下且 ng API 可用
     */
    isAvailable(): boolean;
    /**
     * 從 DOM 元素獲取 Angular 組件節點資訊
     *
     * @param element - 目標 DOM 元素
     * @returns ComponentNode 或 null（如果不是 Angular 組件）
     */
    getComponentNode(element: HTMLElement): ComponentNode | null;
    /**
     * 創建 DOM 節點組件資訊 (用於 Root Component 內的普通元素)
     */
    private createDomNode;
    /**
     * 獲取組件定義 (ɵcmp)
     */
    private getComponentDef;
    /**
     * 從組件定義提取 selector
     */
    private extractSelector;
    /**
     * 提取 @Input 綁定的當前值
     */
    private extractInputValues;
    /**
     * 提取 @Output 事件名稱
     */
    private extractOutputNames;
    /**
     * 提取非 Input/Output 的公開屬性
     */
    private extractPublicProperties;
    /**
     * 清理值以便序列化
     */
    private sanitizeValue;
    /**
     * 檢查是否為 RxJS Observable
     */
    private isObservable;
    /**
     * 獲取父組件資訊
     */
    private getParentInfo;
    /**
     * 找到組件的 host 元素
     */
    private findComponentHost;
    /**
     * 計算 DOM 路徑
     */
    private computeDomPath;
    /**
     * 提取關鍵 computed styles
     */
    private extractComputedStyles;
    /**
     * 生成唯一 ID
     */
    private generateUid;
    /**
     * 獲取元素的祖先鏈（從當前元素到根）
     * 用於層級麵包屑導航
     *
     * @param element - 起始 DOM 元素
     * @param maxDepth - 最大深度（預設 10，避免過長）
     * @returns ComponentNode 陣列，索引 0 為當前元素，依次向上
     */
    getAncestorChain(element: HTMLElement, maxDepth?: number): ComponentNode[];
    /**
     * 簡化版：僅獲取祖先元素的基本資訊（用於麵包屑顯示）
     * 效能更佳，不需要完整的 ComponentNode
     *
     * @param element - 起始 DOM 元素
     * @param maxDepth - 最大深度
     * @returns 簡化的祖先資訊陣列
     */
    getAncestorBreadcrumbs(element: HTMLElement, maxDepth?: number): AncestorBreadcrumb[];
    static ɵfac: i0.ɵɵFactoryDeclaration<ComponentWalkerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ComponentWalkerService>;
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
