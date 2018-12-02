const uuid = require('uuid/v4');
var express = require('express');
var app = express();
var session = require("express-session")
var http = require('http').Server(app);
var io = require('socket.io')(http);
const bodyParser = require('body-parser');
const path = require('path');
var Sequelize = require('sequelize');
const fs = require('fs')
const csv = require('csvtojson')

// hardcoded file names and locations
const csvFile = path.join(__dirname, 'data.csv')

var Activity;
var Interest;
var Timing;

// setup a new database
// using database credentials set in .env
var sequelize = new Sequelize('database', process.env.DB_USER, process.env.DB_PASS, {
  host: '0.0.0.0',
  dialect: 'sqlite',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    idle: 10000
  },
  storage: '.data/database.sqlite'
});
const Op = Sequelize.Op

sequelize.authenticate().then(function(err) {
    console.log('Connection has been established successfully.');

    Interest = sequelize.define('interests', {
      name: {
        type: Sequelize.STRING,
        unique: true
      }
    });
  
    Timing = sequelize.define('timings', {
      timing: {
        type: Sequelize.TIME,
        unique: true
      }
    });
                                 

    Activity = sequelize.define('activities', {
      type: {
        type: Sequelize.ENUM,
        values: ['exhibit', 'workshop']
      },
      name: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.TEXT
      },
      min_age: {
        type: Sequelize.INTEGER
      },
      max_age: {
        type: Sequelize.INTEGER
      },
      est_time: {
        type: Sequelize.INTEGER
      },
      code: {
        type: Sequelize.STRING
      }

    });

    Interest.belongsToMany(Activity, {through: 'InterestActivity'});
    Activity.belongsToMany(Interest, {through: 'InterestActivity'});
  
    Activity.belongsToMany(Timing, {through: 'TimingActivity'});
    Timing.belongsToMany(Activity, {through: 'TimingActivity'});
  
    sequelize.sync({force: true}).then(setup);
  })
  .catch(function (err) {
    console.log('Unable to connect to the database: ', err);
  });

// populate table with default users
function setup(){
  console.log("Running setup");

  Interest.sync()
    .then(function() {
      var interests = ['Chemistry', 'Physics', 'Biology', 'Technology'];

      for (var i=0; i <interests.length; i++) {
        Interest.create({name: interests[i]});
      }
    });
  
  Activity.sync().then(async function(){ 
      const jsonArray = await csv().fromFile(csvFile);
      console.log(jsonArray);
    
      for (var i=0; i < jsonArray.length; i++) {
        var act = jsonArray[i];
        await Activity.create({type: act.type, name: act.name,
                         description: act.description,
                         min_age: parseInt(act.min_age),
                         max_age: parseInt(act.max_age),
                         est_time: parseInt(act.est_time),
                         code: act.code}).then(activity => {
          let interesttrans = {
            "PHY": "Physics",
            "TECH": "Technology",
            "CHEM": "Chemistry",
            "BIO": "Biology"
          }
          act.interests.split(', ').forEach(function(interest){
            Interest.findOne({where: {name: interesttrans[interest]}}).then(chem_interest => {
              activity.setInterests([chem_interest]);
            }); 
          });
        });                
      }    
  });
}










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

app.get('/code', function(req, res) {
  if(!req.session.userid){res.redirect('/'); return;}
  res.render('code', {session:req.session})
});

app.post('/code', function(req, res) {
    res.redirect('/quiz')
});
        
app.get('/quiz', function(req, res) {
  if(!req.session.userid){res.redirect('/'); return;}
  res.render('quiz', {session:req.session})
});


app.get('/itinerary', function(req, res) {
  if(!req.session.userid){res.redirect('/'); return;}
  if(!req.session.age ||!req.session.interest){res.redirect('/chat'); return;}
  Interest.findOne({where: {name: req.session.interest}}).then(interest => {
    interest.getActivities().then(activities => {
      res.render('itinerary', {session:req.session, activities:activities})

    });
  });
});

app.get('/saveset', function(req, res) {
  if(!req.session.userid){res.redirect('/'); return;}
  console.log(req.query)
  req.session.interest = req.query.interest
  req.session.age = req.query.age
  res.redirect('itinerary')
});


app.get("/activities", function (req, res) {
  var dbActivities=[];
  Activity.findAll().then(async function(activities) {
    for (var j=0; j < activities.length; j++) {
      var activity = activities[j];
      var interests = await activity.getInterests();

      var interest_str = interests.map(interest => interest.name).join(", ")
      dbActivities.push([activity.name, activity.description, interest_str, activity.min_age, activity.max_age]);
    };


    res.render('activities', {session:req.session, activities:dbActivities})

  });
});

app.get("/woot", function (req, res) {
  var dbActivities=[];
  Activity.findAll().then(async function(activities) {
    for (var j=0; j < activities.length; j++) {
      var activity = activities[j];
      var interests = await activity.getInterests();
      var interest_str = interests.map(interest => interest.name).join(", ")

      dbActivities.push([activity.name, activity.description, interest_str, activity.min_age, activity.max_age]);
    };


    res.render('activities', {session:req.session, activities:dbActivities})

  });
});

//[Op.gt]:
app.get("/activitiesbyinterest", function (req, res) {
  Interest.findOne({where: {name: "Biology"}}).then(interest => {
      interest.getActivities().then(activities => {
      res.render('activities', {session:req.session, activities:activities})
      //, min_age: {[Op.lte]:11}, max_age: {[Op.gte]:11}
    });
  });
});



const listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});