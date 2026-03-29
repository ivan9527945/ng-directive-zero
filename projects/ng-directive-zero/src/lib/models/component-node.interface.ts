/**
 * Angular Agentation - Component Node Interface
 * 定義從 DOM 元素解析出的 Angular 組件資訊結構
 */

/**
 * 組件節點資訊
 * 包含識別、邏輯層、渲染層三個維度的資料
 */
export interface ComponentNode {
    /** 唯一識別符 */
    uid: string;

    /** 組件類別名稱 e.g., "ProductCardComponent" */
    displayName: string;

    /** Angular selector e.g., "app-product-card" */
    selector: string;

    /** 原始檔路徑 (MVP 階段為 null，需 build-time 支援) */
    filePath: string | null;

    /** DOM 路徑 e.g., "html > body > app-root > app-product-card" */
    domPath: string;

    // ==================== 邏輯層 ====================

    /** @Input 綁定值 { 'propertyName': currentValue } */
    inputs: Record<string, unknown>;

    /** @Output 事件名稱列表 */
    outputs: string[];

    /** 組件公開屬性（非 @Input 的成員變數） */
    publicProperties: Record<string, unknown>;

    // ==================== 渲染層 ====================

    /** 原始 DOM 元素參考 */
    domElement: HTMLElement;

    /** 元素的邊界矩形（用於繪製高亮框） */
    rect: DOMRect;

    /** 關鍵 computed styles */
    computedStyles: Record<string, string>;

    // ==================== Angular 特有 ====================

    /** 應用的指令列表 */
    directives: string[];

    /** 父組件資訊（可選） */
    parent?: ParentComponentInfo;
}

/**
 * 父組件簡要資訊
 */
export interface ParentComponentInfo {
    displayName: string;
    selector: string;
}

/**
 * 使用者標註
 * 將「人類意圖」與「程式碼位置」綁定
 */
export interface UserAnnotation {
    /** 目標組件節點 */
    target: ComponentNode;

    /** 使用者的意圖描述 */
    intent: string;

    /** 截圖 (Base64) - 可選 */
    snapshotImage?: string;

    /** 標註時間戳 */
    timestamp: number;
}

/**
 * Overlay 狀態
 */
export interface OverlayState {
    /** 是否處於檢查模式 */
    isInspecting: boolean;

    /** 當前懸停的組件節點 */
    hoveredNode: ComponentNode | null;

    /** 當前選中的組件節點 */
    selectedNode: ComponentNode | null;
}

/**
 * 需要提取的關鍵 CSS 屬性列表
 */
export const KEY_COMPUTED_STYLES = [
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
] as const;

// ==================== 多選功能新增 ====================

/**
 * 標記顏色選項
 */
export type MarkerColor = 'purple' | 'blue' | 'cyan' | 'green' | 'yellow' | 'orange' | 'red';

/**
 * 標記顏色對應 HEX 值
 */
export const MARKER_COLORS: Record<MarkerColor, string> = {
    purple: '#a855f7',
    blue: '#3b82f6',
    cyan: '#06b6d4',
    green: '#22c55e',
    yellow: '#eab308',
    orange: '#f97316',
    red: '#ef4444',
};

/**
 * 單個標記
 * 代表一次點擊標記的組件
 */
export interface MarkerAnnotation {
    /** 標記編號（1, 2, 3...） */
    index: number;

    /** 目標組件節點 */
    target: ComponentNode;

    /** 使用者的意圖描述 */
    intent: string;

    /** 標記顏色 */
    color: MarkerColor;

    /** 標記時間戳 */
    timestamp: number;
}

/**
 * 錄製會話
 * 包含多個標記
 */
export interface RecordingSession {
    /** 會話 ID */
    id: string;

    /** 會話內的標記列表 */
    markers: MarkerAnnotation[];

    /** 會話開始時間 */
    startTime: number;

    /** 會話結束時間 */
    endTime?: number;

    /** 是否正在錄製中 */
    isRecording: boolean;
}

/**
 * 輸出詳細程度
 * - compact: 最簡潔，只有基本識別資訊
 * - standard: 標準模式，包含位置和基本樣式
 * - detailed: 詳細模式，包含所有屬性和上下文
 * - forensic: 完整模式，包含所有可用資訊
 */
export type OutputDetail = 'compact' | 'standard' | 'detailed' | 'forensic';

/**
 * Agentation 設定
 */
export interface AgentationSettings {
    /** 是否為深色模式 */
    isDarkMode: boolean;

    /** 輸出詳細程度 */
    outputDetail: OutputDetail;

    /** 是否顯示 Angular 組件資訊 */
    showAngularComponents: boolean;

    /** 當前標記顏色 */
    markerColor: MarkerColor;

    /** 複製/發送後清除標記 */
    clearOnCopy: boolean;

    /** 阻止頁面互動（檢查模式下） */
    blockPageInteractions: boolean;
}

/**
 * 預設設定
 */
export const DEFAULT_SETTINGS: AgentationSettings = {
    isDarkMode: false,
    outputDetail: 'forensic',
    showAngularComponents: true,
    markerColor: 'blue',
    clearOnCopy: false,
    blockPageInteractions: false,
};

/**
 * 工具列狀態
 */
export interface ToolbarState {
    /** 是否顯示設定面板 */
    showSettings: boolean;

    /** 是否顯示標記列表 */
    showMarkers: boolean;

    /** 是否正在錄製 */
    isRecording: boolean;

    /** 是否最小化 */
    isMinimized: boolean;
}

