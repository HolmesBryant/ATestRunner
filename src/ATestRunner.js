/**
 * @file ATestRunner.js
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @version 3.0.2
 * @license MIT
 */

/**
 * @class ATestRunner
 * The main class for running tests, managing the test queue, and orchestrating reporters.
 */
export default class ATestRunner {
  /** @type {string|null} The line number of the currently executing test file. */
  currentLine = null;
  /** @type {boolean} If true, only reports failed tests. */
  onlyFailed = false;
  /** @type {number} The default timeout for tests in milliseconds. */
  timeout = 2000;
  /** @type {string} The name of the custom event for test results. */
  resultEventName = "a-testresult";
  /** @type {string} The name of the custom event for progress updates. */
  progressEventName = "a-progress";
  /** @type {string} The name of the custom event for test suite completion. */
  completeEventName = "a-complete";

  /** @private @type {Promise<void>} A promise chain to ensure sequential execution. */
  #promiseChain = Promise.resolve();
  /** @private @type {string} The final verdict of the test suite. */
  #finalVerdict = "pass";
  /** @private @type {string} The URL of the test file being run. */
  #testFileURL;
  /** @private @type {Array<object>} The queue of tests to be run. */
  #testQueue = [];
  /** @private @type {ATestReporter} The reporter instance to use for output. */
  #reporter;

  /** @private @type {string|HTMLElement} The configuration for the output target. */
  #outputConfig = "console";
  /** @private @type {HTMLElement|string|null} The resolved DOM element for reporting. */
  #outputTarget = null;

  /**
   * Creates an instance of ATestRunner.
   * @param {string} testFileURL - The URL of the file containing the tests. Used for line number reporting.
   */
  constructor(testFileURL) {
    this.#testFileURL = testFileURL;
    // Default to console reporter. It will be replaced if a DOM target is set.
    this.#reporter = new ConsoleReporter();
    this.equal = this.equal.bind(this);
    this.group = this.group.bind(this);
    this.info = this.info.bind(this);
    this.log = this.log.bind(this);
    this.skip = this.skip.bind(this);
    this.test = this.test.bind(this);
    this.when = this.when.bind(this);
    this.profile = this.profile.bind(this);
    this.run = this.run.bind(this);
  }

  // --- Public API ---

  /**
   * Runs a function multiple times and measures the total execution time.
   * @async
   * @param {Function} fn - The function to benchmark.
   * @param {number} [iterations=1] - The number of times to run the function.
   * @param {object|null} [context=null] - The `this` context for the function.
   * @param {...*} args - Arguments to pass to the function.
   * @returns {Promise<number>} The total time taken in milliseconds.
   */
  async benchmark(fn, iterations = 1, context = null, ...args) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await fn.apply(context, args);
    }
    return performance.now() - start;
  }

  /**
   * Performs a deep equality comparison between two values.
   * Handles circular references, primitives, objects, arrays, Maps, Sets, Dates, RegExps, and TypedArrays.
   * @param {*} a - The first value.
   * @param {*} b - The second value.
   * @returns {boolean} True if the values are deeply equal, false otherwise.
   */
  equal(a, b) {
    const seen = new Map();
    return this.#deepEqual(a, b, seen);
  }

  /**
   * A generator function that yields all possible combinations of parameters.
   * @generator
   * @param {object.<string, Array<*>|*>} params - An object where keys are parameter names and values are arrays of options or single values.
   * @yields {object} An object representing a single combination of parameters.
   */
  *genCombos(params = {}) {
    const keys = Object.keys(params);
    const values = Object.values(params);
    yield* (function* recurse(depth, currentCombo) {
      if (depth === keys.length) {
        yield { ...currentCombo };
        return;
      }
      const key = keys[depth];
      const val = values[depth];
      if (Array.isArray(val)) {
        for (const item of val) {
          currentCombo[key] = item;
          yield* recurse(depth + 1, currentCombo);
        }
      } else {
        currentCombo[key] = val;
        yield* recurse(depth + 1, currentCombo);
      }
    })(0, {});
  }

  /**
   * Groups a set of tests under a common description.
   * @param {string} gist - The description for the group.
   * @param {Function} testsFn - A function that contains the tests to be grouped.
   */
  group(gist, testsFn) {
    this.#promiseChain = this.#promiseChain.then(async () => {
      this.#testQueue.push({ type: "group_start", payload: { gist } });
      await testsFn();
      this.#testQueue.push({ type: "group_end", payload: {} });
    });
  }

  /**
   * Handles and reports an error that occurs during test execution.
   * @param {Error} error - The error object to handle.
   * @param {object} [context={}] - Additional context about the error.
   * @param {string} [context.gist] - A description of what was happening when the error occurred.
   * @param {string} [context.code] - The code snippet that caused the error.
   * @param {string} [context.line] - The line number of the error.
   */
  handleError(error, context = {}) {
    let gist;
    const code = context.code ?? null;
    const line = context.line ?? this.currentLine ?? (this.#testFileURL ? this.#getLine() : null);
    gist = context.gist ? context.gist : (code ? `Failed to execute:\n${code}` : "Error during setup");
    this.#testQueue.push({ type: "test", payload: { gist, testFn: error, expect: null, line, verdict: "error" } });
  }

  /**
   * Adds an informational message to the test report.
   * @param {string} message - The message to report.
   */
  info(message) {
    this.#testQueue.push({ type: "info", payload: { message } });
  }

  /**
   * Logs a custom message with a specific verdict label.
   * @param {string} verdict - The label for the log (e.g., 'model', 'api', 'debug').
   * @param {*} message - The object or value to log.
   */
  log(verdict, message) {
    this.#testQueue.push({ type: "custom_log", payload: { verdict, message } });
  }

  /**
   * Profiles a method by benchmarking it over a number of iterations.
   * @async
   * @param {string} methodName - The name of the method to profile on the ATestRunner instance.
   * @param {number} iterations - The number of times to run the method.
   * @param {object} [context=this] - The `this` context for the method.
   * @param {...*} args - Arguments to pass to the method.
   * @returns {Promise<number>} The total time taken in milliseconds.
   */
  async profile(methodName, iterations, context = this, ...args) {
    let fn = this[methodName];
    if (!fn) {
      if (methodName === 'executeTest') fn = this.#executeTest;
      else if (methodName === 'getLine') fn = this.#getLine;
    }
    return this.benchmark(fn, iterations, context, ...args);
  }

  /**
   * Adds a test to the queue that will be marked as 'skipped'.
   * @param {string} gist - The description of the test.
   * @param {Function} testFn - The test function (will not be executed).
   * @param {*} expect - The expected result.
   */
  skip(gist, testFn, expect) {
    const line = this.currentLine ?? (this.#testFileURL ? this.#getLine() : null);
    this.#testQueue.push({ type: "skip", payload: { gist, testFn, expect, line, verdict: "skip" } });
  }

  /**
   * Creates a spy on a method of an object.
   * @param {object} obj - The object containing the method to spy on.
   * @param {string} methodName - The name of the method to spy on.
   * @returns {object} A spy object with methods like `restore`, `runs`, `returns`, and properties like `callCount`.
   * @throws {Error} If the specified method is not a function.
   */
  spyOn(obj, methodName) {
    const originalMethod = obj[methodName];
    if (typeof originalMethod !== 'function') {
      throw new Error(`'${methodName}' must be a function on the object.`);
    }

    let currentImplementation = originalMethod;
    const spy = {
      callCount: 0,
      calls: [],
      restore: () => { obj[methodName] = originalMethod; },
      runs(fn) { currentImplementation = fn; return this; },
      returns(value) { currentImplementation = () => value; return this; },
      resolves(value) { currentImplementation = () => Promise.resolve(value); return this; },
      rejects(error) { currentImplementation = () => Promise.reject(error); return this; }
    };
    obj[methodName] = function (...args) { spy.callCount++; spy.calls.push(args);
    return currentImplementation.apply(this, args); };
    return spy;
  }

  /**
   * Adds a test case to the execution queue.
   * @param {string} gist - The description of the test.
   * @param {Function|*} testFn - The function to execute or a value to test.
   * @param {*} expect - The expected result of the test function.
   * @param {object} [options={}] - Additional options for the test.
   * @param {number} [options.timeout] - A specific timeout for this test in milliseconds.
   */
  test(gist, testFn, expect, options = {}) {
    const payload = { gist, testFn, expect, line: this.currentLine ?? (this.#testFileURL ? this.#getLine() : null), ...options };
    this.#testQueue.push({ type: "test", payload });
  }

  /**
   * Checks if a function throws an error.
   * @param {Function} fn - The function to test.
   * @param {...*} args - Arguments to pass to the function.
   * @returns {boolean} True if the function throws, false otherwise.
   */
  throws(fn, ...args) {
    try {
      fn(...args);
      return false;
    } catch (e) {
      return true;
    }
  }

  /**
   * Pauses execution for a specified number of milliseconds.
   * @async
   * @param {number} ms - The number of milliseconds to wait.
   * @returns {Promise<void>} A promise that resolves after the delay.
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Waits for a condition to become truthy, polling at a specified interval.
   * @async
   * @param {Function|*} condition - The condition to wait for. Can be a function or a value.
   * @param {number} [timeout=1000] - The maximum time to wait in milliseconds.
   * @param {number} [pollInterval=100] - The interval between checks in milliseconds.
   * @returns {Promise<*>} A promise that resolves with the result of the condition when it becomes truthy.
   * @throws {Error} If the condition function throws an error.
   */
  async when(condition, timeout = 1000, pollInterval = 100) {
    const startTime = Date.now();
    const check = typeof condition === 'function' ? async () => condition() : async () => condition;
    while (true) {
      if (Date.now() - startTime >= timeout) return await check();
      try {
        const result = await check();
        if (result) return result;
      } catch (e) {
        throw e;
      }
      await this.wait(pollInterval);
    }
  }

  /**
   * Starts the test execution process.
   * @async
   */
  async run() {
    await this.#promiseChain;
    await this.#initializeOutput();
    this.#reporter.progress(0, this.#testQueue.length);
    await this.#processQueue();
    this.#reporter.complete(this.#finalVerdict);
  }

  // --- Private Methods ---

  /**
   * Enqueues a function to the main promise chain to ensure sequential execution.
   * @private
   * @param {Function} fn - The function to enqueue.
   */
  #enqueue(fn) {
    this.#promiseChain = this.#promiseChain.then(fn);
  }

  /**
   * Processes a single item from the test queue.
   * @private
   * @param {object} item - The queue item to process.
   * @returns {Promise<object>} A promise that resolves with the test result object.
   */
  #processItem(item) {
    if (item.type === "info") {
      return Promise.resolve({ type: "info", message: item.payload.message });
    }
    if (item.type === "custom_log") {
      return Promise.resolve({
        type: "custom_log",
        verdict: item.payload.verdict,
        result: item.payload.message
      });
    }
    return this.#executeTest(item.payload);
  }

  /**
   * Executes a single test, handling timeouts and errors.
   * @private
   * @async
   * @param {object} payload - The payload of the test item.
   * @returns {Promise<object>} A promise that resolves with the final result object for the test.
   */
  async #executeTest(payload) {
    const { gist, testFn, expect, line, verdict, timeout: testTimeout } = payload;
    const timeoutDuration = testTimeout ?? this.timeout;

    try {
      // Handle pre-determined verdicts (skip, error)
      if (verdict) {
        return { type: "test", gist, verdict, result: verdict === "error" ? testFn : "Not executed", expect, line };
      }

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Test timed out after ${timeoutDuration}ms`)), timeoutDuration));

      const executionPromise = (async () => {
        const result = (typeof testFn === 'function') ? testFn() : testFn;
        if (result instanceof Error) return { type: "test", gist, verdict: "error", result, expect, line };
        const finalResult = await result;
        const finalVerdict = this.equal(finalResult, expect) ? "pass" : "fail";
        return { type: "test", gist, verdict: finalVerdict, result: finalResult, expect, line };
      })();

      return await Promise.race([executionPromise, timeoutPromise]);
    } catch (error) {
      return { type: "test", gist, verdict: "error", result: error, expect, line };
    }
  }

  /**
   * Gets the line number of the caller within the test file by parsing an error stack.
   * @private
   * @returns {string|null} The line number as a string, or null if it cannot be determined.
   */
  #getLine() {
    try {
      throw new Error();
    } catch (e) {
      if (!e.stack) return null;
      const line = e.stack.split("\n").find(l => l.includes(this.#testFileURL));
      if (!line) return null;
      const start = line.indexOf(this.#testFileURL) + this.#testFileURL.length + 1;
      const end = line.lastIndexOf(":");
      return line.substring(start, end);
    }
  }

  /**
   * Processes the entire test queue, handling groups and reporting.
   * @private
   * @async
   */
  async #processQueue() {
    const resultsInGroups = [[]];
    let inGroup = false;

    for (const [index, item] of this.#testQueue.entries()) {
      switch (item.type) {
        case "group_start":
          this.#reporter.groupStart(item.payload.gist);
          inGroup = true;
          break;
        case "group_end":
          const currentGroup = resultsInGroups[resultsInGroups.length - 1];
          await this.#reportBatch(currentGroup);
          currentGroup.length = 0;
          this.#reporter.groupEnd();
          inGroup = false;
          break;
        default:
          const resultPromise = this.#processItem(item);
          if (inGroup) {
            resultsInGroups[resultsInGroups.length - 1].push(resultPromise);
          } else {
            const result = await resultPromise;
            this.#reportResult(result);
          }
      }
      this.#reporter.progress(index + 1, this.#testQueue.length);
    }
  }

  /**
   * Waits for a batch of promises to resolve and then reports each result.
   * @private
   * @async
   * @param {Array<Promise<object>>} promiseBatch - An array of promises that resolve to result objects.
   */
  async #reportBatch(promiseBatch) {
    const results = await Promise.all(promiseBatch);
    for (const result of results) {
      this.#reportResult(result);
    }
  }

  /**
   * Reports a single result using the configured reporter.
   * @private
   * @param {object} result - The result object to report.
   */
  #reportResult(result) {
    if (result.verdict === "fail" || result.verdict === "error") {
      this.#finalVerdict = "fail";
    }
    if (!this.onlyFailed || result.verdict !== "pass") {
      this.#reporter.report(result);
    }
  }

  /**
   * Initializes the output reporter based on the `output` configuration.
   * @private
   * @async
   * @throws {Error} If the specified DOM target is not found.
   */
  async #initializeOutput() {
    if (this.#outputConfig === 'console' || this.#outputConfig === null) {
      this.#outputTarget = 'console';
      this.#reporter = new ConsoleReporter();
      return;
    }

    let element;
    if (this.#outputConfig instanceof HTMLElement) {
      element = this.#outputConfig;
    } else if (typeof this.#outputConfig === 'string') {
      element = document.querySelector(this.#outputConfig);
    }

    if (!element) {
      throw new Error(`ATestRunner Error: Output target "${this.#outputConfig}" not found in the DOM.`);
    }

    // If the target is a custom element, wait for it to be defined and upgraded.
    const isCustomElement = element.localName.includes('-');
    if (isCustomElement) {
      try {
        await customElements.whenDefined(element.localName);
        // Wait one frame to allow its connectedCallback to complete.
        await new Promise(resolve => requestAnimationFrame(resolve));
      } catch (err) {
         console.warn(`ATestRunner: Could not wait for custom element '${element.localName}' to be defined. It may not have been registered.`, err);
      }
    }

    this.#outputTarget = element;
    this.#reporter = new EventReporter(element, {
      result: this.resultEventName,
      progress: this.progressEventName,
      complete: this.completeEventName,
    });
  }

  /**
   * Recursively compares two values for deep equality.
   * @private
   * @param {*} objA - The first value.
   * @param {*} objB - The second value.
   * @param {Map<object, object>} seen - A map to track circular references.
   * @returns {boolean} True if the values are deeply equal.
   */
  #deepEqual(objA, objB, seen) {
    if (objA === objB) return true;

    if (objA === null || typeof objA !== 'object' || objB === null || typeof objB !== 'object') {
      return false;
    }

    if (seen.has(objA) && seen.get(objA) === objB) return true;
    seen.set(objA, objB);

    if (Object.getPrototypeOf(objA) !== Object.getPrototypeOf(objB)) return false;

    if (objA instanceof Date) return objA.getTime() === objB.getTime();
    if (objA instanceof RegExp) return objA.toString() === objB.toString();
    if (Array.isArray(objA)) return this.#areArraysEqual(objA, objB, seen);
    if (objA instanceof Map) return this.#areMapsEqual(objA, objB, seen);
    if (objA instanceof Set) return this.#areSetsEqual(objA, objB, seen);
    if (objA instanceof ArrayBuffer || ArrayBuffer.isView(objA)) {
      return this.#areTypedArraysEqual(objA, objB);
    }

    return this.#areObjectsEqual(objA, objB, seen);
  }

  /**
   * Compares two arrays for deep equality.
   * @private
   * @param {Array<*>} arrA - The first array.
   * @param {Array<*>} arrB - The second array.
   * @param {Map<object, object>} seen - A map to track circular references.
   * @returns {boolean} True if the arrays are deeply equal.
   */
  #areArraysEqual(arrA, arrB, seen) {
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (!this.#deepEqual(arrA[i], arrB[i], seen)) return false;
    }
    return true;
  }

  /**
   * Compares two Maps for deep equality.
   * @private
   * @param {Map<*, *>} mapA - The first Map.
   * @param {Map<*, *>} mapB - The second Map.
   * @param {Map<object, object>} seen - A map to track circular references.
   * @returns {boolean} True if the Maps are deeply equal.
   */
  #areMapsEqual(mapA, mapB, seen) {
    if (mapA.size !== mapB.size) return false;
    for (const [key, value] of mapA) {
      if (!mapB.has(key) || !this.#deepEqual(value, mapB.get(key), seen)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Compares two Sets for deep equality.
   * @private
   * @param {Set<*>} setA - The first Set.
   * @param {Set<*>} setB - The second Set.
   * @param {Map<object, object>} seen - A map to track circular references.
   * @returns {boolean} True if the Sets are deeply equal.
   */
  #areSetsEqual(setA, setB, seen) {
    if (setA.size !== setB.size) return false;
    const bValues = [...setB];
    for (const aValue of setA) {
      const idx = bValues.findIndex(bValue => this.#deepEqual(aValue, bValue, seen));
      if (idx === -1) return false;
      bValues.splice(idx, 1);
    }
    return true;
  }

  /**
   * Compares two ArrayBuffers or TypedArrays for equality.
   * @private
   * @param {ArrayBuffer|DataView|TypedArray} objA - The first buffer/view.
   * @param {ArrayBuffer|DataView|TypedArray} objB - The second buffer/view.
   * @returns {boolean} True if the underlying data is identical.
   */
  #areTypedArraysEqual(objA, objB) {
    if (objA.byteLength !== objB.byteLength) return false;
    const viewA = new Uint8Array(objA.buffer, objA.byteOffset, objA.byteLength);
    const viewB = new Uint8Array(objB.buffer, objB.byteOffset, objB.byteLength);
    for (let i = 0; i < objA.byteLength; i++) {
      if (viewA[i] !== viewB[i]) return false;
    }
    return true;
  }

  /**
   * Compares two plain objects for deep equality.
   * @private
   * @param {object} objA - The first object.
   * @param {object} objB - The second object.
   * @param {Map<object, object>} seen - A map to track circular references.
   * @returns {boolean} True if the objects are deeply equal.
   */
  #areObjectsEqual(objA, objB, seen) {
    const keysA = Object.keys(objA);
    if (keysA.length !== Object.keys(objB).length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(objB, key) || !this.#deepEqual(objA[key], objB[key], seen)) {
        return false;
      }
    }
    return true;
  }

  // --- GETTERS / SETTERS ---

  /**
   * Gets the current output configuration.
   * @returns {string|HTMLElement|null} The output target.
   */
  get output() { return this.#outputConfig; }
  /**
   * Sets the output target for the reporter.
   * @param {string|HTMLElement|null} target - Can be 'console', a CSS selector string, or an HTMLElement.
   */
  set output(target) { this.#outputConfig = target; }

  /**
   * Gets the final verdict of the test suite after it has run.
   * @returns {string} The final verdict ('pass' or 'fail').
   */
  get finalVerdict() { return this.#finalVerdict; }
}

/**
 * @class ATestReporter
 * @abstract
 * Abstract base class for all test reporters. Subclasses must implement the methods of this class
 * to handle reporting of test results in different environments (e.g., console, DOM, etc.).
 */
class ATestReporter {
  /**
   * Reports an individual test result.
   * @param {object} result - The result object for a single test.
   * @throws {Error} If the method is not implemented by a subclass.
   */
  report(result) { throw new Error("ATestReporter.report() must be implemented by subclasses."); }

  /**
   * Signals the start of a test group.
   * @param {string} gist - The description or name of the test group.
   * @throws {Error} If the method is not implemented by a subclass.
   */
  groupStart(gist) { throw new Error("ATestReporter.groupStart() must be implemented by subclasses."); }

  /**
   * Signals the end of a test group.
   * @throws {Error} If the method is not implemented by a subclass.
   */
  groupEnd() { throw new Error("ATestReporter.groupEnd() must be implemented by subclasses."); }

  /**
   * Reports the progress of the test suite execution.
   * @param {number} loaded - The number of tests that have been processed.
   * @param {number} total - The total number of tests in the queue.
   * @throws {Error} If the method is not implemented by a subclass.
   */
  progress(loaded, total) { throw new Error("ATestReporter.progress() must be implemented by subclasses."); }

  /**
   * Signals the completion of the entire test suite.
   * @param {string} verdict - The final verdict of the test suite ('pass' or 'fail').
   * @throws {Error} If the method is not implemented by a subclass.
   */
  complete(verdict) { throw new Error("ATestReporter.complete() must be implemented by subclasses."); }
}

/**
 * @class ConsoleReporter
 * @extends ATestReporter
 * A test reporter that outputs results to the browser's console.
 */
class ConsoleReporter extends ATestReporter {
  /**
   * Gets the CSS style string for a given verdict.
   * @private
   * @param {string} verdict - The verdict string (e.g., "pass", "fail").
   * @returns {string} The CSS style string for console logging.
   */
  #getStyle(verdict) {
    switch (verdict) {
      case "pass": return "color:limegreen; font-weight:bold";
      case "fail": return "color:red; font-weight:bold";
      case "info": return "color:SandyBrown; font-weight:bold";
      case "GROUP_START": return "color:darkorange; font-weight:bold";
      case "error": return "color:fuchsia; font-weight:bold;";
      default: return "color:dodgerblue; font-weight:bold";
    }
  }

  /**
   * @override
   * Reports an individual test result to the console, inside a collapsed group.
   * @param {object} result - The result object for a single test.
   * @param {string} result.gist - The description of the test.
   * @param {string} result.verdict - The verdict of the test ('pass', 'fail', etc.).
   * @param {*} result.result - The actual result returned by the test function.
   * @param {*} result.expect - The expected result.
   * @param {string|null} result.line - The line number where the test was defined.
   * @param {string} [result.message] - An informational message.
   * @param {string} [result.type] - The type of report (e.g., "info").
   */
  report(result) {
    const { gist, verdict, result: res, expect, line, message, type } = result;

    if (type === "custom_log") {
      console.groupCollapsed(verdict);
      console.log(res);
      console.groupEnd();
      return;
    }

    if (type === "info") {
      console.log("%cINFO", this.#getStyle("info"), message);
      return;
    }
    const logArgs = [`%c${verdict.toUpperCase()}`, this.#getStyle(verdict), gist];
    console.groupCollapsed(...logArgs);
    console.log("Result:", res);
    console.log("Expected:", expect);
    if (line) console.log("Line:", line);
    console.groupEnd();
  }

  /**
   * @override
   * Creates a new collapsible group in the console.
   * @param {string} gist - The name of the test group.
   */
  groupStart(gist) { console.group(`%c${gist}`, this.#getStyle("GROUP_START")); }

  /**
   * @override
   * Closes the current console group.
   */
  groupEnd() { console.groupEnd(); }

  /**
   * @override
   * This is a no-op for the ConsoleReporter as there's no visual progress bar.
   * @param {number} loaded - The number of tests processed.
   * @param {number} total - The total number of tests.
   */
  progress(loaded, total) {}

  /**
   * @override
   * Logs a final "DONE" message to the console.
   * @param {string} verdict - The final verdict of the test suite.
   */
  complete(verdict) { console.log("%cDONE", this.#getStyle("done")); }
}

/**
 * @class EventReporter
 * @extends ATestReporter
 * A test reporter that dispatches custom events from a specified DOM element.
 */
class EventReporter extends ATestReporter {
  /** @private @type {HTMLElement} */
  #element;
  /** @private @type {string} */
  #eventName;
  /** @private @type {string} */
  #progressEventName;
  /** @private @type {string} */
  #completeEventName;

  /**
   * Creates an instance of EventReporter.
   * @param {HTMLElement} element - The DOM element to dispatch events from.
   * @param {object} eventNames - The names of the events to dispatch.
   * @param {string} eventNames.result - The name for the test result event.
   * @param {string} eventNames.progress - The name for the progress event.
   * @param {string} eventNames.complete - The name for the completion event.
   */
  constructor(element, eventNames) {
    super();
    this.#element = element;
    this.#eventName = eventNames.result;
    this.#progressEventName = eventNames.progress;
    this.#completeEventName = eventNames.complete;
  }

  /**
   * Dispatches a CustomEvent with the given name and detail.
   * @private
   * @param {string} eventName - The name of the event to dispatch.
   * @param {object} detail - The detail object to include with the event.
   */
  #dispatchEvent(eventName, detail) {
    const event = new CustomEvent(eventName, { detail, bubbles: true, composed: true });
    this.#element.dispatchEvent(event);
  }

  /**
   * Formats the result object into a detail payload for the custom event.
   * @private
   * @param {object} result - The raw result object.
   * @returns {object} The formatted detail object for the event.
   */
  #formatDetail(result) {
    if (result.type === "custom_log") {
      let content = result.result;

      // Handle HTML Elements: Extract attributes and value
      if (content instanceof Element) {
        const attributes = {};
        for (const attr of content.attributes) {
          attributes[attr.name] = attr.value;
        }

        const elementData = {
          tagName: content.tagName.toLowerCase(),
          attributes: attributes
        };

        // Capture 'value' if it exists (e.g., inputs), but not inherited props
        if ('value' in content) {
          elementData.value = content.value;
        }
        content = elementData;
      }
      // Handle Objects/Arrays: specific requirement to show *only* own properties
      else if (typeof content === 'object' && content !== null) {
        content = Array.isArray(content) ? [...content] : { ...content };
      }

      return { gist: null, verdict: result.verdict, result: content };
    }

    const { gist, verdict, result: res, expect, line, message, type } = result;
    const detail = (type === "info") ?
      { gist: message, verdict: "INFO" } :
      { gist, verdict: verdict.toUpperCase(), result: res, expect, line };
    if (detail.result instanceof Error) {
      detail.result = detail.result.stack ? detail.result.stack.split("\n") : detail.result.message;
    }
    return detail;
  }

  /**
   * @override
   * Reports a test result by dispatching a custom event.
   * @param {object} result - The test result object.
   */
  report(result) { this.#dispatchEvent(this.#eventName, this.#formatDetail(result)); }

  /**
   * @override
   * Signals the start of a group by dispatching a custom event.
   * @param {string} gist - The name of the group.
   */
  groupStart(gist) { this.#dispatchEvent(this.#eventName, { gist, verdict: "GROUP_START" }); }

  /**
   * @override
   * Signals the end of a group by dispatching a custom event.
   */
  groupEnd() { this.#dispatchEvent(this.#eventName, { gist: null, verdict: "GROUP_END" }); }

  /**
   * @override
   * Reports progress by dispatching a ProgressEvent.
   * @param {number} loaded - The number of tests processed.
   * @param {number} total - The total number of tests.
   */
  progress(loaded, total) {
    const event = new ProgressEvent(this.#progressEventName, { lengthComputable: true, loaded, total });
    this.#element.dispatchEvent(event);
  }

  /**
   * @override
   * Signals completion by dispatching a custom event.
   * @param {string} verdict - The final verdict.
   */
  complete(verdict) {
    this.#dispatchEvent(this.#completeEventName, { verdict });
  }
}
