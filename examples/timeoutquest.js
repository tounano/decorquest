var http = require("http");
var url = require("url");
var dq = require("../");
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
