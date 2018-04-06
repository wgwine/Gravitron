var express = require('express');
var app = express();
var port = process.env.PORT || 80;
var compression = require('compression')
var csv = require('fast-csv');
var fs = require('fs');

var bodyParser = require('body-parser');
var methodOverride = require('method-override');
app.use(compression())
//console.log(process.env);
app.use(express.static(__dirname + '/wwwroot'));
app.use(bodyParser.urlencoded({ 'extended': 'true' }));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));
app.use(methodOverride());
app.get('/', function (req, res) {
  res.sendFile('public/index.html', { root: __dirname });
});


var server = require('http').createServer(app);
server.listen(port);
console.log("App listening on port " + port);
