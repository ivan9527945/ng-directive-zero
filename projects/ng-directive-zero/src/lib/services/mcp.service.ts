import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, timer, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { UserAnnotation } from '../models/component-node.interface';

export interface McpStatus {
    connected: boolean;
    sessionId?: string;
    lastError?: string;
}

export interface McpAnnotation extends UserAnnotation {
    id: string; // Server assignment or client generated
    sessionId: string;
    url: string;
    status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
}

@Injectable({
    providedIn: 'root'
})
export class McpService {
    private readonly API_URL = 'http://localhost:4747';
    private _status = new BehaviorSubject<McpStatus>({ connected: false });
    public status$ = this._status.asObservable();

    // Store annotations state locally for UI updates
    private _annotations = new BehaviorSubject<McpAnnotation[]>([]);
    public annotations$ = this._annotations.asObservable();

    constructor(private http: HttpClient) {
        // Attempt initial connection
        this.checkConnection();
    }

    /**
     * Check if the MCP server is reachable
     */
    async checkConnection(): Promise<boolean> {
        try {
            await this.http.get(`${this.API_URL}/status`).toPromise();
            this.updateStatus({ connected: true, lastError: undefined });
            return true;
        } catch (error) {
            this.updateStatus({ connected: false, lastError: 'Could not connect to MCP server' });
            return false;
        }
    }

    /**
     * Establish a new session or restore existing one
     */
    async connect(existingSessionId?: string): Promise<string> {
        if (!await this.checkConnection()) {
            throw new Error('MCP Server not reachable');
        }

        const sessionId = existingSessionId || uuidv4();

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
    async sendAnnotation(annotation: UserAnnotation): Promise<void> {
        const currentStatus = this._status.value;
        if (!currentStatus.connected || !currentStatus.sessionId) {
            throw new Error('Not connected to MCP server');
        }

        const mcpAnnotation: McpAnnotation = {
            ...annotation,
            id: uuidv4(),
            sessionId: currentStatus.sessionId,
            url: window.location.href,
            status: 'pending'
        };

        try {
            await this.http.post(`${this.API_URL}/annotations`, mcpAnnotation).toPromise();

            // Optimistic update
            const currentList = this._annotations.value;
            this._annotations.next([...currentList, mcpAnnotation]);
        } catch (error) {
            console.error('Failed to send annotation', error);
            throw error;
        }
    }

    /**
     * Poll for updates (e.g., resolve/dismiss status from agent)
     */
    private startPolling(sessionId: string) {
        // Simple polling every 2 seconds
        timer(0, 2000).pipe(
            switchMap(() => this.http.get<McpAnnotation[]>(`${this.API_URL}/sessions/${sessionId}/annotations`).pipe(
                catchError(() => of([])) // Handle errors silently in polling
            ))
        ).subscribe(annotations => {
            if (annotations && annotations.length > 0) {
                this._annotations.next(annotations);
            }
        });
    }

    private updateStatus(newStatus: Partial<McpStatus>) {
        this._status.next({ ...this._status.value, ...newStatus });
    }
}
