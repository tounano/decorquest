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