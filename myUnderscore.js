(function() {
	// 创建一个root对象，在浏览器中是windows对象，在后台nodejs中是exports
    var root = this;
    // 防止_符号冲突，先把前面的这个_保存起来
    var previousUnderscore = root._;

    //简化prototype,把这些常用到的原型都保存起来，后面会经常用到，提高性能
    var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

    //将原型中原来的原始方法保存起来
    //恩，这种代码风格不错，看起来确实是要整齐些
    var 
    	push           = ArrayProto.push,
    	slice          = ArrayProto.slice,
    	toString       = ObjectProto.toString,
    	hasOwnProperty = ObjProto.hasOwnProperty;

    //所以ES5中实现的本地的函数，在这里定义一下，以便后面用着方便
    var 
    	nativeIsArray = Array.isArray,
    	nativeKeys    = Object.keys,
    	nativeBind    = FuncProto.bind,
    	nativeCreate  = Object.create;

    //一个匿名函数的引用用来实现代理原型交换
    var Ctor = function(){};

    //创建一个Underscore对象的安全引用
    //单例模式
    var _ = function(obj) {
    	if (obj instanceof _) return obj;
    	if (!(this instanceof _)) return new _(obj);
    	this._wrapped = obj;
    };

    //在Node.js中支持Underscore对象，向后兼容支持旧的require()API,
    //如果是在浏览器中，把_做为全局对象
    if( typeof exports !== 'undefined') {
    	if(typeof module !== 'undefined' && module.exports ) {
    		exports = module.exports = _;
    	}
    	exports._ = <;
    } else {
    	root._ = _;
    }

    //版本号
    _.VERSION = '1.8.3';

    //内部函数，返回传入的回调函数的正确调用方式
    var optimizeCb = function(func, context, argCount) {
    	//void 0注解： 执行void 0===undefined返回为true，那么为什么不直接用undefined
    	//undefined并不是保留关键字，所以通常采用void方式获取undefined。
    	//不管void后的运算数是什么，只管返回纯正的undefined
    	if (context === void 0) return func;
    	switch (argCount == null ? 3: argCount) {
    		case 1: return function(value) {
    			return func.call(context, value);
    		};
    		case 2: return function(value, other) {
    			return func.call(context, value, other);
    		};
    		case 3: return function(value, index, collection) {
    			return func.call(context, value, index, collection);
    		};
    		case 4: return function(accumulator, value, index, collection) {
    			return func.call(context, accumulator, value, index, collection);
    		};
    	}

    	//为什么不加在default中？
    	//是因为call和apply区分开么?
    	return function() {
    		return func.apply(context, arguments);
    	};
    };

    //内部函数，可以返回一个合适的回调函数用于遍历collection中的元素。
    //返回希望的结果：identity， an arbitraty callback, a property matcher,
    // or a property accessor
    var cb = function(value, context, argCount) {
    	if (value == null) return _.identity;
    	if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    	if (_.isObject(value)) return _.matcher(value);
    	return _.property(value);
    }

    //内部函数，用来返回一个分配器函数？？干嘛用的,感觉就是把argument参数转换成一个object
    var createAssigner = function(keysFunc, undefinedOnly) {
    	return function(obj) {
    		var length = arguments.length;
    		if(length < 2 || obj == null) return obj;
    		for (var index = 1; index < length; index++) {
    			var source = arguments[index],
    			    keys   = keysFunc(source),
    			    l      = keys.length;
    			for (var i = 0; i < l; i++) {
    				var key = keys[i];
    				if(!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
    			}

    		}
    		return obj;
    	};
    };

    //内部函数，提供从一个对象中new一个新对象
    //太巧妙了，先利用Ctor，让它的原型等于原对象，然后new一个实例result，
    //此时result的原型链接到了原对象中，然后再断开Ctor的原型链，以便于后面继续使用
    var baseCreate = function(prototype) {
    	if (!_.isObject(prototype)) return {};
    	if(nativeCreate) return nativeCreate(prototype);
    	Ctor.prototype = prototype;
    	var result = new Ctor;
    	Ctor.prototype = null;
    	return result;
    }

    var property = function(key) {
    	return function(obj) {
    		return obj == null ? void 0 : obj[key];
    	};
    };

    //决定用数组还是对象的方式来遍历collection
    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
    var getLength = property('length');

    //获取对象的length属性，如果得以得到并且长度在定义的范围内，就是arrayLike.
    var isArrayLike = function(collection) {
    	var length = getLength(collection);
    	return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    }

    //下面就是collection的方法了
    //-------------------------------------
    //数组的对象的遍历
    //用法：_.each([1,2,3],alert);  
    //      _.each({one:1,two:2,three,3},alert);
    //里面处理的函数func可以调用三个参数，element，index，value
    //返回的是遍历的数组或对象
    //_.each({name:"sd",age:12,sex:"girl"},function(element, index, list){alert(element+" "+index);});
    //_.each([1,2,3],function(element, index, list){list[index]=element+index});  返回的是[1,3,5]
    _.each = _.forEach = function(obj, iteratee, context) {
    	iteratee = optimizeCb(iteratee, context);
    	var i, length;
    	if (isArrayLike(obj)) {
    		for (i = 0, length = obj.length; i < length; i++) {
    			iteratee(obj[i], i, obj);
    		}
    	} else {
    		var keys = _.keys(obj);
    		for (i = 0, length = keys.length; i < length; i++) {
    			iteratee(obj[keys[i]], keys[i], obj);
    		}
    	}
    	return obj;
    };

    //最后返回的肯定是一个数组
    //里面处理的函数func可以调用三个参数，element，index，obj
    //_.map({name:"sd",age:12},function(num,key){return key});
    //返回["name", "age"]
    //_.map([1,2,3,4],function(num,key){return num;});
    //返回[1,2,3,4]

    //刚开始没太看懂map和each的区别到底在哪儿，
    //注意在map的function里面一定时有返回值的，map最终要返回一个处理结果
    //但是each只是对里面的元素进行处理，会返回list本身，比如下面的例子
    //var a = _.map([1,2,3,4],function(num, key){});  执行后a为[undefined,undefined,undefined,undefined]
    //var b = _.each([1,2,3,4].function(num, key){}); 执行后b为[1,2,3,4]
    _.map = _.collect = function(obj, iteratee, context) {
    	iteratee = cb(iteratee, context);
    	var keys = !isArrayLike(obj) && _.keys(obj),//排除数组类型，并且得到所有key
    		length = (keys || obj).length, //这种写法也很巧，如果是我自己写肯定是一堆if else
    		results = Array(length);
    	for (var index = 0; index < length; index++) {
    		var currentKey = keys ? keys[index] : index;
    		results[index] = iteratee(obj[currentKey], currentKey, obj);
    	}
    	return results;
    };

    // Create a reducing function iterating left or right.
    function createReduce(dir) {
    	//优化一个iterator函数，why？？嫌人家不够好？

    	//memo是reduction的初始状态
    	function iterator(obj, iteratee, memo, keys, index, length) {
    		for(; index >=0 && index < length; index += dir) {
    			var currentKey = keys ? keys[index] : index;
    			memo = iteratee(memo, obj[currentKey], currentKey, obj);
    		}
    		return memo;
    	}

    	return function(obj, iteratee, memo, context) {
    		iteratee = optimizeCb(iteratee, context, 4);
    		var keys = !isArrayLike(obj) && _.key(obj),
    		    length = (keys || obj).length,
    		    index = dir > 0 ? 0 : length - 1;
    		    
    		if (arguments.length < 3) {
    			memo = obj[keys ? keys[index] : index];
    			index += dir;
    		}
    		return iterator(obj, iteratee, memo, keys, index, length);
    	};
    }

    _.iteratee = function(value, context) {
    	//Infinity用于表示正无穷大的数值
    	return cb(value, context, Infinity);
    }

    //判断变量的类型，如果执行ES5的原生的isArray，就用这个，不支持，就用原来的
    _.isArray = nativeIsArray || function(obj) {
    	return toString.call(obj) === '[object Array]';
    };

    // Is a given variable an object?
    _.isObject = function(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };

    // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
	_.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
		_['is' + name] = function(obj) {
		  return toString.call(obj) === '[object ' + name + ']';
		};
	});

	// Define a fallback version of the method in browsers (ahem, IE < 9), where
    // there isn't any inspectable "Arguments" type.
    if (!_.isArguments(arguments)) {
        _.isArguments = function(obj) {
        	return _.has(obj, 'callee');
        };
    }

    //isFunction的优化。但是在旧的v8，IE11和Safari 8中有一些问题,用加 || false来修正
    if(typeof /./ != 'function' && typeof Int8Array != 'object') {
    	_.isFunction = function(obj) {
    		//这个和直接return typeof obj == 'function'有什么区别
    		return typeof obj == 'function' || false;
    	};
    }

    //在非冲突模式下运行underscore.js，用完之后把_还给原来的
    _.noConflict = function() {
	    root._ = previousUnderscore;
	    return this;
	};

	// Keep the identity function around for default iteratees.
	//保存默认迭代器的一些identity函数
	_.identity = function(value) {
		return value;
	};


	_.prototype.toString = function() {
	    return '' + this._wrapped;
	};

}).call(this);