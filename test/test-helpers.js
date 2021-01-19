const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function makeUsersArray() {
  return [
    {
      id: 1,
      user_name: 'test-user-1',
      full_name: 'Test user 1',
      password: 'password',
      date_created: '2029-01-22T16:28:32.615Z',
    },
    {
      id: 2,
      user_name: 'test-user-2',
      full_name: 'Test user 2',
      password: 'password',
      date_created: '2029-01-22T16:28:32.615Z',
    },
    {
      id: 3,
      user_name: 'test-user-3',
      full_name: 'Test user 3',
      password: 'password',
      date_created: '2029-01-22T16:28:32.615Z',
    },
    {
      id: 4,
      user_name: 'test-user-4',
      full_name: 'Test user 4',
      password: 'password',
      date_created: '2029-01-22T16:28:32.615Z',
    },
  ]
}

function makePollsArray(users) {
  return [
    {
      id: 1,
      poll_name: 'test-poll-1',
      end_time: '2029-01-22T16:28:32.615Z',
      date_created: '2029-01-22T16:28:32.615Z',
      user_id: users[0].id
    },
    {
      id: 2,
      poll_name: 'test-poll-1',
      end_time: '2029-01-22T16:28:32.615Z',
      date_created: '2029-01-22T16:28:32.615Z',
      user_id: users[3].id
    },
    {
      id: 3,
      poll_name: 'test-poll-1',
      end_time: '2029-01-22T16:28:32.615Z',
      date_created: '2029-01-22T16:28:32.615Z',
      user_id: users[0].id
    },
    {
      id: 4,
      poll_name: 'test-poll-1',
      end_time: '2029-01-22T16:28:32.615Z',
      date_created: '2029-01-22T16:28:32.615Z',
      user_id: null
    },
  ];
}

function makeWhatsForLunchFixtures() {
  const testUsers = makeUsersArray();
  const testPolls = makePollsArray(testUsers);
  return { testUsers, testPolls };
}

function cleanTables(db) {
  return db.raw(
    `TRUNCATE
      whatsforlunch_users,
      whatsforlunch_polls
      RESTART IDENTITY CASCADE`
  );
}

function seedUsers(db, users) {
  const preppedUsers = users.map(user => ({
    ...user,
    password: bcrypt.hashSync(user.password, 1),
  }));
  return db.into('whatsforlunch_users').insert(preppedUsers)
    .then(() =>
      // update the auto sequence to stay in sync
      db.raw(
        `SELECT setval('whatsforlunch_users_id_seq', ?)`,
        [users[users.length - 1].id],
      )
    );
}

function seedWhatsForLunchTables(db, users, polls = []) { // add other tables as created
  // use a transaction to group queries and auto rollback on failure
  return db.transaction(async trx => {
    await seedUsers(trx, users);
    // only insert other tables if they are there, update sequence counters
    if (polls.length) {
      await trx.into('whatsforlunch_polls').insert(polls)
      // update auto sequence to match forced id values
      await trx.raw(
        `SELECT setval('whatsforlunch_polls_id_seq', ?)`,
        [polls[polls.length - 1].id]
      )
    }
  });
}

function makeAuthHeader(user, secret = process.env.JWT_SECRET) {
  const token = jwt.sign({ user_id: user.id }, secret, {
    subject: user.user_name,
    algorithm: 'HS256',
  });
  return `Bearer ${token}`;
}

function makeMaliciousUser() {
  const maliciousUser = {
    id: 911,
    user_name: 'Naughty naughty very naughty <script>alert("xss");</script>',
    full_name: 'Naughty naughty very naughty <script>alert("xss");</script>',
    password: 'password',
    date_created: '2029-01-22T16:28:32.615Z',
  };
  const expectedUser = {
    ...maliciousUser,
    user_name: 'Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;',
    full_name: 'Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;',
  };
  return {
    maliciousUser,
    expectedUser
  };
}

function makeMaliciousPoll(user) {
  const maliciousPoll = {
    id: 911,
    poll_name: 'Naughty naughty very naughty <script>alert("xss");</script>',
    end_time: '2029-01-22T16:28:32.615Z',
    date_created: new Date().toISOString(),
    user_id: user.id
  };
  const expectedPoll = {
    ...maliciousPoll,
    poll_name: 'Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;'
  };
  return {
    maliciousPoll,
    expectedPoll
  };
}

function seedMaliciousUser(db, user) {
  return db.into('whatsforlunch_users').insert(user);
}

function seedMaliciousPoll(db, user, poll) {
  return seedUsers(db, [user])
    .then(() =>
      db
        .into('whatsforlunch_polls')
        .insert([poll])
    );
}

module.exports = {
  makeUsersArray,
  makePollsArray,
  makeWhatsForLunchFixtures,
  cleanTables,
  seedUsers,
  seedWhatsForLunchTables,
  makeAuthHeader,
  makeMaliciousUser,
  makeMaliciousPoll,
  seedMaliciousUser,
  seedMaliciousPoll,
}