# Copilot Instructions for NgDirectiveZero

## Tech Stack & Architecture
- **Framework:** Angular (v19.x)
- **Language:** TypeScript (ES2022 target)
- **Build Tool:** Angular CLI
- **Testing:** Karma, Jasmine
- **Package Management:** npm
- **Strict Type Checking:** Enabled via `tsconfig.json` and Angular compiler options

## Key Commands
- **Start Dev Server:**  
  `npm start` or `ng serve`  
  Opens at [http://localhost:4200](http://localhost:4200)
- **Build:**  
  `npm run build` or `ng build`  
  Output in `dist/`
- **Watch Build:**  
  `npm run watch`
- **Unit Tests:**  
  `npm test` or `ng test`
- **Code Scaffolding:**  
  `ng generate component <name>`  
  See all schematics: `ng generate --help`

## Project Structure
- **src/**: Main source code (Angular app)
- **dist/**: Build output
- **projects/**: Workspace libraries or secondary apps
- **node_modules/**: Dependencies
- **.github/**: GitHub workflows and instructions
- **README.md**: Project overview and usage

## Conventions
- Use Angular CLI for all scaffolding and builds.
- Strict TypeScript and Angular compiler options enforced.
- Peer dependencies require Angular v14+.
- All code changes should be tested with `ng test`.

## Additional Resources
- [Angular CLI Documentation](https://angular.dev/tools/cli)
- [TypeScript Configuration](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html)

## Key Files
- `package.json`: Dependencies and scripts
- `tsconfig.json`: TypeScript config
- `angular.json`: Angular project config
- `README.md`: Usage and setup instructions