export default class App {
	foo = 'foo';
	bar = null;
	baz;

	constructor();

	getArg(arg) { return arg }

	async asyncFunc(arg) {
		return new Promise((resolve, reject) => {
			setTimeout(() => { resolve(arg) }, 100);
		});
	}

	throwsError(arg) {
		if (arg !== 'goodArg') throw new Error('Oopsie!');
	}
}

const app = new App();
export app;
