import assert from "node:assert/strict";
import test from "node:test";


async function loadSubject() {
  return import("../src/lib/fuelPrediction.ts").catch(() => null);
}


test("formats signed model effects for the prediction breakdown", async () => {
  const subject = await loadSubject();
  assert.ok(subject, "fuel prediction helpers should exist");
  assert.equal(subject.formatSignedPercent(7.04), "+7.0%");
  assert.equal(subject.formatSignedPercent(-3.2), "−3.2%");
  assert.equal(subject.formatSignedPercent(0), "0.0%");
});


test("derives sea state from wave height boundaries", async () => {
  const subject = await loadSubject();
  assert.ok(subject, "fuel prediction helpers should exist");
  assert.equal(subject.seaStateForWave(0.4), "Calm");
  assert.equal(subject.seaStateForWave(1.1), "Slight");
  assert.equal(subject.seaStateForWave(2.4), "Moderate");
  assert.equal(subject.seaStateForWave(4.2), "Rough");
  assert.equal(subject.seaStateForWave(7), "Very rough");
});


test("maps actual and predicted history onto a shared chart scale", async () => {
  const subject = await loadSubject();
  assert.ok(subject, "fuel prediction helpers should exist");
  const geometry = subject.buildHistoryChart([
    { sample: 1, actual: 10, predicted: 12 },
    { sample: 2, actual: 20, predicted: 18 },
    { sample: 3, actual: 30, predicted: 28 },
  ], 200, 120);

  assert.deepEqual(geometry.actual, [[24, 96], [100, 60], [176, 24]]);
  assert.deepEqual(geometry.predicted, [[24, 88.8], [100, 67.2], [176, 31.2]]);
  assert.deepEqual(geometry.domain, [10, 30]);
});
