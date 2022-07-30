const createError = require('http-errors');
const express = require('express');
const logger = require('morgan');

const v1 = require('./v1')
const v2 = require('./v2')
const tron = require('./tron')
const xrp = require('./xrp')

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/v1/xrp', xrp);
app.use('/v1/tron', tron);
app.use('/v1', v1);
app.use('/v2', v2);

app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  console.error(err)
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.json(err);
});

module.exports = app;