import obj from './test-files/testObject.js';
import ATestRunner from '../src/ATestrunner.js';
const runner = new ATestRunner(import.meta.url)
const {benchmark, equal, genCombos, info, profile, spyOn, test, wait, when} = runner;

info("Testing ATestRunner functions");

    test(
    	"'foo' === 'foo'",
    	'foo' === 'foo',
    	true
    )

    test(
    	"'foo' === 'bar' // should FAIL",
    	'foo' === 'bar',
    	true
    )

    test(
    	"'foo' === 'bar' // PASS",
    	'foo' === 'bar',
    	false
    )

    test(
    	"multi-line test should return true",
    	() => {
    		const foo = 'bar';
    		return true;
    	},
    	true
    );

info("---- equal() ----");

    test(
    	"equal(['a','b'], ['a','b']) // true",
    	equal(['a','b'], ['a','b']),
    	true,
    	11
    );

    test(
    	"equal(['a','b'], ['a','c']) // false",
    	equal(['a','b'], ['a','c']),
    	false,
    	18
    );

    test(
    	"equal({a:1, b:2}, {a:1, b:2}) // true",
    	equal({a:1, b:2}, {a:1, b:2}),
    	true
    );

    test(
    	"equal({a:1, b:3}, {a:1, b:2}) // false",
    	equal({a:1, b:3}, {a:1, b:2}),
    	false
    );

    const obj1 = {};
    obj1.self = obj1;

    const obj2 = {};
    obj2.self = obj2;

    test(
        "equal() should return true for two simple, identically structured circular objects",
        equal(obj1, obj2),
        true
    );

    const a1 = {};
    const b1 = { parent: a1 };
    a1.child = b1; // a1 -> b1 -> a1 cycle

    const a2 = {};
    const b2 = { parent: a2 };
    a2.child = b2; // a2 -> b2 -> a2 cycle

    test(
        "equal() should return true for two complex, identically structured circular objects",
        equal(a1, a2),
        true
    );

    const a3 = {};
    const b3 = { parent: a3, value: 1 }; // Note the different value
    a3.child = b3;

    const a4 = {};
    const b4 = { parent: a4, value: 99 }; // Note the different value
    a4.child = b4;

    test(
        "equal() should return false for circular objects with different property values",
        equal(a3, a4),
        false
    );

    const c = {};
    const d = { a: c };
    c.a = d;
    test(
        "equal() should handle nested circular references",
        equal({ a: c }, { a: d }),
        true
    );

    const x = {};
    const y = { a: 1 };
    x.y = y;
    y.x = x;

    const z = {};
    const w = { a: 2 };
    z.w = w;
    w.z = z;
    test(
        "equal() should return false for objects with different values in circular references",
        equal(x, z),
        false
    );


    test(
        "equal() should correctly compare RegExp objects",
        equal(/abc/gi, new RegExp('abc', 'ig')),
        true
    );

    test(
        "equal() should return false for different RegExp objects",
        equal(/abc/g, /abd/g),
        false
    );

    const map1 = new Map([['a', 1], ['b', { x: 2 }]]);
    const map2 = new Map([['a', 1], ['b', { x: 2 }]]);
    test(
        "equal() should correctly compare Map objects",
        equal(map1, map2),
        true
    );

    const map3 = new Map([['a', 1], ['b', 2]]);
    const map4 = new Map([['b', 2], ['a', 1]]);
    test(
        "equal() should correctly compare Map objects regardless of order",
        equal(map3, map4),
        true
    );


    const set1 = new Set([1, { a: 2 }]);
    const set2 = new Set([1, { a: 2 }]);
    test(
        "equal() should correctly compare Set objects",
        equal(set1, set2),
        true
    );

info("---- await wait(50) ----")

    test(
    	"The time difference from before wait(50) and after should be >= 50",
    	 async () => {
            const initialTime = new Date().getTime();
            await wait(50);
            const finalTime = new Date().getTime();
            return finalTime - initialTime >= 50;
         },
    	true
    );

info("---- when() ----")

    test(
    	"() => when(1 === 1)",
    	() => when(1 === 1),
    	true
    );

    test(
    	"() => when(1 === 2) // should FAIL",
    	() => when(1 === 2),
    	true
    );

    test(
    	"() => when(async () => 'foo')",
    	() => when(async () => 'foo'),
    	'foo'
    );

    test(
        "when() should return true",
        async () => {
            const afn = async function() {
                await wait(50);
                return 'foo';
            };
            return when(await afn() === 'foo');
        },
        true
    );

    test(
        "when() should timeout and return the last falsy value if condition is never met",
        async () => {
            const result = await when(() => 1 === 2, 200, 50);
            return result;
        },
        false
    );

    test(
        "when() should return 'foo'",
        runner.when(
            async() => new Promise( resolve => {
                setTimeout( () => resolve('foo'), 50)
            })
        ),
        'foo'
    );

    let foo = async() => new Promise( resolve => {
        setTimeout( () => resolve('foo'), 50)
    });

    test(
        "when() should return 'foo'",
        when(foo()),
        'foo'
    );

    test(
        "when() should return true",
        runner.when( async () => await foo() === 'foo'),
        true
    );

    test(
        "when() should correctly call 'wait' and not itself recursively",
        async () => {
            const startTime = performance.now();
            const result = await when(() => performance.now() - startTime > 100, 200, 20);
            return result;
        },
        true
    );

    test(
        "when() should throw an error if the evaluation function throws an error",
        async () => {
            let didThrow = false;
            try {
                await when(() => {
                    throw new Error("Test Error");
                }, 200, 50);
            } catch (e) {
                didThrow = e.message === "Test Error";
            }
            return didThrow;
        },
        true
    );

info("---- spyOn() ----")

    test(
    	"spyOn(obj, 'getArr').callCount should be 1",
    	() => {
    		const spy = spyOn(obj, 'getArr');
    		obj.getArr();
    		const result = spy.callCount;
    		spy.restore();
    		return result;
    	},
    	1
    );

info("---- genCombos() ----");

    test(
        "genCombos should generate all combinations for multiple array options",
        () => {
            const options = {
                a: [1, 2],
                b: ['x', 'y']
            };
            const combos = [...runner.genCombos(options)];
            return combos;
        },
        [
            { a: 1, b: 'x' },
            { a: 1, b: 'y' },
            { a: 2, b: 'x' },
            { a: 2, b: 'y' }
        ]
    );

    test(
        "genCombos should handle a mix of array and non-array options",
        () => {
            const options = {
                a: 1,
                b: ['x', 'y']
            };
            const combos = [...genCombos(options)];
            return combos;
        },
        [
            { a: 1, b: 'x' },
            { a: 1, b: 'y' }
        ]
    );

    test(
        "genCombos should return a single combination for no array options",
        () => {
            const options = {
                a: 1,
                b: 'x'
            };
            const combos = [...genCombos(options)];
            return combos;
        },
        [{ a: 1, b: 'x' }]
    );

    test(
        "genCombos should handle an empty options object",
        () => [...genCombos({})],
        [{}]
    );

info("---- profile() / benchmark() ----");

    test(
        "profile should benchmark a public method and return a number",
        async () => {
            const time = await profile('wait', 1, null, 10);
            return typeof time === 'number' && time >= 10;
        },
        true
    );

    test(
        "profile should benchmark a private method and return a number",
        async () => {
            const time = await profile('getStyle', 100, null, 'pass');
            return typeof time === 'number' && time >= 0;
        },
        true
    );

info("---- Error Handling ----")

test(
    "A test that throws an error should be caught and reported as an 'error' verdict",
    () => {
        throw new Error("This is an intentional error");
    },
    null
);

runner.run();
