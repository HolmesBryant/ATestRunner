/* Testing ATestrunner in Node environment */

import ATestRunner from '../src/ATestRunner.js';

const runner = new ATestRunner(import.meta.url);
const { test, group, equal, info, skip, run } = runner;

function add(a, b) {
  return a + b;
}

info("Testing ATestRunner in Node");

group("Math Tests", () => {
  test("synchronous addition", add(2, 3), 5);
  test("deep equality check", equal({ a: 1 }, { a: 1 }), true);
  test("async promise test", async () => {
    return await Promise.resolve("node-ok");
  }, "node-ok");
  skip("This should fail", false, true);
});

skip("this test is skipped", true, false);

skip("this should error", () => nonexistant.property, null);

await run();
