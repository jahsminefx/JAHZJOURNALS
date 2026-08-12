const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const {
  getAvailablePromotions,
  getMyRedeemedPromotions,
  getPromotionDetails,
  redeemPromotionById,
  redeemPromotionByCode
} = require('../src/controllers/traderPromotionController');

test('Trader Promotion Discovery - getAvailablePromotions lists live eligible promotions', async () => {
  // Create a live test promotion
  const slug = `disc_test_${Date.now()}`;
  const promo = await prisma.promotion.create({
    data: {
      name: 'Discovery Test Promo',
      slug,
      description: 'Test discovery',
      planGranted: 'PRO',
      isActive: true
    }
  });

  const testUser = await prisma.user.create({
    data: {
      email: `disc_user_${Date.now()}@jahzjournals.com`,
      name: 'Disc User',
      passwordHash: 'hash',
      role: 'TRADER',
      subscriptionPlan: 'FREE'
    }
  });

  let resBody = null;
  const req = { user: { id: testUser.id, subscriptionPlan: 'FREE' } };
  const res = { json: (b) => { resBody = b; } };

  await getAvailablePromotions(req, res);

  assert.ok(resBody.promotions);
  const found = resBody.promotions.find(p => p.id === promo.id);
  assert.ok(found, 'Live promotion must be visible in available list');
  assert.equal(found.isRedeemed, false);

  // Cleanup
  await prisma.promotion.delete({ where: { id: promo.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
});

test('Trader Promotion Redemption - redeemPromotionByCode upgrades user and creates history & notification', async () => {
  const slug = `code_redeem_${Date.now()}`;
  const promo = await prisma.promotion.create({
    data: {
      name: 'Code Redeem Test Promo',
      slug,
      description: 'Test code redemption',
      planGranted: 'PRO',
      isActive: true
    }
  });

  const testUser = await prisma.user.create({
    data: {
      email: `code_user_${Date.now()}@jahzjournals.com`,
      name: 'Code User',
      passwordHash: 'hash',
      role: 'TRADER',
      subscriptionPlan: 'FREE'
    }
  });

  let resBody = null;
  let statusCode = 200;
  const req = {
    body: { code: slug },
    user: { id: testUser.id, email: testUser.email }
  };
  const res = {
    status(c) { statusCode = c; return this; },
    json(b) { resBody = b; }
  };

  await redeemPromotionByCode(req, res);

  assert.equal(statusCode, 200);
  assert.match(resBody.message, /successfully redeemed/i);

  // Verify DB state
  const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
  assert.equal(updatedUser.subscriptionPlan, 'PRO');

  const history = await prisma.subscriptionHistory.findFirst({
    where: { userId: testUser.id, promotionId: promo.id }
  });
  assert.ok(history);
  assert.equal(history.source, 'PROMOTION');

  // Verify in-app notification recipient created
  const notifRecipient = await prisma.notificationRecipient.findFirst({
    where: { userId: testUser.id }
  });
  assert.ok(notifRecipient);

  // Test duplicate redemption rejection
  let dupStatusCode = 200;
  let dupBody = null;
  const dupRes = {
    status(c) { dupStatusCode = c; return this; },
    json(b) { dupBody = b; }
  };

  await redeemPromotionByCode(req, dupRes);
  assert.equal(dupStatusCode, 400);
  assert.match(dupBody.message, /already redeemed/i);

  // Cleanup
  await prisma.notificationRecipient.deleteMany({ where: { userId: testUser.id } });
  await prisma.subscriptionHistory.deleteMany({ where: { userId: testUser.id } });
  await prisma.subscription.deleteMany({ where: { userId: testUser.id } });
  await prisma.promotion.delete({ where: { id: promo.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
});
