import test from "node:test";
import assert from "node:assert/strict";

import {
  clampOnboardingStep,
  getOnboardingCardPosition,
  getOnboardingFocusMetrics,
  getOnboardingStep,
  getOnboardingViewModel,
} from "../src/features/onboarding/onboarding.ts";

const steps = [
  { title: "欢迎", body: "第一步", target: null, placement: "center" },
  { title: "顶部", body: "第二步", target: ".topbar", placement: "bottom" },
  { title: "底部", body: "第三步", target: ".bottom", placement: "top" },
];

test("getOnboardingStep falls back to the first step for invalid indexes", () => {
  assert.equal(getOnboardingStep(steps, 1).title, "顶部");
  assert.equal(getOnboardingStep(steps, 99).title, "欢迎");
});

test("clampOnboardingStep keeps step index inside available steps", () => {
  assert.equal(clampOnboardingStep(1, 1, steps.length), 2);
  assert.equal(clampOnboardingStep(2, 1, steps.length), 2);
  assert.equal(clampOnboardingStep(0, -1, steps.length), 0);
});

test("getOnboardingViewModel creates labels for the current step", () => {
  assert.deepEqual(getOnboardingViewModel(steps, 1), {
    step: steps[1],
    current: 2,
    total: 3,
    progress: "2 / 3",
    isFirst: false,
    isLast: false,
    nextText: "下一步",
    dots: [false, true, false],
  });

  assert.equal(getOnboardingViewModel(steps, 2).nextText, "完成");
});

test("getOnboardingFocusMetrics returns null metrics when no target exists", () => {
  assert.equal(getOnboardingFocusMetrics(null, { width: 800, height: 600 }), null);
});

test("getOnboardingFocusMetrics expands target rect and creates shade metrics", () => {
  assert.deepEqual(
    getOnboardingFocusMetrics(
      { left: 100, top: 120, width: 200, height: 80 },
      { width: 800, height: 600 },
    ),
    {
      focus: { left: 90, top: 110, width: 220, height: 100 },
      shades: {
        top: { left: 0, top: 0, width: "100%", height: 110 },
        left: { left: 0, top: 110, width: 90, height: 100 },
        right: { left: 310, top: 110, width: 490, height: 100 },
        bottom: { left: 0, top: 210, width: "100%", height: 390 },
      },
    },
  );
});

test("getOnboardingCardPosition places cards above top-placement targets", () => {
  assert.deepEqual(
    getOnboardingCardPosition({
      targetRect: { left: 200, top: 300, width: 160, height: 60, bottom: 360 },
      cardRect: { width: 240, height: 120 },
      viewport: { width: 800, height: 600 },
      placement: "top",
    }),
    { left: 160, top: 162 },
  );
});
