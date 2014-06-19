var dq = require("../decorquest");
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