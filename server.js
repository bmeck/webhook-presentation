// System setup

var path    = require('path');
var fs      = require('fs');

// Application code
var hbs     = require('handlebars');
var request = require('request');
var express = require('express');
var uuid    = require('uuid');
var app     = express();
app.use(express.urlencoded());


// Our "Database"
var messages = {};
var people   = {};

// Storage for twiml
app.use('/twilio/', express.static('twiml'));

// API

var templates = {
    readMessages: hbs.compile(fs.readFileSync(path.join(__dirname, 'twiml', 'read-messages.xml')).toString()),
    redirect: hbs.compile(fs.readFileSync(path.join(__dirname, 'twiml', 'redirect.xml')).toString())
}

app.post('/api/messages', function (req, res, next) {
    var phoneNumber = req.query.From;
    var url = req.body.RecordingUrl;
    var id = uuid();
    while (id in messages) {
        id = uuid();
    }
    messages[id] = {
        date: new Date(),
        phoneNumber: phoneNumber,
        url: url
    };
    res.send(200, templates.redirect({url:'/twilio/menu.xml'}));
});

app.get('/api/messages', function (req, res, next) {
    var phoneNumber = req.query.From;
    if (!/\+\d+/.test(phoneNumber)) {
        res.send(400);
    }
    var person = people[phoneNumber] || (people[phoneNumber] = {});
    var read = person.read || (person.read = []);
    var firstUnreadMessageId = Object.keys(messages).filter(function (id) {
        return read.indexOf(id) === -1;
    })[0];
    if (firstUnreadMessageId) {
        var firstUnreadMessage = messages[firstUnreadMessageId];
        res.send(200, templates.readMessages({
            id: firstUnreadMessageId,
            date: firstUnreadMessage.date,
            url: firstUnreadMessage.url 
        }));
    }
    else {
        res.send(200, templates.redirect({url:'/twilio/menu.xml'}));
    }
});

app.post('/api/messages/:messageId/markRead', function (req, res, next) {
    var phoneNumber = req.query.From;
    var messageId = req.params.messageId;
    if (!/\+\d+/.test(phoneNumber)) {
        res.send(400);
    }
    var person = people[phoneNumber] || (people[phoneNumber] = {});
    var read = person.read || (person.read = []);
    read.push(messageId);
    res.send(200, templates.redirect({url:'/api/messages'}));
});

app.post('/actions/fromKeys', function (req, res, next) {
    var url = req.body.Digits;
    switch (url) {
        case '1':
    res.send(200, templates.redirect({url:'/api/messages'}));
            return;
        case '2':
            res.redirect('/twilio/record-message.xml');
            return;
    }
});

// Startup

var http = require('http');
var server = http.createServer(app);
server.listen(process.env.PORT || 8080, function () {
    console.log('Listening on port', server.address().port, 'with address', server.address().address);
});
