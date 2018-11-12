const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid')
const cors = require('cors')

const mongoose = require('mongoose')
const mongoist = require('mongoist');
// mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

const db = mongoist(process.env.MONGO_URI, { useNewUrlParser: true });

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', async (req, res) => {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'No username is provided' });
  }

  const [queryResults] = await db.exerciseTrackerUsers.find({ username });
  if (queryResults) {
    return res.json({ error: 'username already taken' });
  }

  const insertResults = await db.exerciseTrackerUsers.insert({
    _id: shortid.generate(),
    username
  });

  res.json(insertResults);
});

app.post('/api/exercise/add', async (req, res) => {
  const {
    userId,
    description,
    duration,
    date
  } = req.body;
  
  if (!userId || userId.trim() === '') {
    return res.status(400).json({ error: 'Invalid userId is provided' });
  }
  
  const [validUserID] = await db.exerciseTrackerUsers.find({ _id: userId });
  if (!validUserID) {
    return res.status(400).json({ error: 'Invalid userId is provided' });
  }

  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'Invalid description is provided' });
  }
  
  if (!duration || duration.trim() === '' || !parseFloat(duration)) {
    return res.status(400).json({ error: 'Invalid duration is provided' });
  }
  
  const validDate = (new Date(date)).toString() === 'Invalid Date' ? new Date() : new Date(date);
  const insertResults = await db.exerciseTrackerLogs.insert({
    userId,
    description,
    duration,
    date: validDate
  });

  res.json({
    userId: insertResults.userId,
    description: insertResults.description,
    duration: insertResults.duration,
    date: insertResults.date
  });
});

app.get('/api/exercise/log', async (req, res) => {
  const {
    userId,
    from,
    to,
    limit
  } = req.query;

  if (!userId || userId.trim() === '') {
    return res.status(400).json({ error: 'Invalid userId is provided' });
  }
  
  const [validUserID] = await db.exerciseTrackerUsers.find({ _id: userId });
  if (!validUserID) {
    return res.status(400).json({ error: 'Invalid userId is provided' });
  }

  if (from && (new Date(from)).toString() === 'Invalid Date') {
    return res.status(400).json({ error: 'Invalid date is specified for the parameter from' });
  }
  
  if (to && (new Date(to)).toString() === 'Invalid Date') {
    return res.status(400).json({ error: 'Invalid date is specified for the parameter to' });
  }
  
  if (limit && isNaN(parseInt(limit, 10))) {
    return res.status(400).json({ error: 'Invalid date is specified for the parameter limit' });
  }
  
  const queryObject = { userId };
  if (from || to ) {
    queryObject.date = {};
    if (from) {
      queryObject.date['$gte'] = new Date(from);
    }
    if (to) {
      queryObject.date['$lte'] = new Date(to);
    }
  }

  const exercises = await db.exerciseTrackerLogs
    .findAsCursor(queryObject)
    .limit(parseInt(limit, 10) || 0)
    .toArray();

  const filterexExercises = exercises.map(e => ({
    description: e.description,
    duration: e.duration,
    date: e.date
  }));

  res.json({
    _id: userId,
    count: filterexExercises.length,
    log: filterexExercises
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
