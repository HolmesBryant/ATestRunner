/**
 * @file A modern, flexible JavaScript test runner for the browser.
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @version 2.1.0
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
  groupEnd(verdict) {
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
  #isGrouping = false;
  #groupGist = null;
  #groupBuffer = [];

  #getStyle(verdict) {
    switch (verdict) {
      case 'pass': return 'color:limegreen; font-weight:bold';
      case 'fail': return 'color:red; font-weight:bold';
      case 'info': return 'color:SandyBrown; font-weight:bold';
      // Gist color is now distinct from verdict color
      case 'GROUP_GIST': return 'color:darkorange; font-weight:normal';
      case 'error': return 'color:fuchsia; font-weight:bold;';
      default: return 'color:dodgerblue; font-weight:bold';
    }
  }

  #renderTestResult(result) {
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

  report(result) {
    if (this.#isGrouping) {
      this.#groupBuffer.push(result);
    } else {
      this.#renderTestResult(result);
    }
  }

  groupStart(gist) {
    this.#isGrouping = true;
    this.#groupGist = gist;
    this.#groupBuffer = [];
  }

  /**
   * When a group ends, render the complete, buffered group to the console.
   */
  groupEnd(verdict) {
    const verdictStyle = this.#getStyle(verdict);
    const gistStyle = this.#getStyle('GROUP_GIST');

    console.groupCollapsed(
      `%c${verdict.toUpperCase()} %c${this.#groupGist}`,
      verdictStyle,
      gistStyle
    );

    for (const result of this.#groupBuffer) {
      this.#renderTestResult(result);
    }

    console.groupEnd();

    this.#isGrouping = false;
    this.#groupGist = null;
    this.#groupBuffer = [];
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

  groupEnd(verdict) {
    this.#dispatchEvent({ gist: null, verdict: 'GROUP_END', groupVerdict: verdict });
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
  // --- Public Properties (unchanged) ---
  currentLine = null;
  onlyFailed = false;
  timeout = 2000;
  resultEventName = 'a-testresult';
  progressEventName = 'a-progress';
  completeEventName = 'a-complete';

  // --- Private Properties ---
  #definitionChain = Promise.resolve();
  #finalVerdict = 'pass';
  #metaURL;
  #output = 'console';
  #queue = [];
  #reporter;
  #inGroup = false;
  #currentGroupVerdict = 'pass';

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

  // --- Public API Methods (unchanged) ---
  async benchmark(fn, times = 1, thisArg = null, ...args) { const start = performance.now(); for (let i = 0; i < times; i++) { await fn.apply(thisArg, args); } const end = performance.now(); return end - start; }
  equal(a, b) { const visited = new Map(); function _equal(x, y) { if (x === y) return true; if (x === null || typeof x !== 'object' || y === null || typeof y !== 'object') return false; if (visited.has(x) && visited.get(x) === y) return true; visited.set(x, y); if (Object.getPrototypeOf(x) !== Object.getPrototypeOf(y)) return false; if (x instanceof Date) return x.getTime() === y.getTime(); if (x instanceof RegExp) return x.toString() === y.toString(); if (x instanceof ArrayBuffer || ArrayBuffer.isView(x)) { if (x.byteLength !== y.byteLength) return false; const view1 = new Uint8Array(x.buffer, x.byteOffset, x.byteLength); const view2 = new Uint8Array(y.buffer, y.byteOffset, y.byteLength); for (let i = 0; i < x.byteLength; i++) if (view1[i] !== view2[i]) return false; return true; } if (x instanceof Map) { if (x.size !== y.size) return false; for (const [key, value] of x) if (!y.has(key) || !_equal(value, y.get(key))) return false; return true; } if (x instanceof Set) { if (x.size !== y.size) return false; const yValues = [...y]; for (const value of x) { const index = yValues.findIndex(yValue => _equal(value, yValue)); if (index === -1) return false; yValues.splice(index, 1); } return true; } if (Array.isArray(x)) { if (x.length !== y.length) return false; for (let i = 0; i < x.length; i++) if (!_equal(x[i], y[i])) return false; return true; } const keysX = Object.keys(x); if (keysX.length !== Object.keys(y).length) return false; for (const key of keysX) if (!Object.prototype.hasOwnProperty.call(y, key) || !_equal(x[key], y[key])) return false; return true; } return _equal(a, b); }
  *genCombos(options = {}) { const keys = Object.keys(options); const values = Object.values(options); function* generate(index, currentCombination) { if (index === keys.length) { yield { ...currentCombination }; return; } const key = keys[index]; const value = values[index]; if (Array.isArray(value)) { for (const element of value) { currentCombination[key] = element; yield* generate(index + 1, currentCombination); } } else { currentCombination[key] = value; yield* generate(index + 1, currentCombination); } } yield* generate(0, {}); }
  group(gist, testsCallback) { this.#definitionChain = this.#definitionChain.then(async () => { this.#queue.push({ type: 'group_start', payload: { gist } }); await testsCallback(); this.#queue.push({ type: 'group_end', payload: {} }); }); }
  handleError(error, options = {}) { let gist; const code = options.code ?? null; const line = options.line ?? this.currentLine ?? (this.#metaURL ? this.#getLine() : null); if (options.gist) { gist = options.gist; } else if (code) { gist = `Failed to execute:\n${code}` } else { gist = 'Error during setup'; } this.#queue.push({ type: 'test', payload: { gist, testFn: error, expect: null, line: line, verdict: 'error' } }); }
  info(message) { this.#queue.push({ type: 'info', payload: { message } }); }
  async profile(fnName, times, thisArg = this, ...args) { let fn = this[fnName]; if (!fn) { if (fnName === "executeTest") fn = this.#executeTest; else if (fnName === "getLine") fn = this.#getLine; } return this.benchmark(fn, times, thisArg, ...args); }
  async run() { await this.#definitionChain; this.#notifyProgress(0, this.#queue.length); await this.#processQueue(); this.#reporter.done(this.#finalVerdict); this.#notifyComplete(); }
  skip(gist, testFn, expect) { const line = this.currentLine ?? (this.#metaURL ? this.#getLine() : null); this.#queue.push({ type: 'skip', payload: { gist, testFn, expect, line, verdict: 'skip' } }); }
  spyOn(obj, methodName) { const originalMethod = obj[methodName]; if (typeof originalMethod !== 'function') { throw new Error(`'${methodName}' is not a function on the object.`); } let currentImplementation = originalMethod; const spy = { callCount: 0, calls: [], restore: () => { obj[methodName] = originalMethod; }, runs(fn) { currentImplementation = fn; return this; }, returns(value) { currentImplementation = () => value; return this; }, resolves(value) { currentImplementation = () => Promise.resolve(value); return this; }, rejects(error) { currentImplementation = () => Promise.reject(error); return this; } }; obj[methodName] = function (...args) { spy.callCount++; spy.calls.push(args); return currentImplementation.apply(this, args); }; return spy; }
  test(gist, testFn, expect, options = {}) { const line = this.currentLine ?? (this.#metaURL ? this.#getLine() : null); const payload = { gist, testFn, expect, line, ...options }; this.#queue.push({ type: 'test', payload }); }
  throws(testFn, ...args) { try { testFn(...args); return false; } catch (error) { return true; } }
  async wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  async when(expression, timeoutMs = 1000, checkIntervalMs = 100) { const startTime = Date.now(); let evaluation = (typeof expression === 'function') ? async () => expression() : (expression instanceof Promise) ? async () => expression : async () => expression; while (true) { if (Date.now() - startTime >= timeoutMs) return await evaluation(); try { const result = await evaluation(); if (result) return result; } catch (error) { throw error; } await this.wait(checkIntervalMs); } }

  // --- Private Methods ---

  #enqueue(queuingFunction) { this.#definitionChain = this.#definitionChain.then(queuingFunction); }
  #executeTask(task) { return (task.type === 'info') ? Promise.resolve({ type: 'info', message: task.payload.message }) : this.#executeTest(task.payload); }
  async #executeTest(payload) { const { gist, testFn, expect, line, verdict: predefinedVerdict, timeout } = payload; const testTimeout = timeout ?? this.timeout; try { if (predefinedVerdict) { const result = predefinedVerdict === 'error' ? testFn : 'Not executed'; return { type: 'test', gist, verdict: predefinedVerdict, result, expect, line }; } const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Test timed out after ${testTimeout}ms`)), testTimeout)); const executionPromise = (async () => { const testResult = (typeof testFn === 'function') ? testFn() : testFn; if (testResult instanceof Error) { return { type: 'test', gist, verdict: 'error', result: testResult, expect, line }; } const resolvedTestResult = await testResult; const verdict = this.equal(resolvedTestResult, expect) ? 'pass' : 'fail'; return { type: 'test', gist, verdict, result: resolvedTestResult, expect, line }; })(); return await Promise.race([executionPromise, timeoutPromise]); } catch (error) { return { type: 'test', gist, verdict: 'error', result: error, expect, line }; } }
  #getLine() { try { throw Error(''); } catch (error) { if (!error.stack) return null; const result = error.stack.split('\n').find(member => member.includes(this.#metaURL)); if (!result) return null; const start = result.indexOf(this.#metaURL) + this.#metaURL.length + 1; const end = result.lastIndexOf(':'); return result.substring(start, end); } }

  /**
   * Iterates through the task queue and manages the execution flow.
   * @private
   */
  async #processQueue() {
    const promiseGroups = [[]];

    for (const [index, task] of this.#queue.entries()) {
      switch (task.type) {
        case 'group_start':
          this.#reporter.groupStart(task.payload.gist);
          this.#inGroup = true;
          this.#currentGroupVerdict = 'pass'; // Reset for the new group
          break;

        case 'group_end':
          const groupPromises = promiseGroups[promiseGroups.length - 1];
          await this.#processGroupResults(groupPromises);
          groupPromises.length = 0;
          this.#reporter.groupEnd(this.#currentGroupVerdict); // Pass the final group verdict
          this.#inGroup = false;
          break;

        default: // test, info, skip
          const promise = this.#executeTask(task);
          if (this.#inGroup) {
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
      if (this.#inGroup) {
        this.#currentGroupVerdict = 'fail'; // Mark the current group as failed
      }
    }
    if (this.onlyFailed && result.verdict === 'pass') {
      return;
    }
    this.#reporter.report(result);
  }

  // --- Event Notification (unchanged) ---
  #notifyComplete() { const target = (this.#output.dispatchEvent) ? this.#output : document; const completeEvent = new CustomEvent(this.completeEventName, { detail: { verdict: this.#finalVerdict } }); target.dispatchEvent(completeEvent); }
  #notifyProgress(loaded, total) { const target = (this.#output.dispatchEvent) ? this.#output : document; const progressEvent = new ProgressEvent(this.progressEventName, { lengthComputable: true, loaded: loaded, total: total }); target.dispatchEvent(progressEvent); }

  // --- Getters / Setters (unchanged) ---
  get output() { return this.#output; }
  set output(value) { if (value === 'console') { this.#reporter = new ConsoleReporter(); this.#output = 'console'; return; } let target; if (value instanceof HTMLElement) { target = value; } else if (typeof value === 'string') { target = document.querySelector(value); } if (target) { this.#reporter = new DomEventReporter(target, this.resultEventName); this.#output = target; } else { throw new Error(`Cannot find output target: ${value}`); } }
  get finalVerdict() { return this.#finalVerdict; }
}
