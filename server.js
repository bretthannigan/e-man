// Import express and request modules, database
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const mongoClient = require('mongodb').MongoClient;
var objectId = require('mongodb').ObjectId;
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

const PORT = 3000;
const COLLECTION = 'main';

const CHANNEL_ID = "GJKRMQHJM"; // "CLE7TDLVC"

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
            message.blocks.unshift(
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Asset number *" + req.body.text + "* was found:"
                    }
                }
            )
        } else {
            var message = "Asset number *" + req.body.text + "* was not found.";
        }
        res.send(message);
    });
});

app.post('/search', function(req, res) {
    const MAX_RESULTS = 5;
    db.collection(COLLECTION).createIndex({nickname: "text", full_name: "text", manufacturer: "text", model: "text", serial_number: "text", location: "text"});
    db.collection(COLLECTION)
    .find({$text: { $search: req.body.text}}, {nickname: 1, full_name: 1, manufacturer: 1, model: 1, serial_number: 1, location: 1})//, { score: { $meta: "textScore"}})
    .project({ score: { $meta: "textScore"}})
    .sort({score: { $meta: "textScore"}})
    .toArray(function (err, items) {
        if (err) {
            console.log(err);
            res.sendStatus(500);
            return;
        } 
        console.log(items)
        if (items.length) {
            var message = printQueryOutput(items);
            if (items.length<=MAX_RESULTS) {
                message.blocks.unshift(
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Found " + items.length + " asset(s) matching search \"*" + req.body.text + "*\":"
                        }
                    }
                )
            } else {
                message.blocks.unshift(
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Found the top " + MAX_RESULTS + " assets matching search \"*" + req.body.text + "*\":"
                        }
                    }
                )
            }
        } else {
            console.log('search else')
            console.log(items)
            var message = "Did not find any matching assets for search \"*" + req.body.text + "*\".";
        }
        res.send(message);
    });
});

app.post('/checkout', function(req, res) {
    if (req.body.channel_id!=CHANNEL_ID) {
        res.send("Please use the <#" + CHANNEL_ID + "> channel for checking out assets.");
        return;
    };
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
                    message.blocks.unshift(
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "<@" + req.body.user_id + ">" + " successfully checked out asset number *" + args[0] + "* for *" + (req.body.date_due ? args[1] : "unlimited") + "* day(s)."
                            }
                        }
                    );
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
    if (req.body.channel_id!=CHANNEL_ID) {
        res.send("Please use the <#" + CHANNEL_ID + "> channel for checking in assets.");
        return;
    };
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

                    message.blocks.unshift(
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "<@" + req.body.user_id + ">" + " successfully checked in asset number *" + req.body.text + "*. Thanks!"
                            }
                        }
                    );
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

app.delete('/delete', (req, res) => {
    db.collection(COLLECTION)
    .findOneAndDelete({full_name: req.body.full_name},
    (err, result) => {
        if (err) throw err;
        res.send({message: 'deleted'})
    });
});

function printQueryOutput(item, isEphemeral=true) {
    message = {
        "response_type": isEphemeral ? "ephemeral" : "in_channel",
    };
    message.blocks = new Array();
    if (Array.isArray(item)) {
        for (var i=0; i<item.length; i++) {
            message.blocks.push(
                {
                "type": "divider"
                },
                printAssetInfo(item[i]),
                printDateInfo(item[i])
            )
        }
    } else {
        message.blocks.push(
            {
                "type": "divider"
            },
            printAssetInfo(item),
            printDateInfo(item)
        )
    };
    return message;
};

function printAssetInfo(item) {
    return {
        "type": "section",
        "fields": [
            {
                "type": "mrkdwn",
                "text": "*Asset number:*\n" + item.asset_number
            },
            {
                "type": "mrkdwn",
                "text": "*Status:*\n" + printStatusLine(item)
            },
            {
                "type": "mrkdwn",
                "text": "*Nickname:*\n" + item.nickname
            },
            {
                "type": "mrkdwn",
                "text": "*Full name:*\n" + item.full_name
            },
            {
                "type": "mrkdwn",
                "text": "*Category:*\n" + Category[item.category].name
            },
            {
                "type": "mrkdwn",
                "text": "*Manufacturer:*\n" + item.manufacturer
            },
            {
                "type": "mrkdwn",
                "text": "*Model:*\n" + item.model
            },
            {
                "type": "mrkdwn",
                "text": "*Serial number:*\n" + item.serial_number
            },
            {
                "type": "mrkdwn",
                "text": "*Campus:*\n" + Campus[item.campus].name
            },
            {
                "type": "mrkdwn",
                "text": "*Location:*\n" + item.location
            }
        ]
    }
};

function printDateInfo(item) {
    return {
        "type": "context",
        "elements": [
            {
                "type": "mrkdwn",
                "text": "Entry last modified" + (item.user_id ? " by <@" + item.user_id + ">" : "") + " on <!date^" + (Date.parse(item.date_modified) / 1000).toFixed(0) + "^{date_num} {time}|" + item.date_modified.toString() + ">"
            }
        ]
    }
};

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