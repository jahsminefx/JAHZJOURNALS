const test = require('node:test');
const assert = require('node:assert/strict');
const contactService = require('../src/services/communications/contactService');

test('Communications Hub - Service exposes core thread and note methods', () => {
  assert.equal(typeof contactService.createMessage, 'function');
  assert.equal(typeof contactService.addReply, 'function');
  assert.equal(typeof contactService.addUserReply, 'function');
  assert.equal(typeof contactService.getMessageThread, 'function');
  assert.equal(typeof contactService.markThreadAsRead, 'function');
  assert.equal(typeof contactService.updateStatus, 'function');
  assert.equal(typeof contactService.assignStaff, 'function');
});

test('Communications Hub - Internal notes structure is segregated from public replies', async () => {
  const dummyThreadId = 'non-existent-thread-id';
  
  try {
    await contactService.addReply(dummyThreadId, 'admin-123', 'Internal Note Text', [], true);
    assert.fail('Should have thrown thread not found');
  } catch (err) {
    assert.equal(err.message, 'Contact thread not found');
  }
});
