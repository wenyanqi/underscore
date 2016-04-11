(function() {
	// 创建一个root对象，在浏览器中是windows对象，在后台nodejs中是exports
    var root = this;
    // 防止_符号冲突，先把前面的这个_保存起来
    var previousUnderscore = root._;

    //简化prototype,把这些常用到的原型都保存起来，后面会经常用到，提高性能
    var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

    //将原型中原来的原始方法保存起来码风格不错，看起来确实
    //恩，这种代是要整齐些
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
    };
    _.iteratee = function(value, context) {
        //Infinity用于表示正无穷大的数值
        return cb(value, context, Infinity);
    };
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
    };

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
    };

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
    //dir应该是表示每次迭代移动的距离
    function createReduce(dir) {
    	//根据reduce计算的需要优化iterator函数

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
    		
            //如果没有初始状态，将obj中第一个元素设置为初始状态
            //注意index要++，不然第一个元素就会被加两次
    		if (arguments.length < 3) {
    			memo = obj[keys ? keys[index] : index];
    			index += dir;
    		}
    		return iterator(obj, iteratee, memo, keys, index, length);
    	};
    }

    _.reduce = _.fold1 = _.inject = createReduce(1);

    //所以把createReduce封装成了一个函数，这样两个不同的功能实现就可以用这个了
    _.reduceRight = _.folder = createReduce(-1);

    //用户传入函数，返回满足条件的第一个元素
    //var a = _.find([1,2,3,4,5],function(value,index){return index>2;});
    // a是4
    _.find = _.detect = function(obj, predicate, context) {
        var key;
        if(isArrayLike(obj)) {
            key = _.findIndex(obj, predicate, context);
        } else {
            key = _.findKey(obj, predicate, context);
        }
        //数组没找到，会返回-1，对象会返回undefined
        if (key !== void 0 && key != -1) return obj[key];
    };

    //返回满足条件的所有元素
    //var a = _.filter([1,2,3,4,5],function(value,index){return index>2;});
    // a是[4,5]
    _.filter = _.select = function(obj, predicate, context) {
        var results = [];
        predicate = cb(predicate, context);
        _.each(obj, function(value, index, list) {
            if(predicate(value, index, list)) results.push(value);
        });
        return results;
    };

    //找到所有不符合条件的元素
    _.reject = function(obj, predicate, context) {
        return _.filter(obj, _.negate(cb(predicate)), context);
    };

    //判断是不是所有的元素都符合条件
    _.every = _.all = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length;
        for(var index = 0; index < length; index ++) {
            var currentKey = keys ? keys[index] : index;
            if(!predicate(obj[currentKey], currentKey, obj)) return false;
        }
        return true;
    };

    //判断对象中是否有元素符合条件
    _.some = _.any = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length;
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            if(predicate(obj[currentKey], currentKey, obj)) return true;
        }
        return false;
    };

    //是否包含给定的元素,也是利用indexOf来实现的
    _.contains = _.includes = _.include = function(obj, item, fromeIndex, guard) {
        if (!isArrayLike(obj)) obj = _.values(obj);
        if (typeof formIndex != 'number' || guard) fromIndex = 0;
        return _.indexOf(obj, item, fromIndex) >= 0;
    };

    //在每一个元素上调用传入的方法，调用map实现
    //_.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
    //返回[[1, 5, 7], [1, 2, 3]]，sort是数组的方法
    _.invoke = function(obj, method) {
        var args = slice.call(arguments, 2);
        var isFunc = _.isFunction(method);
        return _.map(obj, function(value) {
            //如果是函数，func就是这个函数，
            //如果不是函数，就去找这个obj里面有没有这个方法，赋给func
            //如果上面两种都是，func为null
            var func = isFunc ? method : value[method];
            return func == null ? func : func.apply(value, args);
        });
    };

    //利用map获得属性
    //var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
    //_.pluck(stooges, 'name');
    //=> ["moe", "larry", "curly"]
    _.pluck = function(obj, key) {
        return _.map(obj, _.property(key));
    };

    //找到所有包含有特殊的key:value对的对象
    _.where = function(obj, attrs) {
        return _.filter(obj, _.matter(attrs));
    };

    //找到第一个包含key:value键值对的obj
    _.findWhere = function(obj, attrs) {
        return _.find(obj, _.matter(attrs));
    };

    //返回最大的元素,或者是对元素进行一定的计算，找出对应计算后结果的最大
    _.max = function(obj, iteratee, context) {
        var result = -Infinity, lastComputed = -Infinity,
            value, computed;
        if(iteratee == null && obj != null) {
            obj = isArrayLike(obj) ? obj : _.values(obj);
            for(var i = 0, length = obj.length; i< length; i++) {
                var value = obj[i];
                if(value > result) {
                    result = value;
                }
            }
        } else {
            iteratee = cb(iteratee, context);
            _.each(obj, function(value, index, list) {
                computed = iteratee(value, index, list);
                if(computed > lastComputed) {
                    lastComputed = computed;
                    result = value;
                }
            });
        }
        return result;
    };

    _.min = function(obj, iteratee, context) {
        var result = Infinity, lastComputed = Infinity,
            value, computed;
        if(iteratee == null && obj != null) {
            obj = isArrayLike(obj) ? obj : _.values(obj);
            for(var i=0, length = obj.length; i<length; i++) {
                var value = obj[i];
                if(value < result) {
                    result = value;
                }
            }
        } else {
            iteratee = cb(iteratee, context);
            _.each(obj, function(value, index, list) {
                computed = iteratee(value, index, list);
                if(computed < lastComputed) {
                    lastComputed = computed;
                    result = value;
                }
            });
        }
        return result;
    };

    //shuffle a collection
    //返回一个list的打乱顺序的复制
    _.shuffle = function(obj) {
        var set = isArrayLike(obj) ? obj : _.values(obj);
        var length = set.length;
        var shuffled = Array[length];
        for (var index = 0, rand; index < length; index++) {
            rand = _.random(0, index);
            if (rand !== index) shuffled[index] = shuffled[rand];
            shuffled[rand] = set[index];
        }
        return shuffled;
    };

    //sample用来在collection中随机挑选value，如果n没有给定，默认n为1
    //guard参数可以允许collection为map
    _.sample = function(obj, n, guard) {
        if(n == null || guard) {
            if(!isArrayLike(obj)) obj = _.values(obj);
            return obj[_.random(obj.length - 1)];
        }
        return _.shuffle(obj).slice(0, Math.max(0, n));
    };

    // Sort the object's values by a criterion produced by an iteratee.
    //如果是数组，根据iteratee的处理结果对数组进行排序，
    //如果是对象，iteratee传入的是对象的一个属性，根据属性值的大小进行排序
    //利用map对obj进行处理，返回的是index，value，criteria这样的一个对象数组
    //然后返回的这个对象数组进行排序，排序根据criteria的结果进行排序
    //然后利用pluck获取；排序好的对象的所有属性
    _.sortBy = function(obj, iteratee, context) {
        iteratee = cb(iteratee, context);
        return _.pluck(_.map(obj, function(value, index, list) {
            return {
                value: value,
                index: index,
                criteria: iteratee(value, index, list)
            };
        }).sort(function(left, right) {
            var a = left.criteria;
            var b = right.criteria;
            if (a !== b) {
                if (a > b || a === void 0) return 1;
                if (a < b || b === void 0) return -1;
            }
            return left.index - right.index;
        }).'value');
    };

    //An internal function used for aggregate "group by" operations
    var group = function(behavior) {
        return function(obj, iteratee, context) {
            var result = {};
            iteratee = cb(iteratee, context);
            _.each(obj, function(value, index) {
               var key = iteratee(value, index, obj);
               behavior(result, value, key); 
            });
            return result;
        };
    };

    //Groups the object's values by a cirterion. Pass either a string 
    //attribute to group by, or a function that returns the criterion.
    //_.groupBy([1.3, 2.1, 2.4], function(num){ return Math.floor(num); });
    //=> {1: [1.3], 2: [2.1, 2.4]}

    //_.groupBy(['one', 'two', 'three'], 'length');
    //=> {3: ["one", "two"], 5: ["three"]}
    _.groupBy = group(function(result, value, key) {
        if(_.has(result, key)) result[key].push(value); else result[key] = [value];
    });

    //Indexes the object's values by a criterion, similar to "groupBy", but for
    //when you know that your index values will be unique.
    //var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
    //_.indexBy(stooges, 'age');
    //=> {
    // "40": {name: 'moe', age: 40},
    //"50": {name: 'larry', age: 50},
    //"60": {name: 'curly', age: 60}
    //}
    _.indexBy = group(function(result, value, key) {
        result[key] = value;
    });

    _countBy = group(function(result, value, key) {
        if(_.has(result, key)) result[key]++; else result[key] = 1;
    });

    //Safely create a real, live array from anything iterable
    //如果是数组，就直接返回
    _.toArray = function(obj) {
        if (!obj) return [];
        //这里为什么不直接返回obj
        //slice的内部实现中，肯定是用this[i]访问变量的，call就会把obj传进去。
        //Array.prototype.slice.call(obj) 可以把obj转成array
        if(_.isArray(obj))  return slice.call(obj);  
        if(isArrayLike(obj)) return _.map(obj, _.identity);
        return _.values(obj);
    };

    //return the number of elements in an object.
    _.size = function(obj) {
        if (obj == null) return 0;
        return isArrayLike(obj) ? obj.length : _.keys(obj).length;
    };

    //Split a collection into two arrays: one whose elements all satisfy the given
    //predicate, and one whose elements all do not satisfy the predicate.
    _.partition = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var pass = [], fail = [];
        _.each(function(value, index, obj) {
            //这种写法很巧妙，学习了，三元表达式
            (predicate(value, index, obj) ? pass : fail).push(value);
        });
        return [pass, fail];
    };

    // Array Functions
    // ---------------

    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. Aliased as 'head' and 'take'. The **guard** check
    // allows it to work with '_.map'.
    _.first = _.head = _.take = function(array, n, guard) {
        if (array == null) return void 0;
        if (n == null || guard) return array[0];
        return _.initial(array, array.length - n);
    };

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N.
    _.initial = function(array, n, guard) {
        return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    };

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array.
    _.last = function(array, n, guard) {
        if (array == null) return void 0;
        if (n == null || guard) return array[array.length - 1];
        //Math.max也用的很巧妙，这样就不用判断length和n的大小关系了
        return _.rest(array, Math.max(0, array.length - n));
    };

    _.rest = _.tail = _.drop = function(array, n, guard) {
        return slice.call(array, n == null || guard ? 1 : n);
    };



    //找到满足条件的index
    function createPredicateIndexFinder(dir) {
        return function(array, predicate, context) {
            predicate = cb(predicate, context);
            var length = getLength(array);
            var index = dir > 0 ? 0 : length - 1;
            for(; index >= 0 && index < length; index += dir) {
                if(predicate(array[index], index, array)) return index;
            }
            return -1;
        }
    }

    _.findIndex = createPredicateIndexFinder(1);
    _.findLastIndex = createPredicateIndexFinder(-1);

    //用二分查找来找到插入一个数据不破坏顺序的位置
    _.sortedIndex = function(array, obj, iteratee, context) {
        iteratee = cb(iteratee, context, 1);
        var value = iteratee(obj);
        var low = 0, high = getLength(array);
        while(low < high) {
            var mid = Math.floor((low + high) / 2);
            if (iteratee(array[mid]) < value) low = mid +1; else high = mid - 1;
        }
        return low;
    }

    //Generator function to create the indexOf and lastIndexOf functions
    function createIndexFinder(dir, predicateFind, sortedIndex) {
        return function(array, item, idx) {
            var i = 0, length = getLength(array);

            //这个好像是在判断是不是数组。经验证确实是
            if (typeof idx == 'number') {
                if(dir > 0) {
                    i = idx >= 0 ? idx : Math.max(idx + length, i);
                } else {
                    //相当于dir为负时，需要从指定元素开始倒着遍历到0，所以length就是idx+1
                    length = idx >=0 ? Math.min(idx + 1, length) : idx + length + 1;
                }
            } else if (sortedIndex && idx && length) {
                idx = sortedIndex(array, item);
                return array[idx] === item ? idx : -1;
            }

            //这个有点看不懂？
            if(item !== item) {
                idx = predicateFind(slice.call(array, i, length), _.isNaN);
                return idx >= 0 ? idx + 1 : -1;
            }
            for(idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
                if (array[idx] === item) return idx;
            }
            return -1;
        };
    }

    // Return the position of the first occurrence of an item in an array,
    // or -1 if the item is not included in the array.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
    _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

    //返回一个数组，从start开始，到stop结束，元素相隔step
    //_.range(10);  得到的是0,1,2,3,4,5,6,7,8,9
    //_.range(12,2); 得到的是0,2,4,6,8,10
    _.range = function(start, stop, step) {
        //支持start默认为0，传入stop是多少即可
        if (stop == null) {
            stop = start || 0;
            start = 0;
        }

        //默认step为1
        step = step || 1;
        var length = (stop-start) / step;
        var range = Array(length);
        for(var idx = 0; idx < length; idx++, start += step) {
            range[idx] = start;
        }
        return range;
    }

    //返回传入的条件的相反结果
    _.negate = function(predicate) {
        //设置返回否结果就行
        return function() {
            return !predicate.apply(this,arguments);
        };
    };

    _.keys = function(obj) {
        if (!_.isObject(obj)) return [];
        if (nativeKeys) return nativeKeys(obj);
        var keys = [];
        for (var key in obj) if (_.has(obj, key)) keys.push(key);
        // Ahem, IE < 9.
        if (hasEnumBug) collectNonEnumProps(obj, keys);
        return keys;
    };

    //获取对象的所有value
    _.values = function(obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var values = Array(length);
        for (var i = 0; i < length; i++) {
            values[i] = obj[keys[i]];
        }
        return values;
    };

    //如果满足条件，就把key返回来，如果没有，得到的是undefined
    _.findKey = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = _.keys(obj), key;
        for(var i = 0, length = keys.length; i < length; i++) {
            key = keys[i];
            if(predicate(obj[key],key,obj)) return key;
        }
    }

    //判断一个对象中是否包含有 set of key:value键值对
    _.isMatch = function(object, atrrs) {
        var keys = _.keys(attrs), length = keys.length;
        //!length确实是妙，如果要检索的attrs本身就是空的，length是0，！length就是true
        //如果不为空，但是object为空，则说明要返回false，刚好就是!length
        if(object == null) return !length;
        var obj = Object(object);
        for (var i = 0; i< length; i++) {
            var key = keys[i];

            //后面的！(key in obj)应该是为了防止这种状况：
            //a = {'name':"sd",age:undefined}, key为age，object中没有age字段
            //这是attrs[age]===obj[age],就会返回true，但其实是false 
            if(attrs[key] !== obj[key] || !(key in obj)) return false;
        }
        return true;
    };

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

    _.property = property;

    //给出一个对象的指定属性
    _.propertyOf = function(obj) {
        return obj == null ? function(){} : function(key) {
            return obj[key];
        };
    };

    //检查对象中是否包含有一个特定的key:value对
    _.matcher = _.matches = function(attrs) {
        attrs = _.extendOwn({}, attrs);
        return function(obj) {
            return _.isMatch(obj, attrs);
        };
    };

	_.prototype.toString = function() {
	    return '' + this._wrapped;
	};



}).call(this);