
testing = function(what, fn) {
  // https://stackoverflow.com/questions/1068834/object-comparison-in-javascript
  function object_equals( x, y ) {
    if ( x === y ) return true;
    if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) return false;
    if ( x.constructor !== y.constructor ) return false;
    for ( var p in x ) {
      if ( ! x.hasOwnProperty( p ) ) continue;
      if ( ! y.hasOwnProperty( p ) ) return false;
      if ( x[ p ] === y[ p ] ) continue;
      
      if ( typeof( x[ p ] ) !== "object" ) return false;
      // Numbers, Strings, Functions, Booleans must be strictly equal

      if ( ! object_equals( x[ p ],  y[ p ] ) ) return false;
      // Objects and Arrays must be tested recursively
    }

    for ( p in y )
      if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) )
        return false;

    return true;
  }
  
  fn(function(actual, expected) {
    if(!Object.is(actual, expected)) {
      console.log("obs: ", actual , "≠", expected);
    }
  });
}

