export default {
	foo: 'foo',
	bar: null,
	baz: undefined,
	arr: [1,2,3],
	pojo: {a:1, b:2, c:3},
	async asyncFunc(arg) {
		return new Promise((resolve, reject) => {
  		setTimeout(() => { resolve(arg ?? 'foo') }, 300);
		});
	},
	getArr() { return this.arr }
};
