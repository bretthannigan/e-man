// Import express and request modules, database
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const qs = require('qs');
var mongoDb = require('mongodb');
const mongoClient = mongoDb.MongoClient;
var objectId = require('mongodb').ObjectId;
path = require('path');
require('dotenv').config({path: path.join(__dirname, '.env')});
var dbUrl = "mongodb+srv://" + process.env.DB_USER + ":" + process.env.DB_PW + "@eman-db-h7ewg.mongodb.net/test?retryWrites=true&w=majority";

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

var favicon = require('serve-favicon');
app.use(favicon(path.join(__dirname + '/views/icons/favicon.ico')));

//----------Database----------

const MAIN_DB = 'main';
const ASSET_DB = 'assets';
const USERS_DB = 'users';

var dbMain, dbUsers
mongoClient.connect(dbUrl, {useNewUrlParser: true}, function(err, client) {
    if (err) throw err;
    dbMain = client.db(MAIN_DB);
    dbMain.createCollection(ASSET_DB);
    dbMain.collection(USERS_DB).save({
        _id: "000000000",
        name: 'Unassigned',
        email: '',
        date_last_login: new Date(Date.now()).toISOString()
    });
    //dbMain.createCollection(USERS_DB);
    app.listen(process.env.PORT, function() {
        console.log('listening on ' + process.env.PORT + '.');
    });
});

//----------Authentication----------

var passport = require('passport')
var SlackStrategy = require('passport-slack-oauth2').Strategy;
passport.use(new SlackStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    skipUserProfile: false,
    scope: ['identity.basic', 'identity.email', 'identity.avatar', 'identity.team']
  },
  (accessToken, refreshToken, profile, done) => {
    // optionally persist user data into a database
    dbMain.collection(USERS_DB).save({ 
        _id: profile.user.id, 
        name: profile.user.name, 
        email: profile.user.email,
        date_last_login: new Date(Date.now()).toISOString()
    }, function(err, result) {
        if (err) throw err;
    });
    done(null, profile);
  }
));
passport.serializeUser(function(user, done) {
    done(null, user);
});
passport.deserializeUser(function(obj, done) {
    done(null, obj);
});
var expressSession = require('express-session');
var cookieParser = require('cookie-parser');
var methodOverride = require('method-override');
app.use(cookieParser());
app.use(express.static(__dirname + 'public'));
app.use(expressSession({ secret:'watchingferries', resave: true, saveUninitialized: true, maxAge: (90 * 24 * 3600000) }));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));

//----------Options Structures----------

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

//----------Web App----------

app.get('/', function(req, res) {
    res.render('auth.ejs', {client_id: process.env.CLIENT_ID});
});

app.get('/logoff', function(req, res) {
    res.clearCookie('menrva-e-man');
    res.redirect('/');
});

app.get('/auth/slack', passport.authenticate('slack'));

app.get('/auth/slack/callback', 
    passport.authenticate('Slack', { failureRedirect: '/' }),
    (req, res) => res.redirect('/setcookie')
);

app.get('/setcookie', requireUser, function(req, res) {
    res.cookie('menrva-e-man', new Date());
    res.redirect('/success');
});

app.get('/success', requireTeam, function(req, res) {
    if (req.cookies['menrva-e-man']) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/');
    }
});

function requireUser (req, res, next) {
    if (!req.user) {
        res.redirect('/');
    } else {
        next();
    }
};

function requireTeam (req, res, next) {
    if (!req.user) {
        res.redirect('/');
    } else if (req.user.team.id==process.env.TEAM_ID) {
        next();
    } else {
        res.redirect('/');
    }
}

function requireLogin (req, res, next) {
    if (!req.cookies['menrva-e-man']) {
        res.redirect('/');
    } else {
        next();
    }
};

app.get('/dashboard', requireLogin, function(req, res) {
    dbMain.collection(ASSET_DB).find().sort({ asset_number: 1 }).toArray((err, dataQuery) => {
        if (err) throw err;
        dbMain.collection(USERS_DB).find().toArray((err, usersQuery) => {
            res.render('index.ejs', {
                data: dataQuery, 
                allUsers: usersQuery,
                user: req.user, 
                statusOptions: Status, 
                categoryOptions: Category, 
                campusOptions: Campus,
            });
        })
    });
});

app.get('/edit/:id', requireLogin, function(req, res) {
    dbMain.collection(ASSET_DB).findOne({_id: new mongoDb.ObjectID(req.params.id)}, function (err, dataQuery) {
        if (err) throw err;
        dbMain.collection(USERS_DB).find().toArray((err, usersQuery) => {
            res.render('edit.ejs', {
                data: dataQuery,
                allUsers: usersQuery,
                user: req.user,
                statusOptions: Status,
                categoryOptions: Category,
                campusOptions: Campus,
            });
        })
    });
});

app.get('/')

app.delete('/delete/:id', requireLogin, function (req, res) {
    dbMain.collection(ASSET_DB)
    .deleteOne({_id: new mongoDb.ObjectID(req.params.id)},
    (err, result) => {
        if (err) throw err;
        res.redirect('/dashboard')
    });
});

app.post('/new', function(req, res) {
    req.body.asset_number = parseInt(req.body.asset_number);
    dbMain.collection(ASSET_DB).findOneAndUpdate({asset_number: { $eq: req.body.asset_number } }, { $set: req.body }, { asset_number: 1, upsert: true }, function(err, result) {
        if (err) throw err;
        console.log(req.body);
        res.redirect('/dashboard');
    })
});

//----------Slash Commands----------

var verifySlackRequest = function (req, res, next) {
    const hmac = crypto.createHmac('sha256', process.env.SIGNING_SECRET);
    var slack_signature = req.headers['x-slack-signature'];
    var signature = slack_signature.split('=', 1);
    version = signature[0];
    var timestamp = req.headers['x-slack-request-timestamp'];
    if (Math.abs(Math.round(Date.now() / 1000) - timestamp) > 60 * 5) {
        return res.status(400).send('Vefification failed');
    }
    var basestring = version + ":" + timestamp + ":" + qs.stringify(req.body, { format: 'RFC1738' });
    hmac.update(basestring);
    my_signature = version + "=" + hmac.digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(my_signature, 'utf8'), Buffer.from(slack_signature, 'utf8'))) {
        next();
    } else {
        return res.status(400).send('Vefification failed');
    }
};

app.use(verifySlackRequest);

app.post('/query', function(req, res) {
    dbMain.collection(ASSET_DB)
    .findOne({asset_number: parseInt(req.body.text)}, {projection: { _id: false }}, function (err, item) {
        if (err) {
            res.sendStatus(500)
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
    dbMain.collection(ASSET_DB).createIndex({nickname: "text", full_name: "text", manufacturer: "text", model: "text", serial_number: "text", location: "text"}, {name:"myIndex"});
    dbMain.collection(ASSET_DB)
    .find({$text: { $search: req.body.text}}, {nickname: 1, full_name: 1, manufacturer: 1, model: 1, serial_number: 1, location: 1})//, { score: { $meta: "textScore"}})
    .project({ score: { $meta: "textScore"}})
    .sort({score: { $meta: "textScore"}})
    .toArray(function (err, items) {
        if (err) {
            res.sendStatus(500);
            return;
        } 
        if (items.length) {
            var message;
            if (items.length<=MAX_RESULTS) {
                message = printQueryOutput(items);
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
                message = printQueryOutput(items(0, MAX_RESULTS));
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
            var message = "Did not find any matching assets for search \"*" + req.body.text + "*\".";
        }
        res.send(message);
    });
});

app.post('/checkout', function(req, res) {
    if (req.body.channel_id!=process.env.CHANNEL_ID) {
        res.send("Please use the <#" + process.env.CHANNEL_ID + "> channel for checking out assets.");
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
    dbMain.collection(ASSET_DB)
    .findOne({asset_number: parseInt(args[0])}, function (err, item) {
        if (err) {
            res.sendStatus(500);
        }
        if (item) {
            if (Status[item.status].value == Status.AVAILABLE.value || (Status[item.status].value == Status.INUSE.value && item.user_id == req.body.user_id)) {
                dbMain.collection(ASSET_DB)
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
    if (req.body.channel_id!=process.env.CHANNEL_ID) {
        res.send("Please use the <#" + process.env.CHANNEL_ID + "> channel for checking in assets.");
        return;
    };
    req.body.date_modified = new Date(Date.now()).toISOString();
    dbMain.collection(ASSET_DB)
    .findOne({asset_number: parseInt(req.body.text)}, function (err, item) {
        if (err) {
            res.send(500);
        }
        if (item) {
            if (Status[item.status].value == Status.INUSE.value && item.user_id == req.body.user_id) { 
                dbMain.collection(ASSET_DB)
                .findOneAndUpdate({_id: item._id}, {
                    $set: {
                        status: "AVAILABLE",
                        user_id: "000000000",
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
                "text": "Entry last modified" + (item.user_id && item.user_id!="000000000" ? " by <@" + item.user_id + ">" : "") + " on <!date^" + (Date.parse(item.date_modified) / 1000).toFixed(0) + "^{date_num} {time}|" + item.date_modified.toString() + ">"
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