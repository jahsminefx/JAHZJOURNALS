import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('prop-firm detail page links account, challenge, and advanced actions to distinct routes', async () => {
  const [app, detail] = await Promise.all([
    read('../src/App.jsx'),
    read('../src/pages/AccountDetail.jsx'),
  ]);

  assert.match(app, /\/accounts\/:id\/prop-firm\/edit-account/);
  assert.match(app, /\/accounts\/:id\/prop-firm\/edit-challenge-rules/);
  assert.match(app, /\/accounts\/:id\/prop-firm\/advanced-settings/);
  assert.match(detail, /prop-firm\/edit-account/);
  assert.match(detail, /prop-firm\/edit-challenge-rules/);
  assert.match(detail, /prop-firm\/advanced-settings/);
});

test('prop-firm creation and advanced forms keep mobile-friendly responsive classes', async () => {
  const files = await Promise.all([
    read('../src/components/accounts/PropFirmAccountWizard.jsx'),
    read('../src/components/accounts/PropFirmAccountDetailsStep.jsx'),
    read('../src/components/accounts/PropFirmChallengeRulesStep.jsx'),
    read('../src/components/accounts/PhaseRuleCard.jsx'),
    read('../src/components/accounts/PropFirmAdvancedSettings.jsx'),
  ]);
  const source = files.join('\n');

  assert.match(source, /flex-col/);
  assert.match(source, /sm:flex-row/);
  assert.match(source, /md:grid-cols-2/);
  assert.match(source, /md:grid-cols-3/);
  assert.match(source, /gap-[3456]/);
});
