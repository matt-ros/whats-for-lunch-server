const xss = require('xss');

const PollsService = {
  getAllPollsByUserId(db, user_id) {
    return db('whatsforlunch_polls')
      .select('*')
      .where({ user_id });
  },

  getPollById(db, id) {
    return db('whatsforlunch_polls')
      .where({ id })
      .first();
  },

  insertPoll(db, newPoll) {
    return db
      .insert(newPoll)
      .into('whatsforlunch_polls')
      .returning('*')
      .then(([poll]) => poll);
  },

  updatePoll(db, id, newPollFields) {
    return db('whatsforlunch_polls')
      .where({ id })
      .update(newPollFields);
  },

  deletePoll(db, id) {
    return db('whatsforlunch_polls')
      .where({ id })
      .delete();
  },

  serializePoll(poll) {
    return {
      id: poll.id,
      poll_name: xss(poll.poll_name),
      end_time: new Date(poll.end_time),
      date_created: new Date(poll.date_created),
      user_id: poll.user_id,
    };
  },

  serializePolls(polls) {
    return polls.map(this.serializePoll);
  },
}

module.exports = PollsService;
