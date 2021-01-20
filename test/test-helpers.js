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

function makePollItemsArray(polls) {
  return [
    {
      id: 1,
      item_name: 'test item 1',
      item_address: 'test item address 1',
      item_cuisine: 'test item cuisine 1',
      item_link: 'test item link 1',
      item_votes: 3,
      date_created: '2029-01-22T16:28:32.615Z',
      poll_id: polls[0].id
    },
    {
      id: 2,
      item_name: 'test item 2',
      item_address: 'test item address 2',
      item_cuisine: 'test item cuisine 2',
      item_link: 'test item link 2',
      item_votes: 2,
      date_created: '2029-01-22T16:28:32.615Z',
      poll_id: polls[0].id
    },
    {
      id: 3,
      item_name: 'test item 3',
      item_address: 'test item address 3',
      item_cuisine: 'test item cuisine 3',
      item_link: 'test item link 3',
      item_votes: 0,
      date_created: '2029-01-22T16:28:32.615Z',
      poll_id: polls[1].id
    },
    {
      id: 4,
      item_name: 'test item 4',
      item_address: 'test item address 4',
      item_cuisine: 'test item cuisine 4',
      item_link: 'test item link 4',
      item_votes: 4,
      date_created: '2029-01-22T16:28:32.615Z',
      poll_id: polls[1].id
    },
    {
      id: 5,
      item_name: 'test item 5',
      item_address: 'test item address 5',
      item_cuisine: 'test item cuisine 5',
      item_link: 'test item link 5',
      item_votes: 6,
      date_created: '2029-01-22T16:28:32.615Z',
      poll_id: polls[2].id
    },
    {
      id: 6,
      item_name: 'test item 6',
      item_address: 'test item address 6',
      item_cuisine: 'test item cuisine 6',
      item_link: 'test item link 6',
      item_votes: 1,
      date_created: '2029-01-22T16:28:32.615Z',
      poll_id: polls[2].id
    },
    {
      id: 7,
      item_name: 'test item 7',
      item_address: 'test item address 7',
      item_cuisine: 'test item cuisine 7',
      item_link: 'test item link 7',
      item_votes: 3,
      date_created: '2029-01-22T16:28:32.615Z',
      poll_id: polls[3].id
    },
    {
      id: 8,
      item_name: 'test item 8',
      item_address: 'test item address 8',
      item_cuisine: 'test item cuisine 8',
      item_link: 'test item link 8',
      item_votes: 2,
      date_created: '2029-01-22T16:28:32.615Z',
      poll_id: polls[3].id
    },
  ];
}

function makeWhatsForLunchFixtures() {
  const testUsers = makeUsersArray();
  const testPolls = makePollsArray(testUsers);
  const testPollItems = makePollItemsArray(testPolls);
  return { testUsers, testPolls, testPollItems };
}

function cleanTables(db) {
  return db.raw(
    `TRUNCATE
      whatsforlunch_users,
      whatsforlunch_polls,
      whatsforlunch_poll_items
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

function seedWhatsForLunchTables(db, users, polls = [], pollItems = []) { // add other tables as created
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
    if (pollItems.length) {
      await trx.into('whatsforlunch_poll_items').insert(pollItems)
      // update auto sequence to match forced id values
      await trx.raw(
        `SELECT setval('whatsforlunch_poll_items_id_seq', ?)`,
        [pollItems[pollItems.length - 1].id]
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

function makeMaliciousPollItem(poll) {
  const maliciousPollItem = {
    id: 911,
    item_name: 'Naughty naughty very naughty <script>alert("xss");</script>',
    item_address: 'Naughty naughty very naughty <script>alert("xss");</script>',
    item_cuisine: 'Naughty naughty very naughty <script>alert("xss");</script>',
    item_link: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`,
    item_votes: 10,
    poll_id: poll.id
  };
  const expectedPollItem = {
    ...maliciousPollItem,
    item_name: 'Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;',
    item_address: 'Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;',
    item_cuisine: 'Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;',
    item_link: `Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`
  };
  return {
    maliciousPollItem,
    expectedPollItem
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

function seedMaliciousPollItem(db, user, poll, pollItem) {
  return seedWhatsForLunchTables(db, [user], [poll], [pollItem]);
}

module.exports = {
  makeUsersArray,
  makePollsArray,
  makePollItemsArray,
  makeWhatsForLunchFixtures,
  cleanTables,
  seedUsers,
  seedWhatsForLunchTables,
  makeAuthHeader,
  makeMaliciousUser,
  makeMaliciousPoll,
  makeMaliciousPollItem,
  seedMaliciousUser,
  seedMaliciousPoll,
  seedMaliciousPollItem,
}