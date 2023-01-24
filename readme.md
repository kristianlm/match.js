# match.js

match.js is a library for matching patterns against JavaScript
datastructures (mostly arrays). Conseptually similar to regular
expression matching, with greedy and lazy matchin for example.

Let's say you wanted to find out if the first element of an array
contains a `'prefix'` string value. Without any libraries, that'd be
something like this:

    if(x && x.length>=1 && x[0] === 'prefix') {...}

This library tries to make things like that prettier:

    ['prefix', greedy()]

