require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const { NODE_ENV, CLIENT_ORIGIN } = require('./config');
const authRouter = require('./auth/auth-router');
const usersRouter = require('./users/users-router');
const pollsRouter = require('./polls/polls-router');
const pollItemsRouter = require('./poll-items/poll-items-router');

const app = express();

const morganOption = NODE_ENV === 'production' ? 'tiny' : 'dev';

app.use(morgan(morganOption, {
  skip: () => NODE_ENV === 'test',
}));

app.use(helmet());

app.use(
  cors({
    origin: CLIENT_ORIGIN,
  }),
);

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/polls', pollsRouter);
app.use('/api/items', pollItemsRouter);

app.use((error, req, res, next) => {
  let response;
  if (NODE_ENV === 'production') {
    response = { error: { message: 'server error' } };
  } else {
    console.error(error);
    response = { message: error.message, error };
  }
  res.status(500).json(response);
});

module.exports = app;
