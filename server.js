// Import express and request modules, database
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const mongoClient = require('mongodb').MongoClient;
var objectId = require('mongodb').ObjectId;
//var dbUrl = "mongodb://localhost/equipdb";
var dbUrl = "mongodb+srv://eman-admin:TnlcEcrokHqWwFkk@eman-db-h7ewg.mongodb.net/test?retryWrites=true&w=majority";
require('dotenv').config();

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

const Status = Object.freeze({
    AVAILABLE: { value: 1, name: 'Available', symbol: ':heavy_check_mark:', colour: '#008000' },
    INUSE: { value: 2, name: 'In use', symbol: ':no_entry:', colour: '#800000' },
    UNKNOWN: { value: 3, name: 'Unknown', symbol: ':grey_question:', colour: '#808080' },
    OUTOFSERVICE: { value: 4, name: 'Out of service', symbol: ':heavy_multiplication_x:', colour: '#FF4500' },
    MISSING: { value: 5, name: 'Missing', symbol: ':x:', colour: '#000000' }
});

const Category = Object.freeze({
    TESTEQUIPMENT: { value: 1, name: 'Test equipment' },
    PROTOTYPING: { value: 2, name: 'Prototyping' },
    DATAACQUISITION: { value: 3, name: 'Data acquisition' },
    COMPUTERS: { value: 4, name: 'Computers' },
    COMPUTERACCESSORIES: { value: 5, name: 'Computer accessories' },
    ROBOTICS: { value: 6, name: 'Robotics' },
    SENSORS: { value: 7, name: 'Sensors' },
    MOTIONTRACKER: { value: 8, name:'Motion tracker' },
    CLINICALDEVICES: { value: 9, name: 'Clinical devices' },
    TOOLS: { value: 10, name: 'Tools' },
    OTHER: { value: 11, name: 'Other' }
})

const Campus = Object.freeze({
    BURNABY: { value: 1, name: 'Burnaby' },
    SURREY: { value: 2, name: 'Surrey' },
    BITOFFICE: { value: 3, name: 'BIT Office' }
})

const PORT=80;
//const COLLECTION='test-eq';
const COLLECTION='main';

var db
mongoClient.connect(dbUrl, {useNewUrlParser: true}, function(err, client) {
    if (err) throw err;
    db = client.db(COLLECTION);
    app.listen(PORT, function() {
        console.log('listening on 80.');
    });
});

// This route handles GET requests to our root ngrok address and responds with the same "Ngrok is working message" we used before
app.get('/', function(req, res) {
    db.collection(COLLECTION).find().toArray((err, result) => {
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

app.post('/query', function(req, res) {
    db.collection(COLLECTION)
    .findOne({asset_number: req.body.text}, {projection: { _id: false }}, function (err, item) {
        if (err) {
            res.send(500)
        }
        if (item) {
            var message = printQueryOutput(item);
            message.text = "Asset number *" + req.body.text + "* was found:";
        } else {
            var message = "Asset number *" + req.body.text + "* was not found.";
        }
        res.send(message);
    });
});

app.post('/checkout', function(req, res) {
    args = req.body.text.split(' ');
    req.body.date_modified = new Date(Date.now()).toISOString();
    if (args.length == 2) {
        var date_due = new Date(Date.now());
        date_due.setDate(date_due.getDate() + parseFloat(args[1]));
        req.body.date_due = date_due.toISOString();
    } else {
        req.body.date_due = null;
    }
    db.collection(COLLECTION)
    .findOne({asset_number: args[0]}, function (err, item) {
        if (err) {
            res.send(500);
        }
        if (item) {
            if (Status[item.status].value == Status.AVAILABLE.value || (Status[item.status].value == Status.INUSE.value && item.user_id == req.body.user_id)) {
                db.collection(COLLECTION)
                .findOneAndUpdate({_id: item._id}, {
                    $set: {
                        status: "INUSE",
                        user_id: req.body.user_id,
                        date_modified: req.body.date_modified,
                        date_due: req.body.date_due
                    }
                }, {
                    returnOriginal: false
                }, (err, result) => {
                    if (err) return res.send(err);
                    var message = printQueryOutput(result.value, false);
                    message.text = "<@" + req.body.user_id + ">";
                    message.text = message.text + " successfully checked out asset number *" + args[0] + "* for *" + (req.body.date_due ? args[1] : "unlimited") + "* day(s).";
                    res.send(message);
                });
            } else {
                var message = "<@" + req.body.user_id + ">";
                message = message + " could not check out asset number *" + req.body.text + "* because its current status is: " + printStatusLine(item);
                res.send(message);
            }
        } else {
            var message = "Asset number *" + req.body.text + "* was not found.";
            res.send(message);
        }
    })
});

app.post('/checkin', function(req, res) {
    req.body.date_modified = new Date(Date.now()).toISOString();
    db.collection(COLLECTION)
    .findOne({asset_number: req.body.text}, function (err, item) {
        if (err) {
            res.send(500);
        }
        if (item) {
            if (Status[item.status].value == Status.INUSE.value && item.user_id == req.body.user_id) { 
                db.collection(COLLECTION)
                .findOneAndUpdate({_id: item._id}, {
                    $set: {
                        status: "AVAILABLE",
                        user_id: req.body.user_id,
                        date_modified: req.body.date_modified,
                        date_due: ''
                    }
                }, {
                    returnOriginal: false
                }, (err, result) => {
                    if (err) return res.send(err);
                    var message = printQueryOutput(result.value, false);
                    message.text = "<@" + req.body.user_id + ">";
                    message.text = message.text + " successfully checked in asset number *" + req.body.text + "*.";
                    res.send(message);
                });
            } else {
                message = "<@" + req.body.user_id + ">";
                message = message + " could not check in asset number *" + req.body.text + "* because its current status is: " + printStatusLine(item);
                res.send(message);
            }
        } else {
            var message = "Asset number *" + req.body.text + "* was not found.";
            res.send(message);
        }
    })
});

app.post('/new', function(req, res) {
    req.body.date_added = new Date(Date.now()).toISOString();
    req.body.date_modified = new Date(Date.now()).toISOString();
    db.collection(COLLECTION).save(req.body, function(err, result) {
        if (err) throw err;
        console.log('saved to database');
        res.redirect('/');
    })
});

app.put('/edit', function(req, res) {
    req.body.date_modified = new Date(Date.now()).toISOString();
    db.collection(COLLECTION)
    .findOneAndUpdate({full_name: 'a'}, {
      $set: {
        full_name: req.body.full_name,
        nickname: req.body.nickname,
        date_modified: req.body.date_modified
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
    db.collection(COLLECTION)
    .findOneAndDelete({full_name: req.body.full_name},
    (err, result) => {
        if (err) throw err;
        res.send({message: 'deleted'})
    });
});

function printQueryOutput(item, isEphemeral=true) {
    return {
        "response_type": isEphemeral ? "ephemeral" : "in_channel",
        "attachments": [
            {
                "fallback": "Cannot display attachment.",
                "color": Status[item.status].colour,
                "fields": [
                    {
                        "title": "Asset number",
                        "value": item.asset_number,
                        "short": true
                    },
                    {
                        "title": "Status",
                        "value": printStatusLine(item),
                        "short": true
                    },
                    {
                        "title": "Nickname",
                        "value": item.nickname,
                        "short": true
                    },
                    {
                        "title": "Full Name",
                        "value": item.full_name,
                        "short": true
                    },
                    {
                        "title": "Category",
                        "value": Category[item.category].name,
                        "short": true
                    },
                    {
                        "title": "Manufacturer",
                        "value": item.manufacturer,
                        "short": true
                    },
                    {
                        "title": "Model",
                        "value": item.model,
                        "short": true
                    },
                    {
                        "title": "Serial Number",
                        "value": item.serial_number,
                        "short": true
                    },
                    {
                        "title": "Campus",
                        "value": Campus[item.campus].name,
                        "short": true
                    },
                    {
                        "title": "Location",
                        "value": item.location,
                        "short": true
                    }
                ],
                "footer": "Entry last modified" + (item.user_id ? " by <@" + item.user_id + ">" : ""),
                "ts": (Date.parse(item.date_modified) / 1000).toFixed(0)
            }
        ]
    };
}

function printStatusLine(item) {
    line = Status[item.status].symbol + " " + Status[item.status].name;
    if (Status[item.status].value == Status.INUSE.value && item.user_id) {
        line = line + " by " + "<@" + item.user_id + ">"
        if (item.date_due) {
            line = line + "\n(expected: <!date^" + (Date.parse(item.date_due) / 1000).toFixed(0) + "^{date_short_pretty}|" + item.date_due + ">)";
        }
    }
    return line
}