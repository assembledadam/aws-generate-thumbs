# Generate Thumbs

### Lambda script that creates scaled thumbnails of a given image (stored on S3)

Right now the source and destination buckets are constants/hardcoded. Use [node-lambda](https://github.com/RebelMail/node-lambda) to test and deploy it.

** Important: Keys exist in .env file - remove if ever making this public. **

Lambda input JSON:
``
{
    "srcFile": "filename.jpg",  // filename in creo-temp S3 bucket
    "thumbSizes": [             // contains thumb sizes to generate
        "700x",                 // scale based on width
        "x150",                 // scale based on height
        "950x495"               // provide specific size (so not automatically maintaining ratio)
    ]
}
``