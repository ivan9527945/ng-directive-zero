import { TestBed } from '@angular/core/testing';
import { PromptGeneratorService } from './prompt-generator.service';
import { DataSanitizerService } from './data-sanitizer.service';
import { ComponentNode, OutputDetail } from '../models/component-node.interface';

describe('PromptGeneratorService', () => {
    let service: PromptGeneratorService;
    let mockDataSanitizer: jasmine.SpyObj<DataSanitizerService>;

    // Mock ComponentNode
    const createMockNode = (overrides: Partial<ComponentNode> = {}): ComponentNode => {
        const domElementMock = {
            tagName: 'DIV',
            getAttribute: (attr: string) => {
                if (attr === 'role') return 'region';
                if (attr === 'aria-label') return 'Test Region';
                if (attr === 'type') return 'text';
                return null;
            },
            textContent: 'Test Content',
            className: 'test-class other-class',
            parentElement: {
                children: [
                    { tagName: 'SPAN', className: 'sibling', textContent: 'Sibling 1' },
                    { tagName: 'DIV', className: 'self', textContent: 'Test Content' }, // Self
                    { tagName: 'BUTTON', className: 'btn', textContent: 'Sibling 2' }
                ],
                className: 'parent-class'
            }
        } as unknown as HTMLElement;

        return {
            id: 'test-node-1',
            domElement: domElementMock,
            domPath: 'body > div > div.test-class',
            selector: 'app-test-component',
            displayName: 'app-test-component', // Added displayName to match selector for testing
            rect: { x: 100, y: 200, width: 300, height: 150, top: 200, left: 100, right: 400, bottom: 350 },
            computedStyles: {
                'color': 'rgb(0, 0, 0)',
                'background-color': 'rgb(255, 255, 255)',
                'font-size': '16px',
                'display': 'block',
                'position': 'relative'
            },
            ...overrides
        } as ComponentNode;
    };

    beforeEach(() => {
        mockDataSanitizer = jasmine.createSpyObj('DataSanitizerService', ['sanitize']);

        TestBed.configureTestingModule({
            providers: [
                PromptGeneratorService,
                { provide: DataSanitizerService, useValue: mockDataSanitizer }
            ]
        });
        service = TestBed.inject(PromptGeneratorService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('generatePageFeedback', () => {
        const mockNode = createMockNode();
        const markers = [{ target: mockNode, intent: 'Fix styling' }];
        const baseOptions = {
            pageUrl: 'https://example.com/test',
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 TestAgent',
            timestamp: 1700000000000 // Fixed timestamp for testing
        };

        it('should generate COMPACT output correctly', () => {
            const output = service.generatePageFeedback(markers, {
                ...baseOptions,
                outputDetail: 'compact'
            });

            expect(output).toContain('## Page Feedback');
            expect(output).not.toContain('**Environment:**'); // Compact shouldn't have environment
            expect(output).toContain('### 1. app-test-component');
            expect(output).toContain('**Selector:** `<app-test-component>`');
            expect(output).toContain('**Feedback:** Fix styling');
            expect(output).not.toContain('**Position:**'); // Shouldn't be in compact
        });

        it('should generate STANDARD output correctly', () => {
            const output = service.generatePageFeedback(markers, {
                ...baseOptions,
                outputDetail: 'standard'
            });

            expect(output).toContain('## Page Feedback: /test');
            expect(output).toContain('**Environment:**');
            expect(output).toContain('- Viewport: 1920×1080');
            expect(output).toContain('- URL: https://example.com/test');

            expect(output).toContain('### 1. app-test-component');
            expect(output).toContain('**Full DOM Path:** body > div > div.test-class');
            expect(output).toContain('**CSS Classes:** test-class, other-class');
            expect(output).toContain('**Position:** x:100, y:200 (300×150px)');
            expect(output).toContain('**Computed Styles:** color: rgb(0, 0, 0); background-color: rgb(255, 255, 255); font-size: 16px; display: block; position: relative');
            expect(output).toContain('**Feedback:** Fix styling');
            // Standard shouldn't have detailed info
            expect(output).not.toContain('**Annotation at:**');
            expect(output).not.toContain('**Nearby Elements:**');
        });

        it('should generate DETAILED output correctly', () => {
            const output = service.generatePageFeedback(markers, {
                ...baseOptions,
                outputDetail: 'detailed'
            });

            expect(output).toContain('### 1. app-test-component');
            expect(output).toContain('**Full DOM Path:** body > div > div.test-class');
            // Detailed specific checks
            expect(output).toContain('**Annotation at:**'); // x: 100 + 300/2 = 250. 250/1024(mock window width?) - note: window.innerWidth is mocked implicitly or needs spy? 
            // Note: window.innerWidth usage in service might depend on global window. 
            // Ideally we should mock window or check simpler existence first.

            // Checking content and styles
            expect(output).toContain('**Context:** Test Content');
            expect(output).toContain('**Computed Styles:** color: rgb(0, 0, 0); background-color: rgb(255, 255, 255)');
            expect(output).toContain('**Accessibility:**'); // focusable checking might fail if tabindex not set, let's check what we mocked
            // In mock we didn't set tabindex, so 'focusable' might not be there.
            // But we set aria-label and role.
            expect(output).toContain('aria-label: "Test Region"');
            expect(output).toContain('role: region');

            expect(output).toContain('**Nearby Elements:**');
            expect(output).toContain('span.sibling "Sibling 1"');
        });

        it('should generate FORENSIC output correctly', () => {
            const output = service.generatePageFeedback(markers, {
                ...baseOptions,
                outputDetail: 'forensic'
            });

            expect(output).toContain('### 1. app-test-component');
            expect(output).toContain('**Full DOM Path:** body > div > div.test-class');
            expect(output).toContain('**Position:** x:100, y:200');
            expect(output).toContain('**Annotation at:**');
            expect(output).toContain('**Context:** Test Content');
            expect(output).toContain('**Computed Styles:**');
            expect(output).toContain('**Nearby Elements:**');
            expect(output).toContain('**Feedback:** Fix styling');
        });

        it('should handle missing optional environment data', () => {
            const output = service.generatePageFeedback(markers, {
                outputDetail: 'standard'
            });

            expect(output).toContain('## Page Feedback: /'); // Default URL path
            expect(output).not.toContain('- Viewport:');
            expect(output).not.toContain('- User Agent:');
        });

        it('should truncate long text content in Context', () => {
            const longTextNode = createMockNode();
            // Spy on textContent getter or just modify the mock property if possible. 
            // Since it's a property on the fake node object, we can just set it.
            // But service accesses node.domElement.textContent. 
            Object.defineProperty(longTextNode.domElement, 'textContent', {
                value: 'A'.repeat(300)
            });

            const output = service.generatePageFeedback([{ target: longTextNode, intent: '' }], {
                ...baseOptions,
                outputDetail: 'detailed'
            });

            expect(output).toContain('...');
            expect(output.length).toBeLessThan(10000); // Sanity check
        });
    });

    describe('getElementType', () => {
        // Helper to access private method for testing specific logic if needed, 
        // OR just test via public API 'generateMarkerOutput'

        it('should identify input types correctly', () => {
            const inputNode = createMockNode({
                selector: '', // Clear selector to force tag-based fallback
                displayName: '', // Clear displayName to force tag-based fallback
                domElement: {
                    tagName: 'INPUT',
                    getAttribute: (attr: string) => attr === 'type' ? 'checkbox' : null,
                    textContent: '',
                    className: ''
                } as any
            });

            const output = service.generatePageFeedback([{ target: inputNode, intent: '' }], {
                outputDetail: 'compact'
            });

            expect(output).toContain('### 1. input[checkbox]');
        });

        it('should identify buttons with text', () => {
            const btnNode = createMockNode({
                selector: '',
                displayName: '', // Clear displayName
                domElement: {
                    tagName: 'BUTTON',
                    getAttribute: () => null,
                    textContent: 'Submit',
                    className: 'btn-primary'
                } as any
            });

            const output = service.generatePageFeedback([{ target: btnNode, intent: '' }], {
                outputDetail: 'compact'
            });

            expect(output).toContain('### 1. button "Submit"');
        });
    });
});
