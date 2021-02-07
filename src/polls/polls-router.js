const express = require('express');
const path = require('path');
const PollsService = require('./polls-service');
const { requireAuth } = require('../middleware/jwt-auth');

const pollsRouter = express.Router();
const jsonBodyParser = express.json();

pollsRouter
  .route('/')
  .get(requireAuth, (req, res, next) => {
    PollsService.getAllPollsByUserId(
      req.app.get('db'),
      req.user.id,
    )
      .then((polls) => {
        res.json(PollsService.serializePolls(polls));
      })
      .catch(next);
  })

  .post(checkIfLoggedIn, jsonBodyParser, (req, res, next) => {
    const { poll_name, end_time } = req.body;
    if (!end_time) {
      return res.status(400).json({
        error: 'Missing \'end_time\' in request body',
      });
    }

    const newPoll = {
      poll_name,
      end_time,
      date_created: 'now()',
      user_id: (req.user) ? req.user.id : null,
    };

    return PollsService.insertPoll(
      req.app.get('db'),
      newPoll,
    )
      .then((poll) => {
        res
          .status(201)
          .location(path.posix.join(req.originalUrl, `/${poll.id}`))
          .json(PollsService.serializePoll(poll));
      })
      .catch(next);
  });

pollsRouter
  .route('/:id')
  .get(checkPollExists, (req, res, next) => {
    res.json(PollsService.serializePoll(res.poll));
  })

  .patch(requireAuth, checkPollExists, checkPollBelongsToUser, jsonBodyParser, (req, res, next) => {
    const { poll_name, end_time } = req.body;
    const updateFields = { poll_name, end_time };
    const numFields = Object.values(updateFields).filter(Boolean).length;
    if (numFields === 0) {
      return res.status(400).json({
        error: 'Request body must contain \'poll_name\' or \'end_time\'',
      });
    }

    PollsService.updatePoll(
      req.app.get('db'),
      req.params.id,
      updateFields,
    )
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  })

  .delete(requireAuth, checkPollExists, checkPollBelongsToUser, (req, res, next) => {
    PollsService.deletePoll(
      req.app.get('db'),
      req.params.id,
    )
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  });

async function checkPollExists(req, res, next) {
  try {
    const poll = await PollsService.getPollById(
      req.app.get('db'),
      req.params.id,
    );

    if (!poll) {
      return res.status(404).json({
        error: 'Poll doesn\'t exist',
      });
    }

    res.poll = poll;
    next();
  } catch (error) {
    next(error);
  }
}

async function checkPollBelongsToUser(req, res, next) {
  if (res.poll.user_id !== req.user.id) {
    return res.status(403).json({
      error: 'Poll belongs to a different user',
    });
  }
  next();
}

async function checkIfLoggedIn(req, res, next) {
  if (req.get('Authorization')) {
    requireAuth(req, res, next);
  } else {
    next();
  }
}

module.exports = pollsRouter;
