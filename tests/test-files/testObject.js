export default {
	foo: 'foo',
	bar: null,
	baz: undefined,
	arr: [1,2,3],
	pojo: {a:1, b:2, c:3},
	getArr() { return this.arr },
	getPojo() { return this.pojo },
	async asyncFunc(arg) {
		return new Promise((resolve, reject) => {
  		setTimeout(() => { resolve(arg ?? 'foo') }, 300);
		});
	},
	insertElem(tag) {
		const elem = document.createElement(tag);
		document.body.append(elem);
	},
	get code() {
  	const tempObj = this;
  	delete tempObj.code;
	  const replacer = (key, value) => {
	    if (typeof value === 'function') {
	      return value.toString();
	    }
	    return value;
	  };
	  return JSON.stringify(tempObj, replacer, 2);
	}
};
