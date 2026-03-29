import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserAnnotation } from '../models/component-node.interface';
import * as i0 from "@angular/core";
export interface McpStatus {
    connected: boolean;
    sessionId?: string;
    lastError?: string;
}
export interface McpAnnotation extends UserAnnotation {
    id: string;
    sessionId: string;
    url: string;
    status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
}
export declare class McpService {
    private http;
    private readonly API_URL;
    private _status;
    status$: Observable<McpStatus>;
    private _annotations;
    annotations$: Observable<McpAnnotation[]>;
    constructor(http: HttpClient);
    /**
     * Check if the MCP server is reachable
     */
    checkConnection(): Promise<boolean>;
    /**
     * Establish a new session or restore existing one
     */
    connect(existingSessionId?: string): Promise<string>;
    /**
     * Send an annotation to the MCP server
     */
    sendAnnotation(annotation: UserAnnotation): Promise<void>;
    /**
     * Poll for updates (e.g., resolve/dismiss status from agent)
     */
    private startPolling;
    private updateStatus;
    static ɵfac: i0.ɵɵFactoryDeclaration<McpService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<McpService>;
}
