![image](https://cloud.githubusercontent.com/assets/22159102/21554484/9d542f5a-cdc4-11e6-8c4c-7730a9e9e2d1.png)

# prerendercloud-lambda-edge

Server-side rendering (prerendering) via Lambda@Edge for single-page apps hosted on CloudFront with an s3 origin.

This is a [serverless](https://github.com/serverless/serverless) project that deploys 2 functions to Lambda, and then associates them with your CloudFront distribution.

Read more:

* https://www.prerender.cloud/
* [Dec, 2016 Lambda@Edge intro](https://aws.amazon.com/blogs/aws/coming-soon-lambda-at-the-edge/)
* [Lambda@Edge docs](http://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html)
* [CloudFront docs for Lambda@Edge](http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html)

## 1. Install

( Node v6, yarn v1.1.0 )

`$ yarn install`

## 2. Usage/Configuration

1. Edit [handler.js](/handler.js)
    * set your prerender.cloud API token (cmd+f for `prerenderToken`)

## 3. Remove CloudFront custom error response for 404->index.html

It has to be removed because it prevents the execution of the viewer-request function. This project replicates that functionality (see caveats)

1. go here: https://console.aws.amazon.com/cloudfront/home
2. click on your CloudFront distribution
3. click the "error pages" tab
4. make note of the TTL settings (in case you need to re-create it)
5. and delete the custom error response (because having the custom error response prevents the `viewer-request` function from executing).

## 4. Add `s3:ListBucket` permission to CloudFront user

Since we can't use the "custom error response", and we're implementing it ourselves, this permission is neccessary for CloudFront+Lambda@Edge to return a 404 for a requested file that doesn't exist (only non HTML files will return 404, see caveats below). If you don't add this, you'll get 403 forbidden instead.

If you're not editing an IAM policy specifically, the UI/UX checkbox for this in the S3 interface is, for the bucket, under the "Permissions" tab, "List Objects"

## 5. Deployment

1. Use an AWS user (in your ~/.aws/credentials) with any of the following permissions: (full root, or see [serverless discussion](https://github.com/serverless/serverless/issues/1439) or you can use the following policies, which is _almost_ root: [AWSLambdaFullAccess, AwsElasticBeanstalkFullAccess])
2. Set the following environment variables when deploying: CLOUDFRONT_DISTRIBUTION_ID
3. `$ make deploy`

## 6. You're done!

Visit a URL associated with your CloudFront distribution. It will take ~3s for the first request. If it times out at 3s, it will just return (and cache) the non-prerendered copy. This is a short-term issue with Lambda@Edge. Work around it, for now, by crawling your SPA with prerender.cloud with a long cache-duration.

## Viewing Logs

See logs in CloudFront in region closest to where you made the request from (although the function is deployed to us-east-1, it is replicated in all regions).

To view logs from command line:

1. use an AWS account with `CloudWatchLogsReadOnlyAccess`
2. `$ pip install awslogs` ( https://github.com/jorgebastida/awslogs )
    * `AWS_REGION=us-west-2 awslogs get -s '1h' /aws/lambda/us-east-1.Lambda-Edge-Prerendercloud-dev-viewerRequest`
    * `AWS_REGION=us-west-2 awslogs get -s '1h' /aws/lambda/us-east-1.Lambda-Edge-Prerendercloud-dev-originRequest`
    * (change `AWS_REGION` to whatever region is closest to where you physically are since that's where the logs will be)
    * (FYI, for some reason, San Francisco based requests are ending up in us-west-2)

## TODO

* normalize trailing slash?


## Caveats

1. This rewrites all extensionless or HTML paths to /index.html, which is _almost_ the typical single-page app hosting behavior. Usually the path is checked for existence on the origin (s3) _before_ rewriting to index.html.
    * The consequence is that if you have a file on s3, for example, with a path of `/docs` (or docs.html, or /whatever, or whatever.html), it will not be served. Instead, `/index.html` will be served.
    * We're waiting for the Lambda@Edge to add a feature to address this
2. query strings [can't yet be forwarded](https://forums.aws.amazon.com/thread.jspa?threadID=251491&tstart=0)
    * so if your app depends on query strings, or if you want to use `_escaped_fragment_`, it won't work
3. redirects (301/302 status codes)
    * if you use `<meta name="prerender-status-code" content="301">` to initiate a redirect, your CloudFront TTL must be zero, otherwise CloudFront will cache the body/response and return status code 200 with the body from the redirected path

