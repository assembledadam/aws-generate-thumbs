// dependencies
var async = require('async');
var AWS = require('aws-sdk');
var gm = require('gm').subClass({ imageMagick: true }); // Enable ImageMagick integration.
var util = require('util');

// constants
var BUCKET_SRC = 'creo-temp';
var BUCKET_DEST = 'creo-meta-images';

// get reference to S3 client
var s3 = new AWS.S3();

exports.handler = function(event, context)
{
    // Read options from the event.
    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));

    // check required fields exist
    if (!event.srcFile) {
        console.log('Request data not sufficient: need keys srcFile, thumbSizes');
        return;
    }

    // Filename may have spaces or unicode non-ASCII characters.
    var srcFile = decodeURIComponent(event.srcFile.replace(/\+/g, " "));

    // Sanity check: validate that source and destination are different buckets.
    if (BUCKET_SRC == BUCKET_DEST) {
	   console.error('Destination bucket must not match source bucket.');
	   return;
    }

    // detect image type
    var typeMatch = srcFile.match(/\.([^.]*)$/);

    if (!typeMatch) {
	   console.error('unable to determine image type for file ' + srcFile);
	   return;
    }

    var imageType = typeMatch[1];

    if (imageType != 'jpg' && imageType != 'png') {
	   console.log('Only jpg and png files supported (file was ' + imageType + ')');
	   return;
    }

    // deterime filename without extension (for thumbnail filenames)
    var srcFileNoExt = srcFile.replace('.' + imageType, '');

    // download the image from S3, generate thumbnails, then upload them to a different S3 bucket.
    async.waterfall([
    	function download(next) {
    	    // download the image from S3 into a buffer.
    	    s3.getObject(
                { Bucket: BUCKET_SRC, Key: srcFile },
                next
            );
    	},
    	function tranform(response, next) {
    	    gm(response.Body).size(function(err, size) {

                // get ratio
                var self = this;

                // iterate required sizes and scale
                event.thumbSizes.forEach(function (item) {
                    var wxh     = item.split('x'),
                        width   = wxh[0],
                        height  = wxh[1];

                    // transform the image buffer in memory.
                    var response = width && height ? self.resize(width, height, '!') : self.resize(width, height);

                    response.toBuffer(imageType, function(err, buffer) {
                        if (err) {
                            next(err);
                        } else {
                            next(null, response.ContentType, buffer);
                        }
                    });
                });
    	    });
    	},
    	function upload(contentType, data, next) {

            // detect size of thumb
            gm(data).size(function (err, size) {
                if (err) {
                    next(err);
                } else {
                    // set filename
                    var filename = srcFileNoExt + '_' + size.width + 'x' + size.height + '.' + imageType;

                    // upload thumb
                    s3.putObject(
                        {
                            Bucket: BUCKET_DEST,
                            Key: filename,
                            Body: data,
                            ContentType: contentType
                        },
                        next
                    );
                }
            });

        }],
        function (err) {
    	    if (err) {
        		console.error(
        		    'Unable to resize ' + BUCKET_SRC + '/' + srcFile +
        		    ' and upload to ' + BUCKET_DEST + '/' +
        		    ' due to an error: ' + err
        		);
    	    } else {
        		console.log(
        		    'Successfully resized ' + BUCKET_SRC + '/' + srcFile +
        		    ' and uploaded thumbs to ' + BUCKET_DEST + '/'
        		);
    	    }

    	    context.done();
    	}
    );
};