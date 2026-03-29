---
name: ng-directive-zero
description: Add ng-directive-zero visual feedback tools to an Angular 19+ project
---

# NgDirectiveZero Setup

Set up the NgDirectiveZero annotation toolbar in this project.

## Steps

1. **Check if already installed**
   - Look for `ng-directive-zero` in package.json dependencies (or check `projects/ng-directive-zero`)
   - If using as a library, ensure it is built/linked.

2. **Import the Module**
   - In your root module (e.g., `app.module.ts`), import `NgDirectiveZeroModule`:
     ```typescript
     import { NgDirectiveZeroModule } from 'ng-directive-zero';

     @NgModule({
       imports: [
         NgDirectiveZeroModule.forRoot(),
         // ...
       ],
       // ...
     })
     export class AppModule {}
     ```

3. **Add Component to Template**
   - Add the `<ag-directive-zero>` component to your `app.component.html` (or root template).
   - This single component handles the toolbar, overlay, settings, and state management.
   - Ideally, show it only in development mode.

   ```html
   <!-- Your App Content -->
   <router-outlet></router-outlet>

   <!-- NgDirectiveZero Tool -->
   <ag-directive-zero *ngIf="isDevMode"></ag-directive-zero>
   ```

4. **Verify Setup**
   - Run the app and check if the toolbar appears.
   - Click the play button (▶) to start recording.
   - Click on elements to add markers.

## Notes

- The `<ag-directive-zero>` component encapsulates all state logic (recording, markers, settings).
- Ensure Styles are imported if not automatically included by the library build.
