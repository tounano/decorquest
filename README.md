# decorquest

Decorators for Node's core request modules, to extend it's functionality.

## rant

I'll start with a rant as [substack](https://github.com/substack) did in [hyperquest](https://github.com/substack/hyperquest).

[request](https://github.com/mikeal/request) is the most popular module for doing http requests and web scraping.
My biggest problem with this module is that it tries to take care of everything related to http requests.

This fact yields to a codebase with several thousands lines of code. It violates SOLID principles. It's not extandable.
And it full of bugs.

If you're doing an http request here and there, you should use [request](https://github.com/mikeal/request).

However, if you're doing massive web scraping, or just doing several hundred API request, [request](https://github.com/mikeal/request)
would broke. And it will break your app.

Trust me...

The smallest error caused my CPU to spin.

[hyperquest](https://github.com/substack/hyperquest) on the other hand, is scalable. It can handle big amount of requests.
However, it lacks on extensibility. I was using [hyperquest](https://github.com/substack/hyperquest) until I had a need
to add some extensions. I was able to write 2 modules that can extend [hyperquest](https://github.com/substack/hyperquest),
however I couldn't achieve connection tunneling.

And that was my motive to write `decorquest`.

## How it works?

In my point of view, node modules should be super small. Node modules should be extensible and allow others to extend them.

That's how `decorquest` works. It follows the `decorator design pattern`, with some adaptations for node.
This module contains several small components to extend Node's `http/https.request` functionality on demand.

## Components

### request

This is the basic request function. It follows the API of Node's http/https request. And the only thing it does, is to
choose between `http` or `https` for request.

In order to make an https request, you must have `{'protocol': 'https:'}` in `opts`. The semicolon is on purpose so that
you'll be able to pass `url.parse("https://some-https-url.com") as options.

### disableGlobalAgent

This is a decorator for the core request. It's goal is to disable `http.globalAgent` if no `agent` was specified. If you
do specify an `agent` in ops, it will work as the core module.

Usage:

``` js
var url = require("url");
var dq = require("decorquest");
var request = dq.disableGlobalAgent(dq.request);

var r = request(url.parse("http://www.bing.com"), function (res) {
  res.pipe(process.stdout);
}
r.end();
```

### attachAuthorizationHeaders

This decorator attaches the `Authorization` header if `auth` is present in opts.

Usage:

``` js
var url = require("url");
var dq = require("decorquest");
var request = dq.attachAuthorizationHeaders(dq.disableGlobalAgent(dq.request));

var r = request(url.parse("http://user:pass@somedomain.com"), function (res) {
  res.pipe(process.stdout);
}
r.end();
```

### cookiequest

This decorators takes care of cookies if `jar` is present in opts. It will store cookies in the `CookieJar` and will send
the stored cookies in followup requests.

If the `jar` property is set to `true`, it will use a global jar that is attached to this decorator. If you want to use a
different CookieJar for every request, you can attach a `CookieJar` object that is provided by `cookiejar` module.

Example with the default CookieJar:

``` js
var url = require("url");
var dq = require("decorquest");
var request = cookiequest(dq.attachAuthorizationHeaders(dq.disableGlobalAgent(dq.request)));

var opts = url.parse("http://www.bing.com");
opts.jar = true;

var r = request(opts, function (res) {
  res.pipe(process.stdout);
}
r.end();
```

Example with a `CookieJar` object:

``` js
var url = require("url");
var dq = require("decorquest");
var request = cookiequest(dq.attachAuthorizationHeaders(dq.disableGlobalAgent(dq.request)));

var cookiejar = new (require("cookiejar").CookieJar)();

var opts = url.parse("http://www.bing.com");
opts.jar = cookiejar;

var r = request(opts, function (res) {
  res.pipe(process.stdout);
}
r.end();
```

### proxyquest

This decorator brings the functionality of using `http` proxy over `http` request. It will passthrough all requests with
different protocols. In order to use it, you have to specify `proxy` in `opts`.

Usage:

``` js
var url = require("url");
var dq = require("decorquest");
var request = proxyquest(cookiequest(dq.attachAuthorizationHeaders(dq.disableGlobalAgent(dq.request))));

var opts = url.parse("http://www.bing.com");
opts.jar = true;
opts.proxy = 'http://1:1@127.0.0.1:8888'; // This is Fiddler with Fiddler's default `auth`

var r = request(opts, function (res) {
  res.pipe(process.stdout);
}
r.end();
```

### tunnelquest

This decorator completes `proxyquest`. If you want to scrape `https` urls over `http` proxy, this component is for you.

tunnelquest uses the `tunnel` module. It will override the `agent` in opts to the tunneling agent provided by `tunnel`.

This module will passthrough in case `proxy` wasn't specified or `protocol` isn't `https:`.

Usage:

``` js
var url = require("url");
var dq = require("decorquest");
var request = tunnelquest(proxyquest(cookiequest(dq.attachAuthorizationHeaders(dq.disableGlobalAgent(dq.request)))));

var opts = url.parse("https://www.bing.com"); // The scheme is HTTPS.
opts.jar = true;
opts.proxy = 'http://1:1@127.0.0.1:8888'; // This is Fiddler with Fiddler's default `auth`

var r = request(opts, function (res) {
  res.pipe(process.stdout);
}
r.end();
```

### timeoutquest

This decorator will emit an `ETIMEDOUT` error, and will abort the request. The timeout option is at `opts.responseTimeout`.

Usage:

```js
var http = require("http");
var url = require("url");
var dq = require("decorquest");
var request = dq.timeoutquest(dq.request);

var server = http.createServer(function (req, res) {
  setTimeout( function () {
    res.write("hello world" + '\n');
    res.end();
  }, 3000);
});


server.listen(5000, function () {
  var opts = url.parse("http://localhost:5000/");
  opts.responseTimeout = 1000;
  var r = request(opts);
  r.end();
  r.on('response', function (res) {
    res.pipe(process.stdout);
    res.on('end', function () {
      server.close();
    });
  });

  r.on('error', function (err) {
    console.error(err);
  })

  r.on('close', function () {
    server.close();
  })
})

```

## Final example

``` js
var dq = require("decorquest");
var url = require("url")
var request = dq.proxyquest(dq.disableGlobalAgent(dq.cookiequest(dq.request)));

// Let's create a request DTO
var opts = url.parse("http://www.bing.com");

// Instruct `cookiequest` to use the default Cookie Jar
opts.jar = true;

// Setting my Fiddler proxy. Comment out this line if you're not using fiddler.
opts.proxy = "http://127.0.0.1:8888";

// Let's make a request to bing....
var r = request(opts, function (res) {
  console.log("The cookies that Bing sets\n", res.headers['set-cookie']);

  // Let's make another request
  var r2 = request(opts, function(res) {
    console.log("\n\nHere are the headers that we're sending Bing on the second request\n", res.req._headers);
  });
  r2.end();
});
r.end();
```

## How to write your own decorators

Let's create a useful decorator. Let's call it `errorquest`. It will help us with error handling and debugging using
Node's `domains`.

``` js
var dq = require("../decorquest");
var url = require("url")

/*
  This decorator will help us with Error Handling. It will use Node's error handling with `domains` functionality.
 */
function errorquest(request) {
  return function(opts, cb) {
    // Let's passthrough if it doesn't have the `_domain` property
    if (!opts._domain) return request(opts, cb);

    var d = opts._domain;
    var r = request(opts, cb);

    // Let's add the Request object to the domain.
    d.add(r);

    // Let's detach it when the request object ends or got closed
    r.on("end", function () { d.remove(r); });
    r.on("close", function () { d.remove(r); });

    // Let's bind to it's socket as well
    r.on("socket", function (socket) {
      d.add(socket);

      // Remove it when it's done
      socket.on("end", function () { d.remove(socket); });
      socket.on("close", function () { d.remove(socket); });
    });

    return r;
  }
}

// Create the request object
var request = errorquest(dq.proxyquest(dq.disableGlobalAgent(dq.cookiequest(dq.request))));

// Create the domain
var d = require("domain").create();

// Let's see what errors we'll get
d.on("error", function (err) {
  console.log(err.stack);
})

// Make a request that will fail
var opts = url.parse("http://this-domain-will-fail.js");
opts._domain = d;

// Action!!!
var r = request(opts, function () {
  //Nothing to do here
});
r.end();

// And we get:
/*
 Error: getaddrinfo ENOTFOUND
 at errnoException (dns.js:37:11)
 at Object.onanswer [as oncomplete] (dns.js:124:16)
 */
```

## install

With [npm](https://npmjs.org) do:

```
npm install decorquest
```

## license

MIT
