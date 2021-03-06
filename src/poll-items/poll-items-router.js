const express = require('express');
const path = require('path');
const PollItemsService = require('./poll-items-service');
const PollsService = require('../polls/polls-service');
const { requireAuth } = require('../middleware/jwt-auth');

const pollItemsRouter = express.Router();
const jsonBodyParser = express.json();

pollItemsRouter
  .route('/poll/:poll_id')
  .post(checkIfLoggedIn, checkPollBelongsToUser, jsonBodyParser, (req, res, next) => {
    const newItems = req.body;
    for (let i = 0; i < newItems.length; i++) {
      const {
        item_name, item_address, item_cuisine, item_link, item_votes,
      } = newItems[i];
      if (!item_name) {
        return res.status(400).json({
          error: 'Missing \'item_name\' in request body',
        });
      }

      if (item_link) {
        try {
          new URL(newItems[i].item_link).toString();
        } catch (error) {
          return res.status(400).json({
            error: 'Link is not a valid URL',
          });
        }
      }

      const newItem = {
        item_name,
        item_address,
        item_cuisine,
        item_link,
        item_votes,
        date_created: 'now()',
        poll_id: req.params.poll_id,
      };

      newItems[i] = newItem;
    }

    return PollItemsService.insertItem(
      req.app.get('db'),
      newItems,
    )
      .then((item) => {
        res
          .status(201)
          .location(path.posix.join(req.originalUrl, `/${item.id}`))
          .json(PollItemsService.serializeItems(item));
      })
      .catch(next);
  });

pollItemsRouter
  .route('/:id')
  .all(requireAuth)
  .all(checkItemExists)
  .all(checkPollBelongsToUser)
  .delete((req, res, next) => {
    PollItemsService.deleteItem(
      req.app.get('db'),
      req.params.id,
    )
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  });

pollItemsRouter
  .route('/vote/:id')
  .patch(checkItemExists, (req, res, next) => {
    const updateFields = {
      item_votes: res.item.item_votes + 1,
    };

    PollItemsService.updateItem(
      req.app.get('db'),
      req.params.id,
      updateFields,
    )
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  });

async function checkItemExists(req, res, next) {
  try {
    const item = await PollItemsService.getItemById(
      req.app.get('db'),
      req.params.id,
    );

    if (!item) {
      return res.status(404).json({
        error: 'Item doesn\'t exist',
      });
    }

    res.item = item;
    next();
  } catch (error) {
    next(error);
  }
}

async function checkPollBelongsToUser(req, res, next) {
  const pollId = (res.item) ? res.item.poll_id : req.params.poll_id;
  try {
    const poll = await PollsService.getPollById(
      req.app.get('db'),
      pollId,
    );

    if (!poll) {
      return res.status(404).json({
        error: 'Poll doesn\'t exist',
      });
    }

    if (poll.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Poll belongs to a different user',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

async function checkIfLoggedIn(req, res, next) {
  if (req.get('Authorization')) {
    requireAuth(req, res, next);
  } else {
    req.user = { id: null };
    next();
  }
}

module.exports = pollItemsRouter;
