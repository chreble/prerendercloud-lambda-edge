const handler = require("../handler");
const nock = require("nock");

const util = require("../lib/util");

const createUriShouldPrerender = uri => util.createUri(uri, true);
const createUriShouldNotPrerender = uri => util.createUri(uri, false);

describe("viewerRequest", function() {
  beforeEach(function() {
    handler.setPrerenderCloudOption(prerendercloud => null);
    nock.cleanAll();
    nock.disableNetConnect();
  });

  function runHandlerWithViewerRequestEvent() {
    beforeEach(function(done) {
      this.cb = jasmine.createSpy("originalCallback").and.callFake(done);
      this.handler(this.event, this.context, this.cb);
    });
  }

  function withUserAgentAndUri(userAgent, uri) {
    beforeEach(function() {
      this.event.Records[0].cf.request.uri = uri;
      this.event.Records[0].cf.request.headers[
        "user-agent"
      ][0].value = userAgent;
    });
  }

  function itPrerenders(userAgent, uri) {
    it("modifies request object with base64 encoded JSON string that has path and user-agent", function() {
      expect(this.cb).toHaveBeenCalledWith(null, {
        headers: {
          host: [{ value: "d123.cf.net", key: "Host" }],
          "user-agent": [{ value: userAgent, key: "User-Agent" }],
          [util.USER_AGENT_PLACEHOLDER]: [
            { value: userAgent, key: util.USER_AGENT_PLACEHOLDER }
          ]
        },
        clientIp: "2001:cdba::3257:9652",
        uri: createUriShouldPrerender(uri),
        method: "GET"
      });
    });
  }

  function itDoesNotPrerender(userAgent, uri) {
    it("modifies request object with base64 encoded JSON string that has path and user-agent", function() {
      expect(this.cb).toHaveBeenCalledWith(null, {
        headers: {
          host: [{ value: "d123.cf.net", key: "Host" }],
          "user-agent": [{ value: userAgent, key: "User-Agent" }]
        },
        clientIp: "2001:cdba::3257:9652",
        uri: createUriShouldNotPrerender(uri),
        method: "GET"
      });
    });
  }

  beforeEach(function() {
    this.handler = handler.viewerRequest;
    this.event = {
      Records: [
        {
          cf: {
            request: {
              headers: {
                host: [
                  {
                    value: "d123.cf.net",
                    key: "Host"
                  }
                ],
                "user-agent": [
                  {
                    value: "test-agent",
                    key: "User-Agent"
                  }
                ]
              },
              clientIp: "2001:cdba::3257:9652",
              uri: "/index.html",
              method: "GET"
            }
          }
        }
      ]
    };
    this.context = {};
  });

  describe("with all user-agents enabled (default)", function() {
    describe("curl user-agent", function() {
      describe("html files", function() {
        describe("html extension", function() {
          withUserAgentAndUri("curl", "/index.html");
          runHandlerWithViewerRequestEvent();

          itPrerenders("curl", "/index.html");
        });
        describe("no extension or trailing slash", function() {
          withUserAgentAndUri("curl", "/index");
          runHandlerWithViewerRequestEvent();

          itPrerenders("curl", "/index");
        });
        describe("trailing slash", function() {
          withUserAgentAndUri("curl", "/index/");
          runHandlerWithViewerRequestEvent();

          itPrerenders("curl", "/index/");
        });
      });
      describe("non html files", function() {
        withUserAgentAndUri("curl", "/app.js");
        runHandlerWithViewerRequestEvent();

        itDoesNotPrerender("curl", "/app.js");
      });
    });

    // since shouldPrerender is false, it rewrites uri to /index.html for cache-key
    describe("prerendercloud user-agent", function() {
      describe("html files", function() {
        describe("html extension", function() {
          withUserAgentAndUri("prerendercloud random-suffix", "/index.html");
          runHandlerWithViewerRequestEvent();

          itDoesNotPrerender("prerendercloud random-suffix", "/index.html");
        });
        describe("no extension or trailing slash", function() {
          withUserAgentAndUri("prerendercloud random-suffix", "/index");
          runHandlerWithViewerRequestEvent();

          itDoesNotPrerender("prerendercloud random-suffix", "/index.html");
        });
        describe("trailing slash", function() {
          withUserAgentAndUri("prerendercloud random-suffix", "/index/");
          runHandlerWithViewerRequestEvent();

          itDoesNotPrerender("prerendercloud random-suffix", "/index.html");
        });
      });

      // even though shouldPrerender is false, the uri is not HTML so it preserves uri for cache-key
      describe("non html files", function() {
        withUserAgentAndUri("prerendercloud random-suffix", "/app.js");
        runHandlerWithViewerRequestEvent();

        itDoesNotPrerender("prerendercloud random-suffix", "/app.js");
      });
    });
  });

  describe("with botsOnly user-agents", function() {
    beforeEach(function() {
      handler.setPrerenderCloudOption(prerendercloud =>
        prerendercloud.set("botsOnly", true)
      );
    });
    // since shouldPrerender is true, it preserves uri for cache-key
    describe("twitterbot user-agent", function() {
      withUserAgentAndUri("twitterbot", "/nested/path");
      runHandlerWithViewerRequestEvent();

      itPrerenders("twitterbot", "/nested/path");
    });

    // since shouldPrerender is false, it rewrites uri for cache-key
    describe("curl user-agent", function() {
      withUserAgentAndUri("curl", "/nexted/path");
      runHandlerWithViewerRequestEvent();

      itDoesNotPrerender("curl", "/index.html");
    });

    describe("prerendercloud user-agent", function() {
      withUserAgentAndUri("prerendercloud random-suffix", "/index.html");
      runHandlerWithViewerRequestEvent();

      itDoesNotPrerender("prerendercloud random-suffix", "/index.html");
    });
  });
});
