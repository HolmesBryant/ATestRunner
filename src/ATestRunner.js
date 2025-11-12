/**
 * @file A modern, flexible JavaScript test runner for the browser.
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @version 2.0.0
 * @license MIT
 */

/**
 * @abstract
 * Base class for reporters. Defines the interface for reporting test results.
 */
class ATestReporter {
  report(result) {
    throw new Error('ATestReporter.report() must be implemented by subclasses.');
  }
  groupStart(gist) {
    throw new Error('ATestReporter.groupStart() must be implemented by subclasses.');
  }
  groupEnd() {
    throw new Error('ATestReporter.groupEnd() must be implemented by subclasses.');
  }
  done(finalVerdict) {
     throw new Error('ATestReporter.done() must be implemented by subclasses.');
  }
}

/**
 * Reports test results to the browser's console.
 */
class ConsoleReporter extends ATestReporter {
  #getStyle(verdict) {
    switch (verdict) {
      case 'pass': return 'color:limegreen; font-weight:bold';
      case 'fail': return 'color:red; font-weight:bold';
      case 'info': return 'color:SandyBrown; font-weight:bold';
      case 'GROUP_START': return 'color:darkorange; font-weight:bold';
      case 'error': return 'color:fuchsia; font-weight:bold;';
      default: return 'color:dodgerblue; font-weight:bold';
    }
  }

  report(result) {
    const { gist, verdict, result: res, expect, line, message, type } = result;

    if (type === 'info') {
      console.log(`%cINFO`, this.#getStyle('info'), message);
      return;
    }

    const logArgs = [`%c${verdict.toUpperCase()}`, this.#getStyle(verdict), gist];
    console.groupCollapsed(...logArgs);
    console.log('Result:', res);
    console.log('Expected:', expect);
    if (line) console.log('Line:', line);
    console.groupEnd();
  }

  groupStart(gist) {
    console.group(`%c${gist}`, this.#getStyle('GROUP_START'));
  }

  groupEnd() {
    console.groupEnd();
  }

  done() {
    console.log(`%cDONE`, this.#getStyle('done'));
  }
}

/**
 * Reports test results by dispatching DOM events.
 */
class DomEventReporter extends ATestReporter {
  #target;
  #eventName;

  constructor(target, eventName) {
    super();
    this.#target = target;
    this.#eventName = eventName;
  }

  #dispatchEvent(detail) {
    const event = new CustomEvent(this.#eventName, {
      detail,
      bubbles: true,
      composed: true
    });
    this.#target.dispatchEvent(event);
  }

  #formatResult(result) {
    const { gist, verdict, result: res, expect, line, message, type } = result;

    const detail = type === 'info'
      ? { gist: message, verdict: 'INFO' }
      : { gist, verdict: verdict.toUpperCase(), result: res, expect, line };

    if (detail.result instanceof Error) {
      detail.result = detail.result.stack ? detail.result.stack.split("\n") : detail.result.message;
    }
    return detail;
  }

  report(result) {
    const detail = this.#formatResult(result);
    this.#dispatchEvent(detail);
  }

  groupStart(gist) {
    this.#dispatchEvent({ gist: gist, verdict: 'GROUP_START' });
  }

  groupEnd() {
    this.#dispatchEvent({ gist: null, verdict: 'GROUP_END' });
  }

  done() {
    // The separate 'complete' event handles the final verdict, so this is a no-op.
  }
}


/**
 * Provides a comprehensive suite for defining, running, and reporting tests.
 * It operates on a queue-based system, allowing for asynchronous test execution
 * with flexible output options via swappable reporters.
 */
export default class ATestRunner {
  /**
   * The line number of the currently executing test file statement.
   * This is intended to be set by an external orchestrator that parses the test file,
   * allowing for more accurate line reporting when tests are defined dynamically.
   * If null, the runner attempts to determine the line number automatically.
   *
   * @type {number|string|null}
   * @example
   * // This is typically set by a file-parsing orchestrator.
   * // For a file containing `runner.test('my test', () => true, true);` on line 10:
   * runner.currentLine = 10;
   * runner.test('my test', () => true, true); // This test will be reported as being on line 10.
   */
  currentLine = null;

  /**
   * If set to `true`, the final report will only include tests that have a 'fail'
   * or 'error' verdict. Passed and skipped tests will be suppressed from the output.
   *
   * @type {boolean}
   * @default false
   * @example
   * const runner = new ATestRunner(import.meta.url);
   * runner.onlyFailed = true; // Configure the runner to only show failing tests.
   * runner.test('passing test', 1, 1); // This result will not be displayed.
   * runner.test('failing test', 1, 2); // This result will be displayed.
   * runner.run();
   */
  onlyFailed = false;

  /**
   * The default maximum time in milliseconds that a single test is allowed to run
   * before it is considered a failure. This can be overridden on a per-test basis.
   *
   * @type {number}
   * @default 2000
   * @example
   * const runner = new ATestRunner(import.meta.url);
   * // Set a global timeout of 3 seconds for all tests.
   * runner.timeout = 3000;
   *
   * // This test will now fail if it takes longer than 3000ms.
   * runner.test('async task', async () => await someLongProcess(), 'expected');
   * runner.run();
   */
  timeout = 2000;

  /**
   * The name of the custom DOM event dispatched for each individual test result
   * when using the `DomEventReporter`.
   *
   * @type {string}
   * @default 'a-testresult'
   * @example
   * const runner = new ATestRunner(import.meta.url);
   * runner.output = document.body; // Use DOM event reporting.
   * runner.resultEventName = 'my-custom-test-event';
   *
   * document.body.addEventListener('my-custom-test-event', (e) => {
   *   console.log('Received test result:', e.detail);
   * });
   *
   * runner.run();
   */
  resultEventName = 'a-testresult';

  /**
   * The name of the `ProgressEvent` dispatched as the test queue is processed.
   * This event can be used to build a UI progress bar.
   *
   * @type {string}
   * @default 'a-progress'
   * @example
   * document.addEventListener('a-progress', (e) => {
   *   if (e.lengthComputable) {
   *     const percentComplete = (e.loaded / e.total) * 100;
   *     console.log(`Tests are ${percentComplete.toFixed(0)}% complete.`);
   *   }
   * });
   */
  progressEventName = 'a-progress';

  /**
   * The name of the custom DOM event dispatched once the entire test suite has
   * finished running. The event's `detail` object contains the final verdict.
   *
   * @type {string}
   * @default 'a-complete'
   * @example
   * document.addEventListener('a-complete', (e) => {
   *   console.log(`Test suite finished with verdict: ${e.detail.verdict}`);
   * });
   */
  completeEventName = 'a-complete';

  #definitionChain = Promise.resolve();
  #finalVerdict = 'pass';
  #metaURL;
  #output = 'console';
  #queue = [];
  #reporter;

  constructor(metaURL) {
    this.#metaURL = metaURL;
    this.#reporter = new ConsoleReporter(); // Default to console reporting
    this.group = this.group.bind(this);
    this.info = this.info.bind(this);
    this.skip = this.skip.bind(this);
    this.test = this.test.bind(this);
    this.when = this.when.bind(this);
    this.profile = this.profile.bind(this);
    this.run = this.run.bind(this);
  }

  // --- Public API Methods ---

  /**
   * Benchmarks a function by running it a specified number of times and measuring the total execution time.
   * Works with both synchronous and asynchronous functions.
   *
   * @param {Function} fn The function to benchmark.
   * @param {number} [times=1] The number of times to run the function.
   * @param {*} [thisArg=null] The 'this' context for the function.
   * @param {...*} args Arguments to pass to the function.
   * @returns {Promise<number>} A promise that resolves with the total time taken in milliseconds.
   * @example
   * const time = await runner.benchmark(() => myHeavyFunction(), 100);
   * console.log(`myHeavyFunction took ${time}ms to run 100 times.`);
   */
  async benchmark(fn, times = 1, thisArg = null, ...args) {
    const start = performance.now();
    for (let i = 0; i < times; i++) {
      await fn.apply(thisArg, args);
    }
    const end = performance.now();
    return end - start;
  }

  /**
   * Performs a deep equality comparison between two values.
   * Handles primitives, objects, arrays, Dates, RegExps, Maps, Sets,
   * ArrayBuffers, TypedArrays, objects with null prototypes, and circular references.
   * @param {*} a The first value to compare.
   * @param {*} b The second value to compare.
   * @returns {boolean} True if the values are deeply equal, false otherwise.
   */
  equal(a, b) {
    const visited = new Map();
    function _equal(x, y) {
      if (x === y) return true;
      if (x === null || typeof x !== 'object' || y === null || typeof y !== 'object') return false;
      if (visited.has(x) && visited.get(x) === y) return true;
      visited.set(x, y);
      if (Object.getPrototypeOf(x) !== Object.getPrototypeOf(y)) return false;
      if (x instanceof Date) return x.getTime() === y.getTime();
      if (x instanceof RegExp) return x.toString() === y.toString();
      if (x instanceof ArrayBuffer || ArrayBuffer.isView(x)) {
          if (x.byteLength !== y.byteLength) return false;
          const view1 = new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
          const view2 = new Uint8Array(y.buffer, y.byteOffset, y.byteLength);
          for (let i = 0; i < x.byteLength; i++) if (view1[i] !== view2[i]) return false;
          return true;
      }
      if (x instanceof Map) {
        if (x.size !== y.size) return false;
        for (const [key, value] of x) if (!y.has(key) || !_equal(value, y.get(key))) return false;
        return true;
      }
      if (x instanceof Set) {
        if (x.size !== y.size) return false;
        const yValues = [...y];
        for (const value of x) {
          const index = yValues.findIndex(yValue => _equal(value, yValue));
          if (index === -1) return false;
          yValues.splice(index, 1);
        }
        return true;
      }
      if (Array.isArray(x)) {
        if (x.length !== y.length) return false;
        for (let i = 0; i < x.length; i++) if (!_equal(x[i], y[i])) return false;
        return true;
      }
      const keysX = Object.keys(x);
      if (keysX.length !== Object.keys(y).length) return false;
      for (const key of keysX) if (!Object.prototype.hasOwnProperty.call(y, key) || !_equal(x[key], y[key])) return false;
      return true;
    }
    return _equal(a, b);
  }

  /**
   * A generator function that yields all possible combinations of properties from an options object.
   * Useful for data-driven or combinatorial testing.
   * @param {Object.<string, *|Array<*>>} [options={}] An object where keys are property names and values are either single values or an array of possible values.
   * @yields {Object} An object representing one unique combination of the provided options.
   * @example
   * const options = { a: [1, 2], b: 'c' };
   * for (const combo of runner.genCombos(options)) {
   *   // First iteration: combo is { a: 1, b: 'c' }
   *   // Second iteration: combo is { a: 2, b: 'c' }
   * }
   */
  *genCombos(options = {}) {
    const keys = Object.keys(options);
    const values = Object.values(options);
    function *generate(index, currentCombination) {
      if (index === keys.length) {
        yield { ...currentCombination };
        return;
      }
      const key = keys[index];
      const value = values[index];
      if (Array.isArray(value)) {
        for (const element of value) {
          currentCombination[key] = element;
          yield *generate(index + 1, currentCombination);
        }
      } else {
        currentCombination[key] = value;
        yield *generate(index + 1, currentCombination);
      }
    }
    yield *generate(0, {});
  }

  /**
   * Queues a group of tests under a common description.
   * @param {string} gist The gist of the group.
   * @param {Function} testsCallback A function containing the test definitions for the group.
   */
  group(gist, testsCallback) {
    // Chain the execution of this entire group definition.
    this.#definitionChain = this.#definitionChain.then(async () => {
      // Add the start marker to the queue.
      this.#queue.push({ type: 'group_start', payload: { gist } });

      await testsCallback();

      // Add the end marker to the queue after the callback is fully done.
      this.#queue.push({ type: 'group_end', payload: {} });
    });
  }

  /**
   * Handles errors that occur during the test *definition* phase (e.g., inside
   * a try/catch block or an orchestrator). It queues a special failing test
   * to ensure the setup error is always visible in the final report.
   *
   * @param {Error} error The captured error object.
   * @param {object} [options={}] An optional object for providing additional context.
   * @param {string} [options.gist='Error during test setup'] A custom description of what failed.
   * @param {string} [options.code] The raw string of code that was being executed when the error occurred.
   * @param {number|string} [options.line] The specific line number where the error occurred. If not provided, the runner will attempt to determine it.
   *
   * @example
   * // Usage inside a manual try/catch block
   * try {
   *   test("References nonexistent variable", nonExistentVar, "expected");
   * } catch (error) {
   *   runner.handleError(error, { gist: 'A variable was not defined' });
   * }
   *
   * @example
   * // Usage by an orchestrator that has more context
   * runner.handleError(error, {
   *   gist: 'Failed to parse test statement',
   *   code: 'test("bad test", () => a.b.c(), "foo")',
   *   line: 42
   * });
   */
  handleError(error, options = {}) {
    const gist = options.gist ?? 'Error during test setup';
    const code = options.code ?? null;
    const line = options.line ?? this.currentLine ?? (this.#metaURL ? this.#getLine() : null);
    if (code) this.info(`Code failed to execute:\n${code}`);
    this.#queue.push({
      type: 'test',
      payload: { gist, testFn: error, expect: null, line: line, verdict: 'error' }
    });
  }

  /**
   * Queues an informational message to be displayed in the test results.
   * @param {string} message The message to display.
   */
  info(message) {
    this.#queue.push({ type: 'info', payload: { message } });
  }

  /**
   * A convenience method to benchmark one of the runner's own internal or public methods.
   * @param {string} fnName The name of the method to profile on the ATestRunner instance.
   * @param {number} times The number of times to run the function.
   * @param {*} [thisArg=this] The 'this' context for the function.
   * @param {...*} args Arguments to pass to the function.
   * @returns {Promise<number>} The total time taken in milliseconds.
   */
  async profile(fnName, times, thisArg = this, ...args) {
    let fn = this[fnName];
    if (!fn) {
        // Limited support for private methods for simplicity
        if (fnName === "executeTest") fn = this.#executeTest;
        else if (fnName === "getLine") fn = this.#getLine;
    }
    return this.benchmark(fn, times, thisArg, ...args);
  }

  /**
   * Orchestrates the test run by processing the queue and reporting completion.
   */
  async run() {
    // Wait for the entire chain of group definitions to complete.
    await this.#definitionChain;

    this.#notifyProgress(0, this.#queue.length);
    await this.#processQueue();
    this.#reporter.done(this.#finalVerdict);
    this.#notifyComplete();
  }

  /**
   * Skip a test. The signature is the same as test() to make it easy to skip/unskip
   * @param {string} gist           - A description of the test
   * @param {*} testFn              - The expression to evaluate. Not used here but we want to keep the same signature as test()
   * @param {string|booean} expect  - The expected value
   */
  skip(gist, testFn, expect) {
    const line = this.currentLine ?? (this.#metaURL ? this.#getLine() : null);
    this.#queue.push({
      type: 'skip',
      payload: { gist, testFn, expect, line, verdict: 'skip' }
    });
  }

  /**
   * Creates a spy on a method of an object. The original method is replaced with a spy
   * that tracks calls, arguments, and then executes the original method.
   * @param {Object} obj The object containing the method to spy on.
   * @param {string} methodName The name of the method to spy on.
   * @returns {{callCount: number, calls: Array<Array<*>>, restore: Function}} A spy object with call tracking and a restore function.
   * @throws {Error} If the specified methodName is not a function on the object.
   * @example
   * const spy = runner.spyOn(console, 'log');
   * console.log('hello');
   * // spy.callCount is 1
   * // spy.calls[0] is ['hello']
   * spy.restore(); // Restores original console.log
   */
  spyOn(obj, methodName) {
    const originalMethod = obj[methodName];
    if (typeof originalMethod !== 'function') throw new Error(`${methodName} is not a function`);
    const spy = {
      callCount: 0,
      calls: [],
      restore: () => { obj[methodName] = originalMethod; },
    };
    obj[methodName] = function(...args) {
      spy.callCount++;
      spy.calls.push(args);
      return originalMethod.apply(this, args);
    };
    return spy;
  }

  /**
   * Queues a test for execution.
   * @param {string} gist A brief description of the test's purpose.
   * @param {Function|*} testFn The test function to execute, or a value/Promise to be evaluated.
   * @param {*} expect The expected result of the test function.
   * @returns {Promise<void>}
   */
  test(gist, testFn, expect, options = {}) {
    const line = this.currentLine ?? (this.#metaURL ? this.#getLine() : null);
    const payload = { gist, testFn, expect, line, ...options };
    this.#queue.push({ type: 'test', payload });
  }

  /**
   * Checks if a function throws an error when executed with the given arguments.
   * @param {Function} testFn - The function to test.
   * @param {...*} args       - The arguments to pass to the test function.
   * @returns {boolean} Returns `true` if the function throws an error, otherwise `false`.
   */
  throws(testFn, ...args) {
    try {
      testFn(...args);
      return false;
    } catch (error) {
      return true;
    }
  }

  /**
   * Returns a promise that resolves after a specified number of milliseconds.
   * @param {number} ms The number of milliseconds to wait.
   * @returns {Promise<void>}
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Waits for an expression, function, or promise to become "truthy".
   * It polls at a given interval and will time out if the condition is not met.
   * @param {Function|Promise<*>|*} expression The condition to wait for.
   * @param {number} [timeoutMs=1000] The maximum time to wait in milliseconds.
   * @param {number} [checkIntervalMs=100] The interval between checks in milliseconds.
   * @returns {Promise<*>} A promise that resolves with the first truthy result of the expression, or the final result on timeout.
   * @throws Will re-throw any error that occurs during the evaluation of the expression.
   *
   * @example async asyncFunc() { return 'foo' }
   * @example when( asyncFunc() ) // returns 'foo'
   * @example when( await asyncFunc() === 'foo' ) // returns true
   */
  async when(expression, timeoutMs = 1000, checkIntervalMs = 100) {
    const startTime = Date.now();
    let evaluation = (typeof expression === 'function') ? async () => expression()
                   : (expression instanceof Promise)    ? async () => expression
                   : async () => expression;
    while (true) {
      if (Date.now() - startTime >= timeoutMs) return await evaluation();
      try {
        const result = await evaluation();
        if (result) return result;
      } catch (error) {
        throw error;
      }
      await this.wait(checkIntervalMs);
    }
  }

  // --- Private Methods ---

  /**
   * Chains a task-queuing function to ensure all test definitions
   * are processed in the order they are called.
   * @private
   * @param {Function} queuingFunction The function that adds tasks to the #queue.
   */
  #enqueue(queuingFunction) {
    this.#definitionChain = this.#definitionChain.then(queuingFunction);
  }

  /**
   * Prepares a single task for execution, returning a promise with its result.
   * @private
   */
  #executeTask(task) {
    return (task.type === 'info')
      ? Promise.resolve({ type: 'info', message: task.payload.message })
      : this.#executeTest(task.payload);
  }

  /**
   * Executes a single test payload and determines its outcome.
   * @private
   */
  async #executeTest(payload) {
    const { gist, testFn, expect, line, verdict: predefinedVerdict, timeout } = payload;
    const testTimeout = timeout ?? this.timeout;

    try {
      if (predefinedVerdict) {
        const result = predefinedVerdict === 'error' ? testFn : 'Not executed';
        return { type: 'test', gist, verdict: predefinedVerdict, result, expect, line };
      }

      // The timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Test timed out after ${testTimeout}ms`)), testTimeout)
      );

      // The actual test execution logic, wrapped in a promise
      const executionPromise = (async () => {
        const testResult = (typeof testFn === 'function') ? testFn() : testFn;
        if (testResult instanceof Error) {
          return { type: 'test', gist, verdict: 'error', result: testResult, expect, line };
        }
        const resolvedTestResult = await testResult;
        const verdict = this.equal(resolvedTestResult, expect) ? 'pass' : 'fail';
        return { type: 'test', gist, verdict, result: resolvedTestResult, expect, line };
      })();

      // Race the execution against the timeout
      return await Promise.race([executionPromise, timeoutPromise]);

    } catch (error) {
      // catch timeouts or other unexpected errors
      return { type: 'test', gist, verdict: 'error', result: error, expect, line };
    }
  }

  /**
   * Determines the line number where a test was defined.
   * @private
   */
  #getLine() {
    try {
      throw Error('');
    } catch (error) {
      if (!error.stack) return null;
      const result = error.stack.split('\n').find(member => member.includes(this.#metaURL));
      if (!result) return null;
      const start = result.indexOf(this.#metaURL) + this.#metaURL.length + 1;
      const end = result.lastIndexOf(':');
      return result.substring(start, end);
    }
  }

  /**
   * Iterates through the task queue and manages the execution flow.
   * @private
   */
  async #processQueue() {
    const promiseGroups = [[]];
    let inGroup = false;

    for (const [index, task] of this.#queue.entries()) {
      switch (task.type) {
        case 'group_start':
          this.#reporter.groupStart(task.payload.gist);
          inGroup = true;
          break;

        case 'group_end':
          const groupPromises = promiseGroups[promiseGroups.length - 1];
          await this.#processGroupResults(groupPromises);
          groupPromises.length = 0;
          this.#reporter.groupEnd();
          inGroup = false;
          break;

        default: // test, info, skip
          const promise = this.#executeTask(task);
          if (inGroup) {
            promiseGroups[promiseGroups.length - 1].push(promise);
          } else {
            const result = await promise;
            this.#report(result);
          }
          break;
      }
      this.#notifyProgress(index + 1, this.#queue.length);
    }
  }

  /**
   * Awaits all promises in a group and reports their results sequentially.
   * @private
   */
  async #processGroupResults(promises) {
    const results = await Promise.all(promises);
    for (const result of results) {
      this.#report(result);
    }
  }

  /**
   * Updates the final verdict, filters the result, and delegates to the reporter.
   * @private
   */
  #report(result) {
    if (result.verdict === 'fail' || result.verdict === 'error') {
      this.#finalVerdict = 'fail';
    }
    if (this.onlyFailed && result.verdict === 'pass') {
      return;
    }
    this.#reporter.report(result);
  }

  // --- Event Notification ---

  #notifyComplete() {
    const target = (this.#output.dispatchEvent) ? this.#output : document;
    const completeEvent = new CustomEvent(this.completeEventName, {
      detail: { verdict: this.#finalVerdict }
    });
    target.dispatchEvent(completeEvent);
  }

  #notifyProgress(loaded, total) {
    const target = (this.#output.dispatchEvent) ? this.#output : document;
    const progressEvent = new ProgressEvent(this.progressEventName, {
      lengthComputable: true, loaded: loaded, total: total
    });
    target.dispatchEvent(progressEvent);
  }

  // --- Getters / Setters ---

  get output() { return this.#output; }

  set output(value) {
    if (value === 'console') {
      this.#reporter = new ConsoleReporter();
      this.#output = 'console';
      return;
    }
    let target;
    if (value instanceof HTMLElement) {
      target = value;
    } else if (typeof value === 'string') {
      target = document.querySelector(value);
    }
    if (target) {
      this.#reporter = new DomEventReporter(target, this.resultEventName);
      this.#output = target;
    } else {
      throw new Error(`Cannot find output target: ${value}`);
    }
  }

  get finalVerdict() { return this.#finalVerdict; }
}
