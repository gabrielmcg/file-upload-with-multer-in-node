const express = require('express')
const bodyParser= require('body-parser')
const Prometheus = require('prom-client')
const app = express()
const multer = require('multer');
fs = require('fs-extra')
app.use(bodyParser.urlencoded({extended: true}))

const MongoClient = require('mongodb').MongoClient
ObjectId = require('mongodb').ObjectId

const myurl = 'mongodb://mongodb:27017';

const metricsInterval = Prometheus.collectDefaultMetrics()

const httpRequestDurationMicroseconds = new Prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500]  // buckets for response time from 0.1ms to 500ms
})

// Runs before each requests
app.use((req, res, next) => {
  res.locals.startEpoch = Date.now()
  next()
})


var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now())
  }
})

var upload = multer({ storage: storage })
/*
MongoClient.connect(myurl, (err, client) => {
  if (err) return console.log(err)
  db = client.db('test') 
  app.listen(3000, () => {
    console.log('listening on 3000')
  })
})
*/

app.listen(3000, () => {
  console.log('listening on 3000')
})

app.get('/mongoconnect',function(req,res, next){
MongoClient.connect(myurl, (err, client) => {
  if (err) return console.log(err)
  db = client.db('test')

  console.log('connected to database')
  res.redirect('/uploadui')


   next();
})


});


app.get('/uploadui',function(req,res, next){
  res.sendFile(__dirname + '/index.html');

   //next();
});

// upload single file

app.post('/uploadfile', upload.single('myFile'), (req, res, next) => {
  const file = req.file
  if (!file) {
    const error = new Error('Please upload a file')
    error.httpStatusCode = 400
    return next(error)

  }

 
    res.send(file)
 
   next();
})
//Uploading multiple files
app.post('/uploadmultiple', upload.array('myFiles', 12), (req, res, next) => {
  const files = req.files
  if (!files) {
    const error = new Error('Please choose files')
    error.httpStatusCode = 400
    return next(error)
  }

    res.send(files)
 
   next();
})

app.post('/uploadphoto', upload.single('picture'), (req, res, next) => {
	var img = fs.readFileSync(req.file.path);
 var encode_image = img.toString('base64');
 // Define a JSONobject for the image attributes for saving to database
 
 var finalImg = {
      contentType: req.file.mimetype,
      image:  new Buffer(encode_image, 'base64')
   };
 db.collection('mycollection').insertOne(finalImg, (err, result) => {
  	console.log(result)

    if (err) return console.log(err)

    console.log('saved to database')
    res.redirect('/uploadui')
  
    
   next();
  })
})


app.get('/photos', (req, res, next) => {
db.collection('mycollection').find().toArray((err, result) => {

  	const imgArray= result.map(element => element._id);
			console.log(imgArray);

   if (err) return console.log(err)
   res.send(imgArray)

  
   next();
   
  })
});

app.get('/photo/:id', (req, res, next) => {
var filename = req.params.id;

db.collection('mycollection').findOne({'_id': ObjectId(filename) }, (err, result) => {

    if (err) return console.log(err)

   res.contentType('image/jpeg');
   res.send(result.image.buffer)
  
   
   next();
  })
})


app.get('/metrics', (req, res, next) => {
  res.set('Content-Type', Prometheus.register.contentType)
  res.end(Prometheus.register.metrics())
})


// Runs after each requests
app.use((req, res, next) => {
  const responseTimeInMs = Date.now() - res.locals.startEpoch

  httpRequestDurationMicroseconds
    .labels(req.method, req.route.path, res.statusCode)
    .observe(responseTimeInMs)

  next()
})



