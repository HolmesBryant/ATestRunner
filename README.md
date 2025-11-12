# ATestRunner

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://mit-license.org/)

A modern, flexible JavaScript test runner for the browser.

ATestRunner is a comprehensive suite for defining, running, and reporting tests. It operates on a queue-based system, allowing for asynchronous test execution with flexible output options to the console or a specified DOM element.

ATestRunner works with ECMAScript **modules**. That means the code you want to test must be **[exported](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)**.

Demo: [https://holmesbryant.github.io/ATestRunner/](https://holmesbryant.github.io/ATestRunner/)


## Features

* **Asynchronous Test Execution:** Runs tests asynchronously, making it suitable for testing modern JavaScript features like Promises and async/await.

* **Flexible Output:** View test results in the browser's developer console or send them to any HTML element for custom display.

* **Deep Equality Checks:** A powerful `equal()` method to compare complex objects, arrays, Maps, Sets, and even handles circular references.

* **Combinatorial Testing:** The `genCombos()` generator function makes it easy to create data-driven tests for numerous combinations of inputs.

* **Async Utilities:** Includes `wait()` and `when()` for handling and testing asynchronous operations with timeouts.

* **Spies:** Built-in `spyOn()` functionality to mock and track method calls on any object.

* **Benchmarking:** The `benchmark()` method allows for simple performance testing of your functions.

* **Zero Dependencies:** A lightweight, standalone library with no external dependencies.

## Change Log

v2.0.0

- Refactored the code to ensure each method has a single responsibility.

- Changed behavior of `onlyFailed` flag to also print "info" messages.

- Added `skip(gist, testFn, expect)` which reports the test as skipped and does not evaluate testFn. This has the same signature as test() to make it easy to skip/unskip tests.

- Added `group("gist", () => { // tests })` which allows you to group sets of tests under a common topic.

- Added `handleError(error, options = { gist=null, strTest=null, testLine=null })`. This is meant mainly as a utility for orchestrators.

v1.1.0

- Added `throws(fn, ...args)` method.
Usage: test('throws error', throws(fn, arg), true)

v1.0.3:

- Added property named `currentLine` and modified #getLine to first check this value before trying the error.stack trick. This allows an external test orchestrator to set the line number(s).

v1.0.2:

- Fixed regression where tests were being printed out of order.

v1.0.1:

- Made it so the ProgressEvent fires after each test is resolved for better progress reporting.

v1.0.0: Initial Commit

## Installation

Download the script and include it in your project.

## Quick Start

To use ATestRunner, write a test suite and import it into an html file.

```html
<!-- tests.html -->
<head>
  ...
  <script type="module" src="my-tests.js"></script>
</head>
<body>
	<p>Open the developer console to view results</p>
</body>
```

```javascript
// my-tests.js
import app from '../src/app.js';
import ATestRunner from './ATestrunner.min.js';
const runner = new ATestRunner(import.meta.url)
const {equal, info, spyOn, test, wait, when} = runner;

info("Testing My App");
test("App should work", app.works(), true);
...
runner.run();
```

**Why pass `import.meta.url` ?**

Passing import.meta.url to the ATestRunner constructor provides the test runner with the full path to your test file. ATestRunner uses this path to parse error stack traces, allowing it to report the precise line number on which a failing test was defined. This makes debugging significantly faster and more efficient. While this argument is optional, omitting it will result in test reports that do not include line numbers. For very large test suites, omitting this argument may speed up the process.

### Output to an HTML Element

By default, results are logged to the console. To send output to an HTML element, set the output property to a CSS selector or a reference to an instance of HTMLElement.

		runner.output = '#test-results';

----

## Public Properties

### currentLine = null;

The line number of the currently executing test file statement. This is intended to be set by an external orchestrator that parses the test file, allowing for more accurate line reporting when tests are defined dynamically. If null, the runner attempts to determine the line number automatically.

```javascript
		// This is typically set by a file-parsing orchestrator.
		// For a file containing `runner.test('my test', () => true, true);`on line 10:
		runner.currentLine = 10;

		// This test will be reported as being on line 10.
		runner.test('my test', () => true, true);
```

### onlyFailed = false;

If set to `true`, the report will only include tests that have a 'fail' or 'error' verdict. Passed and skipped tests will be suppressed from the output.

```javascript
		const runner = new ATestRunner(import.meta.url);
		// Configure the runner to only show failing tests.
		runner.onlyFailed = true;

		// This result will not be displayed.
		runner.test('passing test', 1, 1);

		// This result will be displayed.
		runner.test('failing test', 1, 2);

		runner.run();
```

### timeout = 2000;

The default maximum time in milliseconds that a single test is allowed to run before it is considered a failure. This can be overridden on a per-test basis.

```javascript
		const runner = new ATestRunner(import.meta.url);
		// Set a global timeout of 3 seconds for all tests.
		runner.timeout = 3000;

		// This test will now fail if it takes longer than 3000ms.
		runner.test('async task', async () => await someLongProcess(), 'expected');

		runner.run();
```
### resultEventName = 'a-testresult';

The name of the custom DOM event dispatched for each individual test result when using the `DomEventReporter`

```javascript
		document.body.addEventListener('my-custom-test-event', (e) => {
		 console.log('Received test result:', e.detail);
		});

		const runner = new ATestRunner(import.meta.url);

		// Use DOM event reporting.
		runner.output = document.body;

		runner.resultEventName = 'my-custom-test-event';
		runner.run();
```
### progressEventName = 'a-progress';

The name of the `ProgressEvent` dispatched as the test queue is processed. This event can be used to build a UI progress bar.

```javascript
		document.addEventListener('a-progress', (e) => {
		 if (e.lengthComputable) {
		   const percentComplete = (e.loaded / e.total) * 100;
		   console.log(`Tests are ${percentComplete.toFixed(0)}% complete.`);
		  }
		});
```
### completeEventName = 'a-complete';

The name of the custom DOM event dispatched once the entire test suite has finished running. The event's `detail` object contains the final verdict.

```javascript
		document.addEventListener('a-complete', (e) => {
    	console.log(`Test suite finished with verdict: ${e.detail.verdict}`);
    });
```
----

## Test API

#### test(gist, testFn, expect)

The test() method is the core of the runner. It queues a test for execution.

* `gist` (String): A brief description of the test's purpose.

* `testFn` (Function|any): The test function to execute, or an expression / Promise to be evaluated.

* `expect` (any): The expected result of the test function.

```javascript
	test("foo should be foo", 'foo' === 'foo', true)
	test("testFn() should return true", () => testFn(), true)
````

#### async benchmark(fn, times = 1, thisArg = null, ...args)

Benchmarks a function by running it a specified number of times and measuring the total execution time.

*   `fn` (Function): The function to benchmark.
*   `times` (Number): The number of times to run the function.
*   `thisArg`: The 'this' context for the function.
*   `...args`: Arguments to pass to the function.
*   Returns a Promise that resolves with the total time taken in milliseconds.

```javascript
	function heavyFunc(arg1, arg2) { ... }

	test(
		"heavyFunc() completes in under 2 seconds",
 		async () => await benchmark(heavyFunc, 1, null, 'foo', 'bar') < 2000,
 		true
	);
```

#### equal(a, b)

Performs a deep equality comparison between two values.

* `a` (any): The first value to compare.
* `b` (any): The second value to compare.
* Returns `boolean` `true` if the values are deeply equal, otherwise `false`.

```javascript
	test( "arrays should be equal", equal([1, 2], [1,2]), true)
````

#### genCombos(options = {})

A generator function that yields all possible combinations of properties from an options object.

* `options` (Object): An object where keys are property names and values are either single values or an array of possible values.
* Yields an object representing one unique combination of the provided options.

```javascript
	const options = { a: [1, 2], b: 'c' };

	for (const combo of genCombos(options)) {
		// First iteration: combo is { a: 1, b: 'c' }
		// Second iteration: combo is { a: 2, b: 'c' }
	}
```

#### group(gist, callback)

Queues a group of tests under a common description.

* gist: The gist (description) of the group.

* callback: A function containing test definitions for the group.

```javascript
	group("Group Description", () => {
		info("a message");
		test("foo should be a string", typeof 'foo', 'string');
		pass("don't run this yet", foo(), true);
	});
```

### handleError(error, options = {})

Handles errors that occur during the test **definition** phase. Mostly useful for external orchestrators.

* error: The captured error object.
* options={}: An optional object for providing additional context.
* options.gist='Error during test setup': A custom description of what failed.
* options.code: The raw string of code that was being executed when the error occurred.
* options.line: The specific line number where the error occurred. If not provided, the runner will attempt to determine it.

```javascript
	// Usage inside a manual try/catch block
	try {
	  test("This test would have thrown an Error", nonExistentVar, "expected");
	} catch (error) {
	  runner.handleError(error, { gist: 'A variable was not defined' });
	}

	@example
	// Usage by an orchestrator that has more context
	runner.handleError(error, {
	  gist: 'Failed to parse test statement',
	  code: 'test("bad test", () => a.b.c(), "foo")',
	  line: 42
	});
```

#### info(message)

Queues an informational message to be displayed in the test results.

* `message` (String): The message to display.

`info("this is an informational message")`


#### skip(gist, testFn, expect)

Allows you to skip a test and report it as "skipped". The signature is exacly the same as test().

```javacript
	skip('This test will be skipped', () => someFunc(), expectedValue);
```

#### spyOn(obj, methodName)

Creates a spy on a method of an object.

* `obj` (Object): The object containing the method to spy on.
* `methodName` (String): The name of the method to spy on.
* Returns a spy object with `callCount`, `calls`, and a `restore` function.

```javascript
	const spy = spyOn(console, 'log');
	console.log('foo');

	test(
		"console.log was called 1 time",
		spy.callCount === 1,
		true
	);

	test(
		"console.log was called with arg 'foo'",
		spy.calls[0] === 'foo',
		true
	);

	spy.restore();
```

#### throws(testFn, ...args)

Checks if a function throws an error when executed with the given arguments.

* testFn (Function): The function to test.
* args ({...\*}): The arguments to pass to the test function.
* Returns `boolean` `true` if the function throws an error, otherwise `false`.

```javascript
	function someFunc(arg) { if (arg !== 'foo') throw new Error('Oopsie') }
	test("throws an error", throws( someFunc, 'bar'), true )
	test("does not throw an error", throws( someFunc, 'foo'), false )
````

#### async wait(ms)

Returns a promise that resolves after a specified number of milliseconds.

* `ms` (Number): The number of milliseconds to wait.

```javascript
	test(
		"waiting a few ticks",
		async () => {
			document.body.append(document.createElement('div'));
			await wait(10);
			return document.body.querySelector('div') !== null;
		},
		true
	);
````

#### async when(expression, timeoutMs = 1000, checkIntervalMs = 100)

Waits for an expression, function, or promise to become "truthy".

* `expression` (Function|Promise): The condition to wait for.
* `timeoutMs` (Number): The maximum time to wait in milliseconds.
* `checkIntervalMs` (Number): The interval between checks in milliseconds.
* Returns a Promise that resolves with the first truthy result of the expression, or the last evaluated result on timeout.

```javascript
	function async asyncFunc() { return 'foo' }
	test( when( asyncFunc() ), 'foo' )
  test( when( await asyncFunc() === 'foo' ), true )
```
----

## Running the Included Tests

The `atestrunner.tests.js` file in the `tests` folder contains a comprehensive test suite for the `ATestRunner` itself. Check it out to get a better idea of how to write your own tests.
