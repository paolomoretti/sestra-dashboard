# Development Guide

This project uses high-quality linting and TypeScript configuration to maintain code standards.

## Code Quality Tools

### ESLint
- **TypeScript**: Full type checking with strict rules
- **Vue**: Vue 3 best practices and component structure
- **General**: Code quality, anti-patterns, and best practices

### Prettier
- Consistent code formatting
- Integrated with ESLint
- Format on save enabled in VS Code

### TypeScript
- Strict mode enabled
- Type checking for all files
- Enhanced error detection

## Available Scripts

```bash
# Run linting with auto-fix
npm run lint

# Check linting without fixing
npm run lint:check

# Run TypeScript type checking
npm run type-check

# Format code with Prettier
npm run format

# Check formatting without changing files
npm run format:check

# Run all checks (type-check + lint + format check)
npm run check

# Auto-fix all issues (lint + format)
npm run fix
```

## Code Quality Standards

### TypeScript Rules
- ✅ Strict mode enabled
- ✅ No implicit returns
- ✅ No unchecked indexed access
- ✅ Force consistent casing
- ✅ Exact optional property types

### ESLint Rules
- ✅ No unused variables (except prefixed with `_`)
- ✅ No floating promises (must await or handle)
- ✅ Prefer nullish coalescing (`??`) over `||`
- ✅ Prefer optional chaining (`?.`)
- ✅ No `any` types (warnings only)
- ✅ Vue component best practices

### Prettier Configuration
- Single quotes
- 2 spaces indentation
- 100 character line width
- Trailing commas (ES5)
- Semicolons enabled

## VS Code Setup

The project includes `.vscode/settings.json` with:
- Format on save enabled
- ESLint auto-fix on save
- Prettier as default formatter

Make sure you have these VS Code extensions installed:
- ESLint
- Prettier
- Vue Language Features (Volar)
- TypeScript Vue Plugin (Volar)

## Pre-commit (Optional)

Consider adding a pre-commit hook to run checks before committing:

```bash
npm install --save-dev husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npm run check"
```

## CI/CD Integration

Add to your CI pipeline:
```yaml
- run: npm ci
- run: npm run check
```

