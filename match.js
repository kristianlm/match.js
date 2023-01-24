/// -*- js-indent-level: 2 -*-
/// match specs in Vanilla JavaScript
///
/// I looked at `npm install z` but it doesn't support greedy/lazy
/// repeat matching, and it seems quite inflexible compared to this
/// approach.

/// match.js is a library for matching patterns against JavaScript
/// data-structures (primarily arrays at this point).
///
/// Let us say you wanted to check if a value (x) has this form
/// (... means any number of subsequent values, possibly 0):
///
///    ['prefix', ...]
///
/// And in code that becomes something like:
///
///    if(x && x.length>=1 && x[0] === 'prefix') {...}
///
/// Or consider this:
///
///    [..., 'postfix']
///
/// if(x && x.length>=1 && x[x.length-1]==='postfix') {...}
///
/// Or let's say you wanted to test against nested structures like this:
///
///    ['and', ['==', 'username', (any string)], ...]
///
///    if(x && x.length>=2 && x[0] === 'and' && x[1] && x[1].length===3 && x[1][0]==='=='&&x[1][1]==='username' && typeof(x[1][2])==='string') {...}
///
/// This library tries to make this more manageable. These checks now look like this:
///
///    ['prefix', ...]   => ['prefix', greedy()]
///    [..., 'postfix']  => [greedy(), 'postfix']
///    ['and', ['==', 'username', (any string)], ...] => ['and', ['==', 'username', string()], greedy()]
///
/// You can also name parts (named groups in regex-terminology) using
/// `name`. For example:
///
///   let mMiddle = match(['a', name('middle', any()), 'c']);
///   let m = mMiddle(['a', 'B', 'c']);
///   if(m) { console.log('middle is: ' + m.middle); }
///
/// The API actual code, we wrap the pattern in match() which returns
/// a "predicate" (mMiddle above). The predicate is a function which
/// returns either false (for no match found) or an object (when a
/// match is found). When a match is found, you can use the returned
/// match object to retrieve named parts (like `m.middle` above)
///
/// You may recognize that if we pretend that strings are arrays of
/// characters, this library has a lot in common with regular
/// expressions. any() is . and greedy() is *. Here are some examples:
///
///     abc           => ['a', 'b', 'c']
///     a.c           => ['a', any(), 'c']
///     a(b|B)c       => ['a', or('b', 'B'), 'c']
///     abc.*         => ['a', 'b', 'c', greedy()]  ,---  any() is greedy's default predicate
///     abc.*         => ['a', 'b', 'c', greedy(any())]
///     a(b|B)*       => ['a', greedy(or('b', 'B'))]
///     a(b|B)*       => ['a', greedy(or('b', 'B'))]
///     a(b|B){2,3}   => ['a', greedy(or('b', 'B'), 2, 3)]
///     (?<year>[0-9]{4})-(?<month>[0-9]{2})  =>  [name('year', greedy(number, 4, 4)), '-', name('month', greedy(number, 2, 2))]
///
/// You can try this in your devconsole:
///
/// > dateFormatIsOk=match([name('year', greedy(number, 4, 4)), '-', name('month', greedy(number, 2, 2))])
/// ƒ (x, j) {...}
///
/// match returns a function which you can call with the object to
/// match against as its sole argument., like this:
///
/// > dateFormatIsOk([2,0,2,1,'-',0,4])
/// {"year":[2,0,2,1],"month":[0,4]}
///
/// Note that the example above deals with strings only to illustrate
/// the similarities, you shouldn't use this library if your data is
/// all strings (then you should parse it into a structure or use
/// regex). The intended use case for this library is for highly
/// nested arrays, like this:
///
///       ['and',
///        ['<=', 'year', 2000],
///        [ '>', 'year', 1990],
///        ['or',
///         ['==', 'username', 'guest'],
///         ['==', 'username', 'anonymous']]]
///
/// I'm afraid you'll have to see the test suite for more usage
/// examples.
///
/// ============================================================


// conveniently wrap literals into function so that you can write
// [1,2,[3]] instead of lst(is(1),is(2),lst(is(3))).
function match(p,_) {
  if(p === any)                     { return any(); } // so you don't have to call it everywhere
  else if(typeof(p) === 'function') { return p; }
  else if(Array.isArray(p))         { return lst.apply(null, p); }
  else                              { return is(p); }
}

// used internally. convenience that attaches type and ensures j is
// set.
function matchable(p, type) {
  let result = function(x, j) {
    if(typeof(j) === 'undefined') j = {};
    return p(x, j);
  };
  if(type) result.type = type;
  return result;
}

function lst(...ps) {

  // trying to make repeat management slightly more comprihensible by
  // grouping non-repeat() and repeat() together. a chunk if either a
  // single repeat() or a list of non-repeat literals.
  //
  // chunkify([1,2,3,'a',5,6,'x',8], e=>typeof(e)==='string');
  // ==> [[1,2,3],"a",[5,6],"x",[8]]
  function chunkify(list, pred) {
    let fx = [];
    let result = [];
    for(let i = 0 ; i < list.length ; i++) {
      let e = list[i];
      if(!pred(e)) fx.push(e);
      else {
        if(fx.length) result.push(fx);
        fx = [];
        result.push(e);
      }
    }
    if(fx.length) result.push(fx);
    return result;
  }

  ps = ps.map(match);

  let chunks = chunkify(ps, e=>e&&(e.type===greedy||e.type===lazy));

  let predicate = function(x, j) {
    function submatch(ci, xi) {
      //console.log('submatch pattern:', chunks.map(x=>(x.binding&&x.type.name+':'+x.binding)||x.length), 'ci='+ci,'xi='+xi, 'x=', x);
      if(ci >= chunks.length && xi >= x.length) {
        return j; // no chunks left, no data left, I call that great success
      }
      else if(ci >= chunks.length) {
        return false; // more data left but no chunks left
        return false; // more data left but no chunks left
      }
      let chunk = chunks[ci];

      if(chunk.type === greedy) {
        let fixlength = 0; // we know remaining parts must be at least this big (TODO: precalculate it?)
        for(let c = ci+1 ; c < chunks.length ; c++) { // can't go wrong with C++
          if(chunks[ci].type !== greedy && chunks[ci].type !== lazy && chunks[ci+1].length) {
            fixlength += chunks[ci+1].length;
          } // TODO: add sizes of repeat minimum match size
        }
        for(let replength = x.length - xi - fixlength ; replength >= 0 ; replength--) {
          if(chunk(x.slice(xi, xi+replength), j) && submatch(ci+1, xi+replength)) {
            return j;
          }
        }
        return false;
      }
      else if(chunk.type === lazy) {
        let fixlength = x.length; // we know remaining parts cannot be bigger than fixlength
        //                                 ,-- we always want to try the zeroth replength
        for(let replength = 0 ; replength <= fixlength ; replength++) {
          if(chunk(x.slice(xi, xi+replength), j) && submatch(ci+1, xi+replength)) {
            return j;
          }
        }
        return false;
      }
      else { // eg chunk=[1,2] x=[1,2,3]
        let chunklen = chunk.length;
        let datalen = x.length-xi;
        if(chunklen > datalen) {
          return false;
        }
        for(let c = 0 ; c < chunk.length ; c++) {
          if(!chunk[c](x[c+xi], j)) return false;
        }
        return submatch(ci+1, xi+chunklen);
      }
    };
    return submatch(0, 0);
  };

  return matchable(function(x, j) {
    if(Array.isArray(x)) { return predicate(x, j); }
    return false;
  }, lst);
}

function any() {
  return matchable(function(x, j) {return j;}, any);
}

function is(object) {
  return matchable(function(x, j) {
    if(x === object) return j;
    return false;
  }, is);
}

function number()  { return matchable(function(x, j) { return (typeof(x) === 'number')  ? j : false; }, number); }
function string()  { return matchable(function(x, j) { return (typeof(x) === 'string')  ? j : false; }, string); }
function boolean() { return matchable(function(x, j) { return (typeof(x) === 'boolean') ? j : false; }, boolean); }

function or(...args) {
  args = args.map(match);
  return matchable(function(x, j) {
    for(let i = 0 ; i < args.length ; i++) {
      if(args[i](x, j)) return j;
    }
    return false;
  }, or);
}

function name(str, p) {
  if(typeof(p) === 'undefined') p = any();
  p = match(p);
  let m = matchable(function(x, j) {
    if(p(x, j)) {
      j[str] = x;
      return j;
    }
    else {
      return false;
    }
  }, p.type); // <-- naming something does not alter its semantics
  m.binding = str;
  return m;
}

// test if x is list and p is satisfied in all its elements
function repeat(p, min, max) {
  if(typeof(p) === 'undefined') p = any();
  if(typeof(min) === 'undefined') {
    if(typeof(max) === 'undefined') {
      min = false;
      max = false;
    } else {
      console.error('repeat pattern must contain either both min and max or neither. got:', min, max);
      return 'repeat pattern error min/max';
    }
  }

  p = match(p);
  return matchable(function(x, j) {
    if(Array.isArray(x)) {
      if(min !== false && x.length < min) return false;
      if(max !== false && x.length > max) return false;
      for(let i = 0 ; i < x.length ; i++) {
        if(!p(x[i], j)) return false;
      }
      return j;
    } else {
      return false;
    }
  }, repeat); // other predicates will need to identify special repeat predicates
}

function lazy(p, min, max) {
  p = repeat(p, min, max);
  return matchable(p, lazy);
}

function greedy(p, min, max) {
  p = repeat(p, min, max);
  return matchable(p, greedy);
}

testing("match", function(check) {
  // TODO: test that failed binding aren't left behind.
  check(match(is('x')) ('x'),               {});
  check(match(name('abba', is('x'))) ('x'), {abba: 'x'});
  check(match(is('x')) ('y'), false);

  check(match(is(10)) (10), {});
  check(match(is(10)) (00), false);

  check(match(name('A', is(1))) (1), {A:1});
  check(match(name('A', is(1))) (0), false);
  check(match(name('A', is(1))) (0), false);

  check(match(name('A'))  (1),  {A:1});
  check(match(name('A')) ('x'), {A:'x'});

  check(match(any) (1), {}, "any optional call");
  check(match(any()) (1), {}, "any optional call");
  // repeat
  check(match(repeat(is('x'))) ([]), {});
  check(match(repeat(is('x'))) (['x']), {});
  check(match(repeat(is('x'))) (['x', 'x']), {});
  check(match(repeat(is('x'))) (['y', 'x']), false);
  // repeat with         min--⹁  ,-- max
  check(match(repeat(is('x'), 0, 1)) ([]), {});
  check(match(repeat(is('x'), 0, 1)) (['x']), {});
  check(match(repeat(is('x'), 0, 1)) (['x','x']), false);
  check(match(repeat(is('x'), 1, 2)) ([]), false);
  check(match(repeat(is('x'), 1, 2)) (['x']), {});
  check(match(repeat(is('x'), 1, 2)) (['x','x']), {});
  check(match(repeat(is('x'), 1, 2)) (['x','x','x']), false);

  check(match(name('A', repeat(is('x')))) (['x', 'x']), {A:['x', 'x']});

  check(match(repeat(any)) ([]), {});
  check(match(repeat(any)) ([1]), {});
  check(match(repeat(any)) ([1, 2]), {});
  check(match(repeat(any)) ([1, 2, 'x']), {});
  check(match(repeat())    ([1, 2, 'x']), {}, "any argument optional");

  check(match(lst())    ([]), {});
  check(match(lst())    (['a']), false);
  check(match(lst('a')) ([]), false);
  check(match(lst('a')) (['a']), {});
  check(match(lst('a')) (['a', 'a']), false);

  check(match([])    ([]), {});
  check(match(['a']) ([]), false);
  check(match(['a']) (['a']), {});
  check(match(['a']) (['a', 'a']), false);

  check(match(['a', 'b']) ([]), false);
  check(match(['a', 'b']) (['a']), false);
  check(match(['a', 'b']) (['a', 'b']), {});

  check(match([name('A', 'a')]) (['a']), {A:'a'});
  check(match([name('A', 'a')]) (['b']), false);

  // greedy (repeat inside arrays)
  check(match([greedy()])     ([]), {});
  // [..., "postfix"]
  check(match([greedy(), 1])     ([]), false);
  check(match([greedy(), 1])     ([2]), false);
  check(match([greedy(), 1])     ([1, 2]), false);
  check(match([greedy(), 1, 2])  ([]), false);
  check(match([greedy(), 1, 2])  ([3]), false);
  check(match([greedy(), 1, 2])  ([2, 3]), false);
  check(match([greedy(), 1, 2])  ([1, 2, 3]), false);
  check(match([greedy(), 1]) ([1]), {});
  check(match([greedy(), 1]) ([2, 1]), {});
  check(match([greedy(), 1]) ([3, 2, 1]), {});
  check(match([greedy(), 1, 2]) ([1, 2]), {});
  check(match([greedy(), 1, 2]) ([3, 1, 2]), {});
  check(match([greedy(), 1, 2]) ([4, 3, 1, 2]), {});
  // ["prefix", ...]
  check(match([1, name('A', greedy())]) ([]), false);
  check(match([1, name('A', greedy())]) ([2]), false);
  check(match([1, name('A', greedy())]) ([1, 2]), {A:[2]});
  check(match([1, name('A', greedy())]) ([1, 2, 3]), {A:[2, 3]});
  check(match([1, 2, name('A', greedy())]) ([]), false);
  check(match([1, 2, name('A', greedy())]) ([1]), false);
  check(match([1, 2, name('A', greedy())]) ([1, 2]), {A:[]});
  check(match([1, 2, name('A', greedy())]) ([1, 2, 3]), {A:[3]});
  // ["start", ..., "end"]
  check(match([1, name('A', greedy()), 2]) ([]), false);
  check(match([1, name('A', greedy()), 2]) ([1,2]), {A:[]});
  check(match([1, name('A', greedy()), 2]) ([1,3,2]), {A:[3]});
  check(match([1, name('A', greedy()), 2]) ([1,3,4,2]), {A:[3,4]});
  check(match([1, name('A', greedy()), 2]) ([8,1,3,4,2]), false);
  check(match([1, name('A', greedy()), 2]) ([1,3,4,2,8]), false);
  check(match([1,2, name('A', greedy()), 3,4]) ([]), false);
  check(match([1,2, name('A', greedy()), 3,4]) ([1,2]), false);
  check(match([1,2, name('A', greedy()), 3,4]) ([1,2,3]), false);
  check(match([1,2, name('A', greedy()), 3,4]) ([1,2,3,4]), {A:[]});
  check(match([1,2, name('A', greedy()), 3,4]) ([1,2,0,3,4]), {A:[0]});
  check(match([1,2, name('A', greedy()), 3,4]) ([1,2,5,6,3,4]), {A:[5,6]});
  check(match([1,2, name('A', greedy()), 3,4]) ([0,1,2,3,4]), false);
  check(match([1,2, name('A', greedy()), 3,4]) ([1,2,3,4,0]), false);
  // [..., "mid", ...]
  check(match([name('A', greedy()), 2, name('B',greedy())]) ([]), false);
  check(match([name('A', greedy()), 2, name('B',greedy())]) ([2]), {A:[],B:[]});
  check(match([name('A', greedy()), 2, name('B',greedy())]) ([1,2]), {A:[1],B:[]});
  check(match([name('A', greedy()), 2, name('B',greedy())]) ([2,1]), {A:[],B:[1]});
  check(match([name('A', greedy()), 3,4, name('B',greedy())]) ([]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy())]) ([3]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy())]) ([4]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy())]) ([3,4]), {A:[],B:[]});
  check(match([name('A', greedy()), 3,4, name('B',greedy())]) ([1,3,4]), {A:[1],B:[]});
  check(match([name('A', greedy()), 3,4, name('B',greedy())]) ([3,4,1]), {A:[],B:[1]});
  check(match([name('A', greedy()), 3,4, name('B',greedy())]) ([1,3,4,2]), {A:[1],B:[2]});
  // [..., "first", ..., "second"]
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([3]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([4]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([7]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([8]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([3,4]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([3,4,7]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([3,4,8]), false);
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([3,4,7,8]), {A:[],B:[]});
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([0,3,4,7,8]), {A:[0],B:[]});
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([3,4,0,7,8]), {A:[],B:[0]});
  check(match([name('A', greedy()), 3,4, name('B',greedy()), 7,8]) ([1,2,3,4,5,6,7,8]), {A:[1,2],B:[5,6]});
  // ["start", ..., "middle", ..., "end"]
  check(match([0,1,name('A', greedy()), 4,5, name('B',greedy()), 8,9]) ([]), false);
  check(match([0,1,name('A', greedy()), 4,5, name('B',greedy()), 8,9]) ([0,1,4,5,8,9]), {A:[],B:[]});
  check(match([0,1,name('A', greedy()), 4,5, name('B',greedy()), 8,9]) ([0,1, 2,3, 4,5, 6,7, 8,9]), {A:[2,3],B:[6,7]});

  check(match(['a',name('A',greedy(any, 1, 2)),'b',name('B',greedy(any, 1, 2)),'c']) ([]), false);
  check(match(['a',name('A',greedy(any, 1, 2)),'b',name('B',greedy(any, 1, 2)),'c']) (['a']), false);
  check(match(['a',name('A',greedy(any, 1, 2)),'b',name('B',greedy(any, 1, 2)),'c']) (['a','b']), false);
  check(match(['a',name('A',greedy(any, 1, 2)),'b',name('B',greedy(any, 1, 2)),'c']) (['a','b','c']), false);
  check(match(['a',name('A',greedy(any, 1, 2)),'b',name('B',greedy(any, 1, 2)),'c']) (['a',1,'b','c']), false);
  check(match(['a',name('A',greedy(any, 1, 2)),'b',name('B',greedy(any, 1, 2)),'c']) (['a',1,'b',2,'c']), {A:[1],B:[2]});
  check(match(['a',name('A',greedy(any, 1, 2)),'b',name('B',greedy(any, 1, 2)),'c']) (['a',1,2,'b',3,4,'c']), {A:[1,2],B:[3,4]});
  check(match(['a',name('A',greedy(any, 1, 2)),'b',name('B',greedy(any, 1, 2)),'c']) (['a',1,2,3,'b',4,5,6,'c']), false);
  // lazy vs greedy ["start", ..., ...]
  check(match([name('A',greedy()),name('B',greedy(2))]) ([]),      {A:[],     B:[]});
  check(match([name('A',greedy()),name('B',greedy(2))]) ([1]),     {A:[1],    B:[]});
  check(match([name('A',greedy()),name('B',greedy(2))]) ([1,2]),   {A:[1,2],  B:[]});
  check(match([name('A',greedy()),name('B',greedy(2))]) ([1,2,2]), {A:[1,2,2],B:[]});
  check(match([name('A',greedy()),name('B',greedy(2))]) ([1,2,3]), {A:[1,2,3],B:[]});
  check(match([name('A',  lazy()),name('B',greedy(2))]) ([]),      {A:[],     B:[]});
  check(match([name('A',  lazy()),name('B',greedy(2))]) ([1]),     {A:[1],    B:[]});
  check(match([name('A',  lazy()),name('B',greedy(2))]) ([1,2]),   {A:[1],    B:[2]});
  check(match([name('A',  lazy()),name('B',greedy(2))]) ([1,2,2]), {A:[1],    B:[2,2]});
  check(match([name('A',  lazy()),name('B',greedy(2))]) ([1,2,3]), {A:[1,2,3],B:[]});
  // scope and nesting bindings
  check(match([1, [2, name('A', greedy())           ]]) ([1, [2, 3]]), {A:[3]});
  check(match([1, [2, name('A', lazy()),   greedy(3)]]) ([1, [2, 3]]), {A:[]});
  check(match([1, [2, name('A', lazy()),   greedy(0)]]) ([1, [2, 3]]), {A:[3]});
  check(match([1, [2, name('A', lazy()),   greedy(0)]]) ([1, [2, 3]]), {A:[3]});
});


// clauses goes [match,function,  match,function,  match,function  ...]
function select(x, clauses, fallback) {
  if(clauses.length % 2 !== 0) throw new Error('number of clauses is not even');
  for(let i = 0 ; i < clauses.length ; i+=2) {
    let match = clauses[i];
    let func  = clauses[i+1];
    let m = match(x);
    if(m) return func(m);
  }
  return fallback ? fallback(x) : false;
}

testing("select", function(check) {
  check(select(1, [match(1),m=>'ok']), 'ok');
  check(select(0, [match(1),m=>'ok']), false);
  check(select(0, [match(1),m=>'not ok',  match(0),m=>'ok']), 'ok');
  check(select(2, [match(1),m=>'not ok',  match(0),m=>'ok']), false);
  check(select(0, [match(1),m=>'not ok',  match(0),m=>'ok'],  x=>'fallback'), 'ok');
  check(select(2, [match(1),m=>'not ok',  match(0),m=>'ok'],  x=>'fallback'), 'fallback');
});
