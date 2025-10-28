# ATestRunner

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://mit-license.org/)

A modern, flexible JavaScript test runner for the browser.

ATestRunner is a comprehensive suite for defining, running, and reporting tests. It operates on a queue-based system, allowing for asynchronous test execution with flexible output options to the console or a specified DOM element.

ATestRunner works with ECMAScript **modules**. That means the code you want to test must be **[exported](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)**.

Demo: [https://holmesbryant.github.io/ATestRunner/](https://holmesbryant.github.io/ATestRunner/)


## Features

*   **Asynchronous Test Execution:** Runs tests asynchronously, making it suitable for testing modern JavaScript features like Promises and async/await.

*   **Flexible Output:** View test results in the browser's developer console or send them to any HTML element for custom display.

*   **Deep Equality Checks:** A powerful `equal()` method to compare complex objects, arrays, Maps, Sets, and even handles circular references.

*   **Combinatorial Testing:** The `genCombos()` generator function makes it easy to create data-driven tests for numerous combinations of inputs.

*   **Async Utilities:** Includes `wait()` and `when()` for handling and testing asynchronous operations with timeouts.

*   **Spies:** Built-in `spyOn()` functionality to mock and track method calls on any object.

*   **Benchmarking:** The `benchmark()` and `profile()` methods allow for simple performance testing of your functions.

*   **Zero Dependencies:** A lightweight, standalone library with no external dependencies.

## Change Log

- v.1.0.0 Initial commit.

## Installation

To use ATestRunner, simply import your test suite into your html file.

```html

		<!-- index.html -->
		<!DOCTYPE html>
		<html>
		<head>
		    <title>My Project Tests</title>
		    <script type="module" src="tests/my-tests.js"></script>
		</head>
		<body>
		    <!-- Optional: Add an element to display test results -->
		    <div id="test-results"></div>
		</body>
		</html>

```

## Usage

Create a new test file and import the ATestRunner class. Instantiate the runner and use its methods to define your tests.

### Basic Test

The test() method is the core of the runner. It queues a test for execution.

```javascript
		// tests/my-tests.js
		import ATestRunner from './ATestRunner.min.js';
		// Pass import.meta.url to the constructor for accurate line number reporting.
		const runner = new ATestRunner(import.meta.url);
		const { test } = runner;
		test(
		    "'foo' should be equal to 'foo'",
		    'foo' === 'foo',
		    true
		);
		runner.run();
```

**Why pass `import.meta.url` ?**

Passing import.meta.url to the ATestRunner constructor is highly recommended. It provides the test runner with the full path to your test file. ATestRunner uses this path to parse error stack traces, allowing it to report the precise line number on which a failing test was defined. This makes debugging significantly faster and more efficient. While this argument is optional, omitting it will result in test reports that do not include line numbers.

### Output to an HTML Element

By default, results are logged to the console. To send output to an HTML element, set the output property to a CSS selector or a reference to an instance of HTMLElement.

		runner.output = '#test-results';

## API

Here's a detailed look at the public API of `ATestRunner`.

To use any of these functions without having to write myRunnerInstance.whatever(), you can define them before you write your tests.

```javascript
		const runner = new ATestRunner(import.meta.url);
		const {test, equal, wait, when, etc...} = runner;

		// now, instead of writing
		runner.test(...)
		// you can write
		test(...)
```

#### `test(gist, testFn, expect)`

Queues a test for execution.

*   `gist` (String): A brief description of the test's purpose.
*   `testFn` (Function|*): The test function to execute, or a value/Promise to be evaluated.
*   `expect` (*): The expected result of the test function.

#### `info(message)`

Queues an informational message to be displayed in the test results.

*   `message` (String): The message to display.

#### `equal(a, b)`

Performs a deep equality comparison between two values.

*   `a` (*): The first value to compare.
*   `b` (*): The second value to compare.
*   **Returns:** `boolean` - `true` if the values are deeply equal, otherwise `false`.

#### `wait(ms)`

Returns a promise that resolves after a specified number of milliseconds.

*   `ms` (Number): The number of milliseconds to wait.

#### `when(expression, timeoutMs = 1000, checkIntervalMs = 100)`

Waits for an expression, function, or promise to become "truthy".

*   `expression` (Function|Promise): The condition to wait for.
*   `timeoutMs` (Number): The maximum time to wait in milliseconds.
*   `checkIntervalMs` (Number): The interval between checks in milliseconds.
*   **Returns:** `Promise<*>` - A promise that resolves with the first truthy result of the expression.

#### `spyOn(obj, methodName)`

Creates a spy on a method of an object.

*   `obj` (Object): The object containing the method to spy on.
*   `methodName` (String): The name of the method to spy on.
*   **Returns:** `Object` - A spy object with `callCount`, `calls`, and a `restore` function.

#### `*genCombos(options = {})`

A generator function that yields all possible combinations of properties from an options object.

*   `options` (Object): An object where keys are property names and values are either single values or an array of possible values.
*   **Yields:** `Object` - An object representing one unique combination of the provided options.

#### `benchmark(fn, times = 1, thisArg = null, ...args)`

Benchmarks a function by running it a specified number of times and measuring the total execution time.

*   `fn` (Function): The function to benchmark.
*   `times` (Number): The number of times to run the function.
*   `thisArg` (*): The 'this' context for the function.
*   `...args` (*): Arguments to pass to the function.
*   **Returns:** `Promise<number>` - A promise that resolves with the total time taken in milliseconds.

## Running the Included Tests

The `atestrunner.tests.js` file in the `tests` folder contains a comprehensive test suite for the `ATestRunner` itself. Check it out to get a better idea of how to write your own tests.
