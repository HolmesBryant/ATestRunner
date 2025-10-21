import obj from './test-files/testObject.js';
import ATestRunner from '../src/ATestrunner.js';
const runner = new ATestRunner(import.meta.url)
runner.output="#test-output";
const {equal, info, test, wait, when} = runner;

info("Testing testObject")

test(
	"asyncFunc() should return 'foo'",
	() => when(obj.asyncFunc),
	'foo'
);

test(
	"asyncFunc('bar') should return 'bar'",
	() => when(obj.asyncFunc('bar')),
	'bar'
);

test(
	"Testing that asyncFunc() === 'foo'",
	() => when( async () => await obj.asyncFunc() === 'foo'),
	true
);

test (
	"testing that asyncFunc('bar') === 'bar'",
	() => when( async () => await obj.asyncFunc('bar') === 'bar'),
	true
);

test("obj.foo should be 'foo'", obj.foo === 'foo', true );
test("obj.bar should be null", obj.bar, null );
test("obj.baz should be undefined", typeof obj.baz, 'undefined' );
test("obj.arr should be [1,2,3]", equal(obj.arr, [1,2,3]), true );
test("obj.pojo should be {a:1, b:2, c:3}", equal(obj.pojo, {a:1, b:2, c:3}), true)

runner.run();

