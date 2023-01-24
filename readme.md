# match.js

match.js is a library for matching patterns against JavaScript
data-structures (mostly arrays). Conceptually similar to regular
expression matching, with greedy and lazy matching for example.

Let's say you had an array that looked something like this:

```js
['prefix', … tail]
```

And that you wanted to find out if the first element of an array was
the string `'prefix'`, and you wanted easy access to `tail`. Without
any libraries, that'd be something like this:

```js
if(x && x.length>=1 && x[0] === 'prefix') {
   let tail = x.slice(1);
   …
}
```

This library tries to make code that looks like that
prettier. Data-structures like these might be common when you're
working with
[AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree)s and that
has been the main focus so far.

## Usage

General usage typically looks like this:

```js
p = match( ['prefix', greedy()] );
```

Where the argument to `match` is a pattern. `match` returns a
_predicate_, a function with the object to match against as its sole
argument. This, in turn, returns either false (for no match found) or
an object (when a match is found). When a match is found, you can use
the returned match object to retrieve named parts:

```js
p = match( ['prefix', name('tail', greedy()) ] );
m = p(['prefix', 'second', 'third', 4]);
console.log('prefix was followed by ' + m.tail);
// => prefix was followed by second,third,4
```

### Patterns

You may recognize that if we pretend that strings are arrays of
characters, this library has a lot in common with regular
expressions. `any()` is `.` and
[`greedy()`](https://en.wikipedia.org/wiki/Regular_expression#Lazy_matching)
is `*`. For those already familiar with the very common POSIX regular
expression
[syntax](https://en.wikipedia.org/wiki/Regular_expression#POSIX) let's
get you started quickly:

```js
abc           => ['a', 'b', 'c']
a.c           => ['a', any(), 'c']
a(b|B)c       => ['a', or('b', 'B'), 'c']
abc.*         => ['a', 'b', 'c', greedy()]  ,---  any() is greedy's default predicate
abc.*         => ['a', 'b', 'c', greedy(any())]
a(b|B)*       => ['a', greedy(or('b', 'B'))]
a(b|B)*       => ['a', greedy(or('b', 'B'))]
ab?c          => ['a', greedy('b', 0, 1), 'c']
a(b|B){2,3}c  => ['a', greedy(or('b', 'B'), 2, 3), 'c']
(?<year>[0-9]{4})-(?<month>[0-9]{2})  =>  [name('year', greedy(number, 4, 4)), '-', name('month', greedy(number, 2, 2))]
```

### Example

Let's say you had a web-site for entering SQL queries and showing their
results in an HTML table. Now you want to allow users to click on the
column headings to re-order the table by that column.

Let's say that you wanted to integrate this with the original SQL
query, such that the query would be updated with an `ORDER BY` clause
correctly based on column that was clicked on.

Let us assume that the SQL string could be parsed into a meaningful
AST (and back). Let it be an array of arrays, prefix-style, like this:

```js
let ast = sql_parse("SELECT * FROM table LIMIT 10");
// => ['select', '*', 'table', ['limit', 10]];
ast[2] = 'customers';
console.log(sql_unparse(ast));
// => SELECT * FROM customers LIMIT 10
```

Even with this SQL parsing in place, the task is still relatively
complex:

- The column clicked on must now be the first order-by clause.
- The query could and could not contain a `LIMIT` clause.
- If the query does not contain `ORDER` clauses, it must be introduced.
- If the query contains `ORDER` clauses, it must be updated to reflect the new changes.
- If present, the `ORDER` clause is positioned
  [before](https://sqlite.org/lang_select.html) any `LIMIT` clause.
- The existing `ORDER` clauses must still be honored.
- If the column clicked on already has an `ORDER` clause, its
  direction should be toggled (`ASC` / `DESC`).

Below is a `reorder` function implemented using this library that
tries to address all of the above. It accepts an `ast` and a new
`column` to toggle the order of.

```js
reorder = (function() {
  // "precompile" predicate for, hopefully, slightly faster execution
  let p = match(['select',
                 name('columns', any()),                           // required
                 name('table', string()),                          // required
                 greedy(['where', name('where', greedy())], 0, 1), // optional
                 greedy(['order', name('order', greedy())], 0, 1), // optional
                 greedy(['limit', name('limit', number())], 0, 1)  // optional
                ]);
  return function(ast, column) {
    let m = p(ast); // extract match / model
    if(!m.order) m.order = []; // consistently an array
    // pattern for order clauses that specifies our 'column':
    let p_column_order = match([name('direction', any()), column]);
     // find existing order clause for 'column' (if any):
    let column_order = m.order.map(x=>p_column_order(x)).find(x=>x);
    let descending = (column_order||[]).direction === 'asc';
    m.order = [[descending ? 'desc' : 'asc', column],
               // keep all other order clauses:
               ... m.order.filter(e => !p_column_order(e))];
    // reconstruct AST:
    return ['select', m.columns, m.table,
            ... m.where ? [['where', ... m.where]] : [],
            ... m.order ? [['order', ... m.order]] : [],
            ... m.limit ? [['limit',     m.limit]] : []
           ];
  };
})();
```

Let's see it in action:

```js
ast = ['select', '*', 'table', ['limit', 10]];
// sort ascending by name, introducing an 'order' section
ast = reorder(ast, 'name');
['select', '*', 'table',
  [ 'order', [ 'asc', 'name' ] ],
  [ 'limit', 10 ] ]

// now sort by age first, then name
> ast = reorder(ast, 'age');
['select', '*', 'table',
  [ 'order', [ 'asc', 'age' ], [ 'asc', 'name' ] ],
  [ 'limit', 10 ]]

// toggle sort order of name and still sorting by age
> ast = reorder(ast, 'name');
['select', '*', 'table',
  [ 'order', [ 'desc', 'name' ], [ 'asc', 'age' ] ],
  [ 'limit', 10 ]]

// a slightly bigger query
> reorder(['select', '*', 'table',
            ['where', ['>', 'age', 12]],
            ['limit', 4]],
          'name');
['select', '*', 'table',
  [ 'where', [ '>', 'age', 12 ] ],
  [ 'order', [ 'asc', 'name' ] ],     // <-- voilà!
  [ 'limit', 4 ]]
```

## Goals of this library

This library tries to be small (~200 lines with comments + tests as of
writing) with few dependencies, and directly `<script src="…">`'able
into your browser without any build steps. It does not try to be
fast. It is self contained with embedded tests.

## State

Alpha, at best. This library has not been used in production.

### TODO

- Wrap it into a JavaScript nodejs module (don't expose all the globals)
- Document all the functions better
- Combine "rewriting" of the data-structure in the matching phase?
