import obj from './test-files/testObject.js';
import ATestRunner from '../src/ATestrunner.js';
const runner = new ATestRunner(import.meta.url);
runner.doneMesage = 'Yo Dawg!'
const {equal, info, test, wait, when} = runner;

function insertElem(tag) {
	const elem = document.createElement(tag);
	document.body.append(elem);
}

info("Testing testObject")

info("--- Basic Properties ---")

test(
	"foo should be 'foo'",
	obj.foo,
	'foo'
);

test(
	'bar should be null',
	obj.bar,
	null
);

test(
	"baz should be undefined",
	obj.baz,
	undefined
);

test(
	"arr should be an Array",
	Array.isArray(obj.arr),
	true
);

test(
	"pojo.a should be 1",
	obj.pojo.a,
	1
);

info("--- methods ---");

test(
	"getArr() should return [1,2,3]",
	equal(obj.getArr(), [1,2,3]),
	true
);

test(
	"getPojo should return {a:1, b:2, c:3}",
	equal(obj.getPojo(), {a:1, b:2, c:3}),
	true
);

test(
	"asyncFunc() should return 'foo'",
	async () => await obj.asyncFunc(),
	'foo'
);

test(
	"testing insertElem('pre') with when()",
	async () => {
		insertElem('pre');
		await when(document.body.querySelector('pre'));
		const el = document.body.querySelector('pre');
		el.remove();
		return el instanceof HTMLPreElement;
	},
	true
)

test(
	"testing insertElem('pre') with wait()",
	async () => {
		insertElem('pre');
		wait(10);
		const el = document.body.querySelector('pre');
		el.remove();
		return el instanceof HTMLPreElement;
	},
	true
)

test(
	"this test should FAIL",
	1 === 2,
	true
)

test(
	"this test should throw an error",
	async () => obj.throwsError(),
  null
);

runner.run();

