var http = require("http");
var https = require("https");
var url = require("url")
var _ = require("underscore");

module.exports = {
  request: request,
  disableGlobalAgent: disableGlobalAgent,
  attachAuthorizationHeader: attachAuthorizationHeader,
  cookiequest: cookiequest,
  proxyquest: proxyquest,
  tunnelquest: tunnelquest,
  timeoutquest: timeoutquest
}

function request(opts, cb) {
  var iface = opts.protocol == "https:" ? https : http;

  return iface.request(_.clone(opts), cb);
}

function disableGlobalAgent(request) {
  return function(opts, cb) {
    opts = _.clone(opts);

    if (opts.agent === undefined)
      opts.agent = false;

    return request(opts, cb);
  }
}

function attachAuthorizationHeader(request) {
  return  function (opts, cb) {
    if (!opts.auth) return request(opts, cb);
    opts = _.clone(opts);
    opts.headers = !opts.headers ? _.clone(opts.headers) : {};

    opts.headers.authorization = 'Basic ' + Buffer(opts.auth).toString('base64');
    return request(opts, cb);
  }
}

var cookiejar = require("cookiejar");
function cookiequest(request) {
  var jar;
  return function (opts, cb) {
    if (!opts.jar) return request(opts, cb);
    if (opts.jar === true && !jar) jar = new cookiejar.CookieJar();
    jar = jar || opts.jar;

    opts = _.clone(opts);
    opts.headers = opts.headers ? _.clone(opts.headers) : {};

    var uri = _.clone(opts);
    if (opts.headers.host) {
      var hostUri = url.parse("http://" + opts.headers.host);

      uri.hostname = hostUri.hostname;
    }

    var cookiestring;
    if (cookiestring = jar.getCookies(cookiejar.CookieAccessInfo(uri.hostname, uri.pathname || "/")).toValueString())
      opts.headers.cookie = cookiestring;

    return request(opts, cookiequestCallback(cb, jar));

    function cookiequestCallback(cb, jar) {
      return function (res) {
        if (res && res.headers && res.headers["set-cookie"]) {
          var cookies = res.headers["set-cookie"];
          var hostUri = url.parse("http://" + res.req._headers.host);
          for (var i = 0; i < cookies.length; ++i) {
            // In case the cookie has a wrong pattern
            try {
              var cookie = cookiejar.Cookie(cookies[i]);
              cookie.domain = cookie.domain ? cookie.domain : hostUri.hostname;

              jar.setCookie(cookie);
            } catch (e) {
              // do nothing
            }
          }
        }

        if (_.isFunction(cb))
          return cb.call(this, res);
      }
    }
  }
}

function proxyquest(request) {
  return function (opts, cb) {
    if (!opts.proxy || opts.protocol == "https:") return request(opts, cb);

    opts = _.clone(opts);
    opts.headers = opts.headers ? _.clone(opts.headers) : {};

    var proxyUri = url.parse(opts.proxy);
    opts.headers.host = opts.host ? opts.host : opts.hostname + (opts.port ? ":" + opts.port : "");

    opts = _.extend(opts, _.pick(proxyUri,['host','port','hostname']));

    if (proxyUri.auth)
      opts.headers["Proxy-Authorization"] = 'Basic ' + Buffer(proxyUri.auth).toString('base64');

    return request(opts, cb);
  }
}

var tunnel = require("tunnel");
function tunnelquest(request) {
  return function(opts, cb) {
    if (!opts.proxy || opts.protocol !== "https:") return request(opts, cb);
    var proxy = url.parse(opts.proxy);

    var protocol = opts.protocol.replace(/:$/, '').toLowerCase();
    var proxyProtocol = capitaliseFirstLetter(proxy.protocol.replace(/:$/, '').toLowerCase());

    var tun = tunnel[protocol + 'Over' + proxyProtocol];
    var tunnelOpts = {
      proxy: {
        host: proxy.hostname,
        port: proxy.port,
        localAddress: opts.localAddress,
        proxyAuth: proxy.auth || null,
        headers: (opts.headers ? _.clone(opts.headers) : {})
      }
    }

    var opts = _.extend({}, opts, {agent: tun(tunnelOpts)});
    return request(opts, cb);
  }

  function capitaliseFirstLetter(string)
  {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}

function timeoutquest(request) {
  return function (opts, cb) {
    if (!opts.responseTimeout) return request(opts, cb);

    var req = request(opts, cb);
    req.setTimeout(opts.responseTimeout, function () {
      var err = new Error('ETIMEDOUT: ' + opts.responseTimeout + ' ms');
      err.code = 'ETIMEDOUT';
      req.emit('error', err);
      req.abort();
    });

    return req;
  }
}