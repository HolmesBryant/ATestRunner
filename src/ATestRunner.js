/**
 * @file A modern, flexible JavaScript test runner for the browser.
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @version 1.0.2
 * @license MIT
 */

/**
 * Provides a comprehensive suite for defining, running, and reporting tests.
 * It operates on a queue-based system, allowing for asynchronous test execution
 * with flexible output options (console or a specified DOM element).
 */
export default class ATestRunner {

  /**
   * The URL of the test file being executed, used for reporting line numbers.
   * @type {string}
   */
  metaURL;

  /**
   * If true, only failed tests and informational messages will be reported. Passed tests will be suppressed.
   * @type {boolean}
   */
  onlyFailed = false;

  /**
   * The target for test results. Can be 'console', a CSS selector string ('#id'), or an HTMLElement.
   * @private
   * @type {('console'|HTMLElement)}
   */
  #output = 'console';

  /**
   * The final verdict of the test suite ('pass' or 'fail').
   * @private
   * @type {('pass'|'fail')}
   */
  #finalVerdict = 'pass';

  /**
   * A queue of tasks (tests or info messages) to be executed by the run() method.
   * @private
   * @type {Array<Object>}
   */
  #queue = [];


  /**
   * @param {string} metaURl (optonal) Used for accurate line number reporting.
   * @example const runner = new Runner(import.meta.url)
   */
  constructor(metaURL) {
    this.metaURL = metaURL;
    this.info = this.info.bind(this);
    this.test = this.test.bind(this);
    this.when = this.when.bind(this);
    this.profile = this.profile.bind(this);
    this.run = this.run.bind(this);
  }

  // Public

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
   * Handles primitives, objects, arrays, Dates, RegExps, Maps, Sets, and circular references.
   * @param {*} a The first value to compare.
   * @param {*} b The second value to compare.
   * @returns {boolean} True if the values are deeply equal, false otherwise.
   */
  equal(a, b) {
    // A Map to store visited pairs of objects to handle circular references.
    const visited = new Map();

    // The internal recursive comparison function.
    function _equal(x, y) {
      // If the values are strictly equal, they are equal.
      if (x === y) return true;

      // If either value is null or not an object, they are not equal (already checked by ===).
      if (x === null || typeof x !== 'object' || y === null || typeof y !== 'object') {
        return false;
      }

      // If the pair has already been visited, they are part of a cycle and considered equal so far.
      if (visited.has(x) && visited.get(x) === y) {
        return true;
      }

      // Store the pair for circular reference detection.
      visited.set(x, y);

      // Compare Dates by their time value.
      if (x instanceof Date && y instanceof Date) {
        return x.getTime() === y.getTime();
      }

      // Compare RegExps by their string representation.
      if (x instanceof RegExp && y instanceof RegExp) {
        return x.toString() === y.toString();
      }

      // Ensure constructors are the same.
      if (x.constructor !== y.constructor) {
        return false;
      }

      // Compare Maps by size and key-value pairs.
      if (x instanceof Map && y instanceof Map) {
        if (x.size !== y.size) return false;
        for (const [key, value] of x.entries()) {
          if (!y.has(key) || !_equal(value, y.get(key))) {
            return false;
          }
        }
        return true;
      }

      // Compare Sets by size and elements.
      if (x instanceof Set && y instanceof Set) {
        if (x.size !== y.size) return false;
        const yValues = [...y.values()];
        for (const value of x.values()) {
          if (!yValues.some(yValue => _equal(value, yValue))) {
            return false;
          }
        }
        return true;
      }

      // Compare arrays by length and elements.
      if (Array.isArray(x)) {
        if (x.length !== y.length) return false;
        for (let i = 0; i < x.length; i++) {
          if (!_equal(x[i], y[i])) return false;
        }
        return true;
      }

      // Compare plain objects by their own enumerable properties.
      const keysX = Object.keys(x);
      if (keysX.length !== Object.keys(y).length) return false;
      for (const key of keysX) {
        if (!Object.prototype.hasOwnProperty.call(y, key) || !_equal(x[key], y[key])) {
          return false;
        }
      }

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

    function* generate(index, currentCombination) {
      if (index === keys.length) {
        // Create a new object to avoid mutation issues
        yield { ...currentCombination };
        return;
      }

      const key = keys[index];
      const value = values[index];

      if (Array.isArray(value)) {
        for (const element of value) {
          currentCombination[key] = element;
          yield* generate(index + 1, currentCombination);
        }
      } else {
        currentCombination[key] = value;
        yield* generate(index + 1, currentCombination);
      }
    }

    yield* generate(0, {});
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
      switch(fnName) {
        case "executeTest":
          fn = this.#executeTest;
          break;
        case "getLine":
          fn = this.#getLine;
          break;
        case "getStyle":
          fn = this.#getStyle;
          break;
        case "printResult":
          fn = this.#printResult;
          break;
      }
    }

    return this.benchmark(fn, times, thisArg, ...args);
  }

  /**
   * Executes all queued tests and informational messages asynchronously.
   * Reports progress and final results to the configured output target in the order they were defined.
   * @returns {Promise<void>} A promise that resolves when all tests have completed and results are printed.
   */
  async run() {
    const total = this.#queue.length;
    let loaded = 0;
    this.#notifyProgress(0, total);

    const output = this.output;

    // Create a promise for each task in the queue.
    const executionPromises = this.#queue.map(task => {
      let promise;

      if (task.type === 'info') {
        promise = Promise.resolve({ type: 'info', message: task.payload.message });
      } else if (task.type === 'test') {
        promise = this.#executeTest(task.payload);
      }

      // Attach a handler to update progress as each promise resolves.
      // This does NOT print the result yet.
      return promise.then(result => {
        loaded++;
        this.#notifyProgress(loaded, total);
        return result; // Pass the result along
      });
    });

    // Wait for ALL tests to finish executing.
    const results = await Promise.all(executionPromises);

    // Iterate over the resolved results and print them sequentially.
    for (const result of results) {
      if (result.verdict === 'fail' || result.verdict === 'error') {
        this.#finalVerdict = 'fail';
      }

      if (result.type === 'info') {
        if (!this.onlyFailed) {
          this.#printResult(output, result.message, 'info');
        }
      } else if (result.type === 'test') {
        this.#printResult(
          output,
          result.gist,
          result.verdict,
          result.resolvedTestResult,
          result.expect,
          result.line
        );
      }
    }

    this.#notifyComplete();
    this.#printResult(output, "", 'done');
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

    if (typeof originalMethod !== 'function') {
      throw new Error(`${methodName} is not a function`);
    }

    const spy = {
      callCount: 0,
      calls: [],
      restore: () => {
        obj[methodName] = originalMethod;
      },
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
  test(gist, testFn, expect) {
    const line = this.metaURL ? this.#getLine() : null;
    this.#queue.push({
      type: 'test',
      payload: { gist, testFn, expect, line }
    });
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
   */
  async when(expression, timeoutMs = 1000, checkIntervalMs = 100) {
    const startTime = Date.now();
    let evaluation;

    if (typeof expression === 'function') {
      // Handles: waitFor(testAsync) or waitFor(() => testAsync() === 'foo')
      evaluation = async () => expression();
    } else if (expression instanceof Promise) {
      // Handles: waitFor(testAsync())
      evaluation = async () => expression;
    } else {
      // Handles: waitFor('foo' == 'foo') or other simple values
      evaluation = async () => expression;
    }

    while (true) {
      if (Date.now() - startTime >= timeoutMs) {
        // if timeout is reached, return the latest evaluation
        return await evaluation();
      }

      try {
        const result = await evaluation();
        // resolve it If the result is truthy
        if (result) return result;
      } catch (error) {
        // If the evaluation itself throws an error, we should fail fast.
        throw error;
      }

      await this.wait(checkIntervalMs);
    }
  }

  // Private

  /**
   * Executes a single test payload, handling async functions and errors.
   * @private
   * @param {object} payload The test payload from the queue.
   * @returns {Promise<object>} A promise that resolves with the structured test result.
   */
  async #executeTest(payload) {
    const { gist, testFn, expect, line } = payload;
    try {
      const testResult = (typeof testFn === 'function') ? testFn() : testFn;
      const resolvedTestResult = await testResult;
      const result = this.equal(resolvedTestResult, expect);
      const verdict = result ? 'pass' : 'fail';
      return { type: 'test', gist, verdict, resolvedTestResult, expect, line };
    } catch (error) {
      // If the test function itself throws an error, report it as an error.
      return { type: 'test', gist, verdict: 'error', resolvedTestResult: error, expect, line };
    }
  }

  /**
   * Gets the CSS style string for a given verdict.
   * @private
   * @param {string} verdict The test verdict ('pass', 'fail', etc.).
   * @returns {string} The CSS string for console styling.
   */
  #getStyle(verdict) {
    switch (verdict) {
      case 'pass': return 'color:limegreen; font-weight:bold';
      case 'fail': return 'color:red; font-weight:bold';
      case 'info': return 'color:darkorange; font-weight:bold';
      case 'error': return 'color:fuchsia; font-weight:bold;';
      default: return 'color:dodgerblue; font-weight:bold';
    }
  }

  /**
   * Determines the line number where a test was defined by creating and parsing an error stack.
   * @private
   * @returns {string|null} The line number as a string, or null if it cannot be determined.
   */
  #getLine() {
    try {
      throw Error('');
    } catch (error) {
      if (!error.stack) return null;
      const result = error.stack.split('\n').find(member => member.includes(this.metaURL));
      if (!result) return null;
      const start = result.indexOf(this.metaURL) + this.metaURL.length + 1;
      const end = result.lastIndexOf(':');
      return result.substring(start, end);
    }
  }

  /**
   * Dispatches a 'complete' event to the output target if it is a DOM element.
   * @private
   */
  #notifyComplete() {
    const target = (this.output.dispatchEvent) ? this.output : document;
    const completeEvent = new CustomEvent('complete', {
      detail: { verdict: this.#finalVerdict }
    });

    target.dispatchEvent(completeEvent);
  }

  /**
   * Dispatches a 'progress' event to the output target if it is a DOM element.
   * @private
   * @param {number} loaded The number of tests completed.
   * @param {number} total The total number of tests.
   */
  #notifyProgress(loaded, total) {
    const target = (this.output.dispatchEvent) ? this.output : document;
    const progressEvent = new ProgressEvent('progress', {
      lengthComputable: true,
      loaded: loaded,
      total: total
    });

    target.dispatchEvent(progressEvent);
  }

  /**
   * Prints a single test result to the configured output target.
   * @private
   */
  #printResult(output, gist, verdict, result, expect, line) {

    if (this.onlyFailed && verdict === 'pass') return;
    const style = this.#getStyle(verdict);
    const logArgs = [`%c${verdict.toUpperCase()}`, style, gist];
    if (verdict === 'fail' || verdict === 'pass' || verdict === 'error') {
      if (output === 'console') {
        console.groupCollapsed(...logArgs);
          console.log('Result:', result);
          console.log('Expected:', expect);
          if (line) console.log('Line:', line);
        console.groupEnd();
      } else {
        this.#sendResult(gist, verdict, result, expect, line)
      }
    } else {
      if (output === 'console') {
        console.log(...logArgs);
      } else {
        this.#sendResult(gist, verdict, result, expect, line);
      }
    }
  }

  /**
   * Sends a structured test result to a DOM element by creating and appending an `<output>` element.
   * @private
   */
  #sendResult(gist, verdict, result, expect, line) {
    let target;
    const obj = {gist, verdict, result, expect, line}

    if (result instanceof Error) {
      if (result.stack) {
        const stack = result.stack.split("\n");
        stack.unshift(result.message);
        obj.result = stack;
      } else {
        obj.result = result.message;
      }
    }

    const elem = document.createElement('output');
    elem.value = JSON.stringify(obj, null, 2);
    this.output.append(elem);
  }

  // GETTERS / SETTERS

  /**
   * Gets the current output target.
   * @returns {('console'|HTMLElement)}
   */
  get output() { return this.#output }

  /**
   * Sets the output target for test results.
   * @param {('console'|string|HTMLElement)} value - Can be 'console', a CSS selector string, or an HTMLElement.
   * @throws {Error} If the provided CSS selector does not match any element in the DOM.
   */
  set output(value) {
    let target;

    if (value === 'console') {
      this.#output = 'console';
    } else if (value instanceof HTMLElement) {
      this.#output = value;
    } else if (target = document.querySelector(value)) {
      this.#output = target;
    } else {
      throw new Error(`Cannot find output target: ${value} `);
    }
  }

  /**
   * Gets the final verdict of the test suite.
   * @returns {('pass'|'fail')}
   */
  get finalVerdict() { return this.#finalVerdict }
}
