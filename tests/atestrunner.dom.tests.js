/**
 * An example test suite for ATestRunner
 * @file example.test.js
 * @url https://github.com/HolmesBryant/ATestRunner
 */

// import app from './app.js';
import ATestRunner from '../src/ATestrunner.js';


/**
 * This is an example app.
 * This would normally be in its own file (app.js);
 * It is only included here so you can see its properties and functions.
 */
const app = {
	foo: 'foo',
	bar: null,
	baz: undefined,
	arr: [1,2,3],
	pojo: {a:1, b:2, c:3},
	date1: new Date('2025-01-01'),
	date2: new Date('2025-01-01'),
	date3: new Date('2025-01-02'),
	map1: new Map([['a', 1], ['b', 2]]),
	map2: new Map([['b', 2], ['a', 1]]),
	set1: new Set([1, {a: 1}]),
	set2: new Set([{a: 1}, 1]),
	getArg(arg) { return arg },
	getPojo() { return this.pojo },
	async asyncFunc(arg) {
		return new Promise((resolve, reject) => {
  		setTimeout(() => { resolve(arg) }, 300);
		});
	},
	insertElem(tag) {
		const elem = document.createElement(tag);
		document.body.append(elem);
	},
	throwsError(arg) {
		if (arg !== 'goodArg') throw new Error('Oopsie!');
	}
};


// omit `import.meta.url` to disable line numbers.
// For very large test suites, disabling line numbers will save time.
const runner = new ATestRunner(import.meta.url)
runner.output = '#results';

const {
	benchmark,
	equal,
	genCombos,
	group,
	handleError,
	info,
	log,
	skip,
	spyOn,
	test,
	throws,
	wait,
	when
} = runner;

info("ATestRunner test suite");

group("Basic Tests", () => {
	// test(gist, testFn, expectedValue)
	test("app.foo", app.foo, 'foo');
	test("app.foo === foo", app.foo === 'foo', true);

	// For simple synchronous cases, you don't have to wrap test expressions in a function
	test("app.getArg('foo') === foo", app.getArg('foo') === 'foo', true);

	// Even when you don't *have* to wrap test expressions in a function, you can.
	test("app.getArg('foo')", () => app.getArg('foo'), 'foo');
	skip("This should fail", app.foo, 'bar');
});

// skip(gist, testFn, expectedValue)
skip("This is skipped", app.foo, 'bar');

group("Testing throws()", () => {
	// throws(testFn, ...args)
	test("This test passes", throws( app.throwsError, 'badArg' ), true )
	test("This test also passes", throws( app.throwsError, 'goodArg' ), false )
});

group("Testing benchmark()", () => {
	// async benchmark(fn, nubmerOfTimesToRun = 1, thisArg = null, ...args)
	test(
		"asyncFunc() should complete in under 2 seconds",
	 	async () => await benchmark(app.asyncFunc, 1, null, 'arg1', 'arg2') < 2000,
	 	true
	);
});

group("Testing equal()", () => {
	// equal(a, b)
	test("arrays should be equal", equal(app.arr, [1,2,3]), true);
	test("getPojo should return {a:1, b:2, c:3}", equal(app.getPojo(), {a:1, b:2, c:3}), true);

	const circularA = {};
	const circularB = {};
	circularA.b = circularB;
	circularB.a = circularA;

	test("circular references should not cause an infinite loop", equal(circularA, circularB), false);

	const obj1 = {};
	const obj2 = {};
	obj1.a = obj2; // obj1 has property 'a'
	obj2.b = obj1; // obj2 has property 'b'

	const obj3 = {};
	const obj4 = {};
	obj3.a = obj4; // obj3 has property 'a'
	obj4.b = obj3; // obj4 has property 'b'
	test("handles circular references with identical structures", equal(obj1, obj3), true);

	// dates
	test("handles Dates correctly", equal(app.date1, app.date2), true);
	test("handles different Dates correctly", equal(app.date1, app.date3), false);

	// Maps and Sets
	test("handles Maps", equal(app.map1, app.map2), true);
	test("handles Sets with objects", equal(app.set1, app.set2), true);
});

// async wait(milliseconds)
test(
	"Finds HTML element after appending it and waiting 10ms",
	async () => {
		app.insertElem('div');
		await wait(10);
		return document.body.querySelector('div') !== null;
	},
	true
)

group("Testing when()", async () => {
	// async when(expression, timeoutMs = 1000, checkIntervalMs = 100)

	// if you just need the return value from an async operation, you don't have to await it (but you can)
	test("asyncFunc should return 'foo'", when( app.asyncFunc('foo') ), 'foo' )

	// if you need to compare the return value with something else, you *must* use await
	test(
		"asyncFunc === 'foo'",
		when( await app.asyncFunc('foo') === 'foo' ),
		true
	);

	skip(
		"This test should fail",
		when( app.asyncFunc('foo') === 'foo' ),
		true
	);

	test(
	  "when() should time out and return the final falsy value",
	  when(() => document.getElementById('non-existent-element'), 200, 10),
	  null
	);
});

group("Testing spyOn()", () => {
	// spyOn(object, methodName)
	const spy = spyOn(console, 'debug');
	console.debug('called when testing spyOn()', 'foo');

	test(
		"console.debug was called 1 time",
		spy.callCount,
		1
	);

	test(
		"console.debug was called with arg 'foo'",
		spy.calls[0][1],
		'foo'
	);

	spy.restore();

	const appSpy = spyOn(app, 'getArg');
	const returnValue = app.getArg('return test');

	test("spyOn should not interfere with a method's return value", returnValue, 'return test');
	appSpy.restore();
});

group("Testing genCombos()", () => {
	/**
	 * *genCombos(options = {})
	 * First iteration yields { a: 1, b: 'c' }
	 * Second iteration yields { a: 2, b: 'c' }
	 */
	const options = { a: [1, 2], b: 'c' };

	log('logging test object', options);

	for (const combo of genCombos(options)) {
		// Dynamically create a test for each combination
	  test(`Combination with a=${combo.a} should have b='c'`, combo.b, 'c');
	}
});

group("Testing code execution before tests", () => {
	function setupApp(app) {
		app.foo = 'newvalue';
		app.baz = 'boom';
	}

	function teardownApp(app) {
		app.foo = 'bar';
		app.baz = null;
	}

	setupApp(app);

	log('snapshot', app);

	test("app.foo should be 'newvalue'", () => {
		return app.foo;
	}, 'newvalue');

	test("app.baz should be 'boom'", () => {
		return app.baz;
	}, 'boom');

	teardownApp(app);
});

group("Testing code execution after tests", () => {
	test("app.foo should be `bar`", () => {
		return app.foo;
	}, 'bar');
});

group("Testing group setup involving DOM elements", () => {
	const elem = document.createElement('div');
	elem.id="test-elem";
	document.body.append(elem);

	test("Successfully finds test element", () => {
		return document.getElementById('test-elem')?.localName;
	}, 'div');

	elem.remove();
});

/*group("Testing DOM Events", () => {
	const outputEl = document.createElement('div');
	outputEl.addEventListener(runner.resultEventName, (event) => { event.target.toggleAttribute('flag', true) });
	// Store the original output
	const originalOutput = runner.output;
	document.body.append(outputEl);

  test("sends correctly formatted result events to an HTMLElement", async () => {
    // Create a separate runner for this test.
    const eventRunner = new ATestRunner();
    const outputEl = document.createElement('div');
    eventRunner.output = outputEl;

    // a promise that resolves when the event is caught.
    const eventPromise = new Promise(resolve => {
      outputEl.addEventListener(eventRunner.resultEventName, (event) => {
        resolve(event.detail);
      }, { once: true });
    });

    eventRunner.test("DOM Event Test", "expected result", "expected result");
    eventRunner.run();

    // Wait for the promise from the listener to resolve.
    const eventDetail = await eventPromise;

    const gistIsCorrect = eventDetail.gist === "DOM Event Test";
    const verdictIsCorrect = eventDetail.verdict === "PASS";
    const resultIsCorrect = eventDetail.result === "expected result";

    return gistIsCorrect && verdictIsCorrect && resultIsCorrect;
  }, true);
});*/

group("Testing DOM Events", async () => {
	const eventRunner = new ATestRunner();
	const outputEl = document.createElement('div');
	const originalOutput = runner.output;
	document.body.append(outputEl);
	eventRunner.output = outputEl;

	const resultPromise = new Promise( resolve => {
		outputEl.addEventListener(eventRunner.resultEventName, event => {
			resolve(event);
		}, { once: true });
	});

	const progressPromise = new Promise(resolve => {
		outputEl.addEventListener(eventRunner.progressEventName, event => {
			if (event.loaded === event.total) resolve(event);
		});
	});

	const completePromise = new Promise( resolve => {
		outputEl.addEventListener(eventRunner.completeEventName, event => {
			resolve(event);
		}, { once: true });
	});

	eventRunner.test('DOM events test', 'expected result', 'expected result');
	const result = await Promise.all([
		resultPromise,
		progressPromise,
		completePromise,
		eventRunner.run()
	]);

	test("Testing result event", () => {
		const evt = result[0];
		const gistIsCorrect = evt.detail.gist === 'DOM events test';
		const verdictIsCorrect = evt.detail.verdict === 'PASS';
		const resultIsCorrect = evt.detail.result === 'expected result';
		return gistIsCorrect && verdictIsCorrect && resultIsCorrect;
	}, true);

	test("Testing progress event", () => {
		const evt = result[1];
		return `${evt.total}, ${evt.loaded}`;
	}, '1, 1');

	test("Testing complete event", () => {
		const evt = result[2];
		return evt.detail.verdict;
	}, 'pass')

	runner.output = originalOutput;
	outputEl.remove();
});

runner.run();

