import { Injectable } from '@angular/core';

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
@Injectable({
    providedIn: 'root',
})
export class DataSanitizerService {
    /** Angular 內部屬性前綴 */
    private readonly INTERNAL_PREFIXES = ['__', 'ɵ', 'ng'];

    /** 最大字串長度 */
    private readonly MAX_STRING_LENGTH = 1024;

    /** 最大陣列長度 */
    private readonly MAX_ARRAY_LENGTH = 20;

    /** 最大物件深度 */
    private readonly MAX_DEPTH = 3;

    /**
     * 清洗單一值
     */
    sanitize(value: unknown, depth = 0): unknown {
        // 深度限制
        if (depth > this.MAX_DEPTH) {
            return '[MaxDepthReached]';
        }

        // 處理 null/undefined
        if (value === null) return null;
        if (value === undefined) return undefined;

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
            return this.sanitizeObject(value as object, depth);
        }

        return String(value);
    }

    /**
     * 清洗字串
     */
    private sanitizeString(value: string): string {
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
    private sanitizeFunction(fn: Function): string {
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
    private sanitizeArray(arr: unknown[], depth: number): unknown {
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
    private sanitizeObject(obj: object, depth: number): unknown {
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
        const result: Record<string, unknown> = {};
        const keys = Object.keys(obj);

        for (const key of keys) {
            // 跳過內部屬性
            if (this.isInternalProperty(key)) {
                continue;
            }

            try {
                const value = (obj as Record<string, unknown>)[key];
                result[key] = this.sanitize(value, depth + 1);
            } catch {
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
    private isInternalProperty(key: string): boolean {
        return this.INTERNAL_PREFIXES.some((prefix) => key.startsWith(prefix));
    }

    /**
     * 檢查是否為 RxJS Observable
     */
    private isObservable(obj: unknown): boolean {
        return (
            obj !== null &&
            typeof obj === 'object' &&
            typeof (obj as { subscribe?: unknown }).subscribe === 'function' &&
            !this.isSubject(obj)
        );
    }

    /**
     * 檢查是否為 RxJS Subject
     */
    private isSubject(obj: unknown): boolean {
        return (
            obj !== null &&
            typeof obj === 'object' &&
            typeof (obj as { next?: unknown }).next === 'function' &&
            typeof (obj as { subscribe?: unknown }).subscribe === 'function'
        );
    }

    /**
     * 檢查是否為 Promise
     */
    private isPromise(obj: unknown): boolean {
        return (
            obj !== null &&
            typeof obj === 'object' &&
            typeof (obj as { then?: unknown }).then === 'function'
        );
    }

    /**
     * 批量清洗 Record
     */
    sanitizeRecord(record: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(record)) {
            if (!this.isInternalProperty(key)) {
                result[key] = this.sanitize(value);
            }
        }

        return result;
    }
}
