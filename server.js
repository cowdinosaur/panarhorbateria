const uuid = require('uuid/v4');
var express = require('express');
var app = express();
var session = require("express-session")
var http = require('http').Server(app);
var io = require('socket.io')(http);
const bodyParser = require('body-parser');
var path = require('path');


app.use(bodyParser.urlencoded({ extended: false }));
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');
app.use(express.static("public", {
    extensions: ['html', 'htm']
}));
app.use(session({ secret: 'shhh'}))


app.get('/', function(req, res) {
  res.render('index')
});

app.post('/name', function(req, res){
  console.log(`${req.body.name} Entered!!!`)
  req.session.name = req.body.name
  req.session.userid = uuid()
  res.redirect('/menu')
});

app.get('/menu', function(req, res) {
  if(!req.session.userid){res.redirect('/'); return;}
  res.render('menu', {session:req.session})
});

app.get('/chat', function(req, res) {
  if(!req.session.userid){res.redirect('/'); return;}
  res.render('chat', {session:req.session})
});

const listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
