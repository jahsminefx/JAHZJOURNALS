import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrc = path.join(__dirname, '..', 'src');

test('1. Full Codebase Audit - Zero native window.alert/confirm/prompt remain in client/src', () => {
  const getAllFiles = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath));
      } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(fullPath);
      }
    });
    return results;
  };

  const files = getAllFiles(clientSrc);
  const violations = [];

  // Regex targeting native dialog invocations:
  // e.g. window.alert(...), window.confirm(...), window.prompt(...), alert(...), confirm(...), prompt(...)
  const prohibitedPattern = /\b(window\.)?(alert|confirm|prompt)\s*\(/g;

  files.forEach((filePath) => {
    const relativePath = path.relative(clientSrc, filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    // Remove single-line comments and multi-line comments before checking
    const stripped = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    const lines = stripped.split('\n');
    lines.forEach((line, index) => {
      // Exclude dialog.confirm, dialog.prompt, dialog.alert, globalOverlayHandler.confirm, etc.
      const sanitizedLine = line
        .replace(/dialog\.(confirm|prompt|alert)/g, '')
        .replace(/globalOverlayHandler\.(confirm|prompt|alert)/g, '')
        .replace(/handler\.(confirm|prompt|alert)/g, '')
        .replace(/export\s+const\s+(confirm|prompt|alert)/g, '')
        .replace(/const\s+\{.*(confirm|prompt|alert).*\}\s*=/g, '');

      if (prohibitedPattern.test(sanitizedLine)) {
        violations.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      }
    });
  });

  assert.deepEqual(
    violations,
    [],
    `Found prohibited native dialog calls in client/src:\n${violations.join('\n')}`
  );
});

test('2. Strategy archive/delete flow uses branded custom confirmation with required copy', () => {
  const strategyContent = fs.readFileSync(
    path.join(clientSrc, 'components', 'settings', 'StrategySettings.jsx'),
    'utf8'
  );

  // Must import custom dialog
  assert.ok(
    strategyContent.includes("from '../common/dialog'") ||
    strategyContent.includes('dialog.confirm'),
    'StrategySettings imports dialog'
  );

  // Must not have window.confirm
  assert.equal(
    strategyContent.includes('window.confirm'),
    false,
    'StrategySettings has no window.confirm'
  );

  // Must have required title and body copy
  assert.ok(strategyContent.includes("title: 'Archive strategy?'"), 'Has title "Archive strategy?"');
  assert.ok(
    strategyContent.includes('will be archived and removed from your active playbook'),
    'Has required body explanation'
  );
  assert.ok(strategyContent.includes("confirmText: 'Archive strategy'"), 'Has confirm button "Archive strategy"');
  assert.ok(strategyContent.includes("cancelText: 'Cancel'"), 'Has cancel button "Cancel"');
  assert.ok(strategyContent.includes("variant: 'danger'"), 'Has danger variant');
});

test('3. Custom dialog service API contract and singleton dispatcher', async () => {
  const { dialog, registerOverlayHandler } = await import(
    '../src/components/common/dialog/dialogService.js'
  );

  // Test fallback before handler registration
  const fallbackConfirm = await dialog.confirm();
  assert.equal(fallbackConfirm, false, 'Default confirm returns false without handler');

  const fallbackPrompt = await dialog.prompt();
  assert.equal(fallbackPrompt, null, 'Default prompt returns null without handler');

  // Mock handler registration
  let capturedOptions = null;
  const unregister = registerOverlayHandler({
    confirm: async (opts) => {
      capturedOptions = opts;
      return true;
    },
    prompt: async (opts) => {
      capturedOptions = opts;
      return 'test-input';
    },
    alert: async (opts) => {
      capturedOptions = opts;
    },
  });

  const resConfirm = await dialog.confirm({ title: 'Test Confirm', variant: 'danger' });
  assert.equal(resConfirm, true);
  assert.equal(capturedOptions.title, 'Test Confirm');
  assert.equal(capturedOptions.variant, 'danger');

  const resPrompt = await dialog.prompt({ title: 'Test Prompt', placeholder: 'Enter name' });
  assert.equal(resPrompt, 'test-input');
  assert.equal(capturedOptions.placeholder, 'Enter name');

  unregister();
});

test('4. DashboardFilters uses CustomSelect instead of native <select> elements', () => {
  const filtersContent = fs.readFileSync(
    path.join(clientSrc, 'components', 'dashboard', 'DashboardFilters.jsx'),
    'utf8'
  );

  assert.equal(
    filtersContent.includes('<select'),
    false,
    'DashboardFilters must not contain any native <select> elements'
  );
  assert.ok(
    filtersContent.includes('<CustomSelect'),
    'DashboardFilters must render CustomSelect component'
  );
  assert.ok(
    filtersContent.includes('id="dashboard-account-filter"'),
    'DashboardFilters account selector has accessible id'
  );
  assert.ok(
    filtersContent.includes('id="dashboard-daterange-filter"'),
    'DashboardFilters date range selector has accessible id'
  );
});

test('5. CustomSelect component enforces combobox and listbox accessibility semantics', () => {
  const selectContent = fs.readFileSync(
    path.join(clientSrc, 'components', 'common', 'CustomSelect.jsx'),
    'utf8'
  );

  // Accessibility requirements
  assert.ok(selectContent.includes('role="combobox"'), 'Trigger has role="combobox"');
  assert.ok(selectContent.includes('aria-haspopup="listbox"'), 'Trigger has aria-haspopup="listbox"');
  assert.ok(selectContent.includes('aria-expanded={isOpen}'), 'Trigger has dynamic aria-expanded state');
  assert.ok(selectContent.includes('role="listbox"'), 'Dropdown list has role="listbox"');
  assert.ok(selectContent.includes('role="option"'), 'Dropdown options have role="option"');
  assert.ok(selectContent.includes('aria-selected={isSelected}'), 'Options indicate selection via aria-selected');
});

test('6. DialogOverlay component enforces modal accessibility and theme tokens', () => {
  const dialogContent = fs.readFileSync(
    path.join(clientSrc, 'components', 'common', 'dialog', 'DialogOverlay.jsx'),
    'utf8'
  );

  // Portal and accessibility
  assert.ok(dialogContent.includes('createPortal'), 'Dialog is rendered in a portal');
  assert.ok(dialogContent.includes('aria-modal="true"'), 'Dialog has aria-modal="true"');
  assert.ok(dialogContent.includes('aria-labelledby="overlay-dialog-title"'), 'Dialog has accessible title association');
  assert.ok(dialogContent.includes('aria-describedby="overlay-dialog-description"'), 'Dialog has accessible description association');
  assert.ok(dialogContent.includes("role={isDanger ? 'alertdialog' : 'dialog'}"), 'Uses alertdialog for danger and dialog for general');

  // Theme tokens
  assert.ok(dialogContent.includes('bg-surface'), 'Uses bg-surface token');
  assert.ok(dialogContent.includes('border-border'), 'Uses border-border token');
  assert.ok(dialogContent.includes('text-foreground'), 'Uses text-foreground token');
  assert.ok(dialogContent.includes('bg-red-600'), 'Destructive button uses clear high-contrast red');
  assert.ok(dialogContent.includes('bg-emerald-600'), 'Primary button uses emerald brand colour');
});

test('7. Lint configuration prevents regressions with no-alert rule', () => {
  const oxlintConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '.oxlintrc.json'), 'utf8')
  );

  assert.equal(
    oxlintConfig.rules['no-alert'],
    'error',
    'oxlint configuration must enforce "no-alert": "error"'
  );
});
