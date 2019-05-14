// Import express and request modules, database
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
var mongoClient = require('mongodb').MongoClient;
var objectId = require('mongodb').ObjectId;
var dbUrl = "mongodb://localhost/equipdb";
require('dotenv').config();

// Instantiates Express and assigns our app variable to it
var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

const Status = Object.freeze({
    Available: 'available',
    InUse: 'in use',
    Unknown: 'unknown',
    OutOfService: 'out of service',
    Missing: 'missing'
})

// Again, we define a port we want to listen to
const PORT=80;

var db
mongoClient.connect(dbUrl, function(err, client) {
    if (err) throw err;
    db = client.db('test');
    app.listen(PORT, function() {
        console.log('listening on 80.');
    });
});

// // Lets start our server
// app.listen(PORT, function () {
//     //Callback triggered when server is successfully listening. Hurray!
//     console.log("Example app listening on port " + PORT);
// });

// This route handles GET requests to our root ngrok address and responds with the same "Ngrok is working message" we used before
app.get('/', function(req, res) {
    db.collection('test').find().toArray((err, result) => {
        if (err) throw err;
        res.render('index.ejs', {test: result});
    });
});

// This route handles get request to a /oauth endpoint. We'll use this endpoint for handling the logic of the Slack oAuth process behind our app.
app.get('/oauth', function(req, res) {
    // When a user authorizes an app, a code query parameter is passed on the oAuth endpoint. If that code is not there, we respond with an error message
    if (!req.query.code) {
        res.status(500);
        res.send({"Error": "Looks like we're not getting code."});
        console.log("Looks like we're not getting code.");
    } else {
        // If it's there...

        // We'll do a GET call to Slack's `oauth.access` endpoint, passing our app's client ID, client secret, and the code we just got as query parameters.
        request({
            url: 'https://slack.com/api/oauth.access', //URL to hit
            qs: {code: req.query.code, client_id: CLIENTID, client_secret: CLIENTSECRET}, //Query string data
            method: 'GET', //Specify the method

        }, function (error, response, body) {
            if (error) {
                console.log(error);
            } else {
                res.json(body);
            }
        })
    }
});

// Route the endpoint that our slash command will point to and send back a simple response to indicate that ngrok is working
app.post('/command', function(req, res) {
    res.send('Your ngrok tunnel is up and running!');
});

app.post('/query', function(req, res) {
    db.collection('test')
    .findOne({asset_number: req.body.text}, function (err, cursor) {
        console.log(cursor);
    });
    res.send('query!');
});

app.post('/new', function(req, res) {
    db.collection('test').save(req.body, function(err, result) {
        if (err) throw err;
        console.log('saved to database');
        res.redirect('/');
    })
    console.log(req.body);
});

app.put('/edit', (req, res) => {
    db.collection('test')
    .findOneAndUpdate({full_name: 'a'}, {
      $set: {
        full_name: req.body.full_name,
        nickname: req.body.nickname
      }
    }, {
      sort: {_id: -1},
      upsert: true
    }, (err, result) => {
      if (err) return res.send(err)
      res.send(result)
    });
});

app.delete('/delete', (req, res) => {
    db.collection('test')
    .findOneAndDelete({full_name: req.body.full_name},
    (err, result) => {
        if (err) throw err;
        res.send({message: 'deleted'})
    });
});

app.post('/checkout', (req, res) => {
    console.log(req.body);
    res.send('checkout!');
});