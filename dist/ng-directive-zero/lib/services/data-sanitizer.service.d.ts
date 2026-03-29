import * as i0 from "@angular/core";
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
export declare class DataSanitizerService {
    /** Angular 內部屬性前綴 */
    private readonly INTERNAL_PREFIXES;
    /** 最大字串長度 */
    private readonly MAX_STRING_LENGTH;
    /** 最大陣列長度 */
    private readonly MAX_ARRAY_LENGTH;
    /** 最大物件深度 */
    private readonly MAX_DEPTH;
    /**
     * 清洗單一值
     */
    sanitize(value: unknown, depth?: number): unknown;
    /**
     * 清洗字串
     */
    private sanitizeString;
    /**
     * 清洗函數
     */
    private sanitizeFunction;
    /**
     * 清洗陣列
     */
    private sanitizeArray;
    /**
     * 清洗物件
     */
    private sanitizeObject;
    /**
     * 檢查是否為內部屬性
     */
    private isInternalProperty;
    /**
     * 檢查是否為 RxJS Observable
     */
    private isObservable;
    /**
     * 檢查是否為 RxJS Subject
     */
    private isSubject;
    /**
     * 檢查是否為 Promise
     */
    private isPromise;
    /**
     * 批量清洗 Record
     */
    sanitizeRecord(record: Record<string, unknown>): Record<string, unknown>;
    static ɵfac: i0.ɵɵFactoryDeclaration<DataSanitizerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<DataSanitizerService>;
}
