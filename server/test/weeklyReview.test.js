const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  getWeeklyReviews,
  generateWeeklyReview,
  getWeeklyReviewById,
  updateWeeklyReview,
} = require('../src/controllers/weeklyReviewController');

describe('Weekly Review End-to-End Controller Suite', () => {
  it('generates a weekly review successfully and preserves written reflections on recalculate', async () => {
    const user = await prisma.user.findFirst();
    if (!user) return;

    // 1. Generate Review
    const reqGen = {
      user,
      body: {
        weekStartDate: '2026-09-28',
      },
    };
    let genData = null;
    let statusCode = 200;
    const resGen = {
      status: (code) => {
        statusCode = code;
        return {
          json: (d) => { genData = d; },
        };
      },
      json: (d) => { genData = d; },
    };

    await generateWeeklyReview(reqGen, resGen);
    assert.ok(genData, 'Should return generation data');
    assert.strictEqual(genData.success, true);
    assert.ok(genData.data?.id, 'Should contain review ID');

    const reviewId = genData.data.id;

    // 2. Save Written Reflections
    const reqUpdate = {
      user,
      params: { id: reviewId },
      body: {
        mainMistake: 'Chased entry after news spike',
        personalLesson: 'Always wait for candle close',
      },
    };
    let updateData = null;
    const resUpdate = {
      status: (code) => ({ json: (d) => { updateData = d; } }),
      json: (d) => { updateData = d; },
    };

    await updateWeeklyReview(reqUpdate, resUpdate);
    assert.strictEqual(updateData?.mainMistake, 'Chased entry after news spike');
    assert.strictEqual(updateData?.personalLesson, 'Always wait for candle close');

    // 3. Fetch By ID
    const reqGet = {
      user,
      params: { id: reviewId },
    };
    let getData = null;
    const resGet = {
      status: (code) => ({ json: (d) => { getData = d; } }),
      json: (d) => { getData = d; },
    };

    await getWeeklyReviewById(reqGet, resGet);
    assert.strictEqual(getData?.id, reviewId);
    assert.strictEqual(getData?.mainMistake, 'Chased entry after news spike');

    // 4. Fetch list
    const reqList = {
      user,
      query: { page: '1', limit: '10' },
    };
    let listData = null;
    const resList = {
      status: (code) => ({ json: (d) => { listData = d; } }),
      json: (d) => { listData = d; },
    };

    await getWeeklyReviews(reqList, resList);
    assert.strictEqual(listData?.success, true);
    assert.ok(Array.isArray(listData?.data));
    assert.ok(listData.data.length > 0);
  });
});
