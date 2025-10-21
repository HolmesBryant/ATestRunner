import { test, describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import ATestRunner from '../src/ATestRunner.js';

// =============================================================================
// MOCK SETUP
// Mock browser-specific APIs that do not exist in the Node.js environment.
// =============================================================================

// Mock `performance.now()` for predictable benchmark tests.
global.performance = {
  now: () => Date.now(),
};

// --- START: DOM Mocks ---

class MockElement {
  constructor() {
    this.dispatchedEvents = [];
    this.appendedChildren = [];
  }
  dispatchEvent(event) {
    this.dispatchedEvents.push(event);
  }
  append(element) {
    this.appendedChildren.push(element);
  }
}

class MockOutputElement {
    constructor() {
        this.value = '';
    }
}

// setupDOM creates the mock environment before each DOM test.
const setupDOM = () => {
  global.HTMLElement = MockElement;
  global.ProgressEvent = class ProgressEvent {
    constructor(type, detail) {
      this.type = type;
      Object.assign(this, detail);
    }
  };
  global.CustomEvent = class CustomEvent {
    constructor(type, detail) {
      this.type = type;
      this.detail = detail.detail;
    }
  };
  global.document = {
    _mockElement: null, // Private singleton for the selector
    querySelector: (selector) => {
      if (selector === '#output-element') {
        if (!global.document._mockElement) {
          global.document._mockElement = new MockElement();
        }
        return global.document._mockElement;
      }
      return null;
    },
    createElement: (tag) => {
        if (tag === 'output') {
            return new MockOutputElement();
        }
        return new MockElement();
    }
  };
};

// teardownDOM cleans up the mocks after each DOM test.
const teardownDOM = () => {
  delete global.HTMLElement;
  delete global.ProgressEvent;
  delete global.CustomEvent;
  delete global.document;
};

// --- END: DOM Mocks ---


// =============================================================================
// TEST SUITE
// =============================================================================

describe('ATestRunner Class', () => {

  describe('Constructor and Properties', () => {
    it('should initialize with default properties', () => {
      const runner = new ATestRunner();
      assert.strictEqual(runner.metaURL, undefined, 'metaURL should be undefined');
      assert.strictEqual(runner.onlyFailed, false, 'onlyFailed should be false');
      assert.strictEqual(runner.output, 'console', 'output should default to "console"');
      assert.strictEqual(runner.finalVerdict, 'pass', 'finalVerdict should start as "pass"');
    });

    it('should set metaURL from the constructor', () => {
      const url = 'file:///path/to/test.js';
      const runner = new ATestRunner(url);
      assert.strictEqual(runner.metaURL, url, 'metaURL should be set from constructor');
    });
  });

  describe('Execution Method: run()', () => {
    // We spy on console methods to verify output without polluting the test runner's output.
    const spies = {};
    const originalConsole = { ...console };

    beforeEach(() => {
        spies.log = [];
        spies.groupCollapsed = [];
        console.log = (...args) => spies.log.push(args);
        console.groupCollapsed = (...args) => spies.groupCollapsed.push(args);
        console.groupEnd = () => {}; // No-op
    });

    afterEach(() => {
        Object.assign(console, originalConsole);
    });

    it('should correctly queue and execute tests and info messages', async () => {
      const runner = new ATestRunner();

      runner.info('Starting tests');
      runner.test('A passing test', () => true, true);
      runner.test('A failing test', () => 42, 0);

      await runner.run();

      assert.strictEqual(spies.log.some(args => args.includes('Starting tests')), true, 'Info message should be logged');
      assert.strictEqual(spies.groupCollapsed.length, 2, 'Two tests should have been logged');
      assert.strictEqual(spies.groupCollapsed[0].includes('A passing test'), true);
      assert.strictEqual(spies.groupCollapsed[1].includes('A failing test'), true);
    });

    it('should correctly execute a passing synchronous test', async () => {
      const runner = new ATestRunner();
      runner.test('sync pass', () => 2 + 2, 4);
      await runner.run();
      assert.strictEqual(runner.finalVerdict, 'pass');
    });

    it('should correctly execute a failing test and update verdict', async () => {
      const runner = new ATestRunner();
      runner.test('sync fail', 2 + 2, 5);
      await runner.run();
      assert.strictEqual(runner.finalVerdict, 'fail');
    });

    it('should handle tests that throw an error', async () => {
      const runner = new ATestRunner();
      runner.test('throwing error', () => { throw new Error('Oops'); }, 'any');
      await runner.run();
      assert.strictEqual(runner.finalVerdict, 'fail');
    });

    it('should correctly execute a passing asynchronous test', async () => {
      const runner = new ATestRunner();
      runner.test('async pass', () => Promise.resolve('ok'), 'ok');
      await runner.run();
      assert.strictEqual(runner.finalVerdict, 'pass');
    });

    it('should correctly execute a failing asynchronous test', async () => {
      const runner = new ATestRunner();
      runner.test('async fail', () => Promise.resolve('ok'), 'not ok');
      await runner.run();
      assert.strictEqual(runner.finalVerdict, 'fail');
    });

    it('should handle asynchronous tests that reject', async () => {
      const runner = new ATestRunner();
      runner.test('async reject', () => Promise.reject('error'), 'any');
      await runner.run();
      assert.strictEqual(runner.finalVerdict, 'fail');
    });
  });

  describe('DOM Interaction', () => {
    beforeEach(setupDOM);
    afterEach(teardownDOM);

    it('should set output to an HTMLElement instance', () => {
      const runner = new ATestRunner();
      const el = new HTMLElement();
      runner.output = el;
      assert.strictEqual(runner.output, el);
    });

    it('should set output to an element found by a CSS selector', () => {
      const runner = new ATestRunner();
      runner.output = '#output-element';
      const expectedElement = global.document.querySelector('#output-element');
      assert.ok(expectedElement, 'Mock element should be found');
      assert.strictEqual(runner.output, expectedElement);
    });

    it('should throw an error if CSS selector for output is not found', () => {
      const runner = new ATestRunner();
      assert.throws(
        () => {
          runner.output = '#not-found';
        },
        new Error('Cannot find output target: #not-found ')
      );
    });

    it('should dispatch progress and complete events to the output element', async () => {
      const runner = new ATestRunner();
      runner.output = '#output-element';
      const outputElement = runner.output;

      runner.test('Test 1', () => true, true);
      runner.info('Info message');
      await runner.run();

      const progressEvents = outputElement.dispatchedEvents.filter(e => e.type === 'progress');
      const completeEvent = outputElement.dispatchedEvents.find(e => e.type === 'complete');

      assert.strictEqual(progressEvents.length, 3, 'Should be 3 progress events: 0/2, 1/2, 2/2');
      assert.strictEqual(progressEvents[0].loaded, 0);
      assert.strictEqual(progressEvents[1].loaded, 1);
      assert.strictEqual(progressEvents[2].loaded, 2);
      assert.strictEqual(progressEvents[2].total, 2);

      assert.ok(completeEvent, 'A "complete" event should have been dispatched');
      assert.strictEqual(completeEvent.detail.verdict, 'pass');
    });

    it('should append test results as <output> elements to the DOM target', async () => {
        const runner = new ATestRunner();
        runner.output = '#output-element';
        const outputElement = runner.output;

        runner.info('An info message');
        runner.test('A failing test', () => 'actual', 'expected');
        runner.test('A test that errors', () => { throw new Error('Test crash'); }, 'anything');

        await runner.run();

        // ATestRunner automatically adds an extra child for "All tests completed"
        assert.strictEqual(outputElement.appendedChildren.length, 4, "Should append 4 results");

        const failResult = JSON.parse(outputElement.appendedChildren[1].value);
        assert.strictEqual(failResult.verdict, 'fail');
        assert.strictEqual(failResult.gist, 'A failing test');

        const errorResult = JSON.parse(outputElement.appendedChildren[2].value);
        assert.strictEqual(errorResult.verdict, 'error');
        assert.strictEqual(errorResult.gist, 'A test that errors');
        assert.ok(Array.isArray(errorResult.result), 'Error result should be a stack array');
        assert.strictEqual(errorResult.result[0], 'Test crash');
    });
  });

  describe('Utility Method: equal()', () => {
    const runner = new ATestRunner();

    it('should compare primitives correctly', () => {
      assert.strictEqual(runner.equal(1, 1), true);
      assert.strictEqual(runner.equal('a', 'a'), true);
      assert.strictEqual(runner.equal(1, '1'), false);
    });

    it('should compare arrays and objects deeply', () => {
      assert.strictEqual(runner.equal({ a: 1, b: [2] }, { a: 1, b: [2] }), true);
      assert.strictEqual(runner.equal({ a: 1, b: [2] }, { a: 1, b: [3] }), false);
    });

     it('should handle Maps and Sets', () => {
      const map1 = new Map([['a', 1]]);
      const map2 = new Map([['a', 1]]);
      const set1 = new Set([1, 2]);
      const set2 = new Set([2, 1]);
      assert.strictEqual(runner.equal(map1, map2), true);
      assert.strictEqual(runner.equal(set1, set2), true);
    });

    it('should handle circular references without crashing', () => {
      const a = {}; a.self = a;
      const b = {}; b.self = b;
      assert.strictEqual(runner.equal(a, b), true);
    });
  });

  describe('Utility Method: spyOn()', () => {
    it('should track calls and arguments', () => {
      const obj = { myMethod: (a, b) => a + b };
      const spy = new ATestRunner().spyOn(obj, 'myMethod');

      obj.myMethod(5, 3);

      assert.strictEqual(spy.callCount, 1);
      assert.deepStrictEqual(spy.calls[0], [5, 3]);
    });

    it('should restore the original method', () => {
      const obj = { myMethod: () => {} };
      const originalMethod = obj.myMethod;
      const spy = new ATestRunner().spyOn(obj, 'myMethod');

      spy.restore();

      assert.strictEqual(obj.myMethod, originalMethod);
    });
  });

  describe('Utility Method: genCombos()', () => {
    it('should generate all unique combinations', () => {
      const runner = new ATestRunner();
      const options = { a: [1, 2], b: 'c' };
      const combos = [...runner.genCombos(options)];

      assert.strictEqual(combos.length, 2);
      assert.deepStrictEqual(combos, [{ a: 1, b: 'c' }, { a: 2, b: 'c' }]);
    });
  });

  describe('Async Utilities: wait() and when()', () => {
    it('wait() should resolve after the specified duration', async () => {
      const runner = new ATestRunner();
      const start = Date.now();
      await runner.wait(50);
      const duration = Date.now() - start;
      assert.ok(duration >= 45);
    });

    it('when() should resolve when condition becomes truthy', async () => {
      const runner = new ATestRunner();
      let condition = false;
      setTimeout(() => { condition = true; }, 50);

      const result = await runner.when(() => condition, 200, 10);
      assert.strictEqual(result, true);
    });

    it('when() should timeout and return the last falsy value', async () => {
      const runner = new ATestRunner();
      const result = await runner.when(() => false, 100, 10);
      assert.strictEqual(result, false);
    });
  });

  describe('Benchmarking: benchmark() and profile()', () => {
    it('benchmark() should run a function the specified number of times', async () => {
      const runner = new ATestRunner();
      let counter = 0;
      await runner.benchmark(() => counter++, 10);
      assert.strictEqual(counter, 10);
    });

     it('profile() should call benchmark() with the correct method', async () => {
      const runner = new ATestRunner();
      let benchmarkCalled = false;
      runner.benchmark = () => { benchmarkCalled = true; return Promise.resolve(0); };

      await runner.profile('equal', 5);

      assert.strictEqual(benchmarkCalled, true);
    });
  });
});
