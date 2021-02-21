const { expect } = require('chai');
const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Polls Endpoints', () => {
  let db;

  const {
    testUsers,
    testPolls,
    testPollItems,
  } = helpers.makeWhatsForLunchFixtures();

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('cleanup', () => helpers.cleanTables(db));

  afterEach('cleanup', () => helpers.cleanTables(db));

  describe('GET /api/polls', () => {
    context('Given no polls', () => {
      beforeEach('insert users', () => helpers.seedUsers(db, testUsers));

      it('responds with 200 and an empty list', () => {
        return supertest(app)
          .get('/api/polls')
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(200, []);
      });
    });

    context('Given there are polls in the database', () => {
      beforeEach('seed tables', () =>
        helpers.seedWhatsForLunchTables(
          db,
          testUsers,
          testPolls,
        )
      );

      it('responds with 200 and polls for the logged in user', () => {
        const expectedPolls = testPolls.filter(poll => poll.user_id === testUsers[0].id);
        return supertest(app)
          .get('/api/polls')
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(200, expectedPolls);
      });
    });

    context('Given a poll with XSS content', () => {
      const testUser = testUsers[0];
      const {
        maliciousPoll,
        expectedPoll,
      } = helpers.makeMaliciousPoll(testUser);

      beforeEach('insert malicious poll', () => {
        return helpers.seedMaliciousPoll(
          db,
          testUser,
          maliciousPoll,         
        );
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get('/api/polls')
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(200)
          .expect(res => {
            expect(res.body[0].poll_name).to.eql(expectedPoll.poll_name);
          });
      });
    });
  });

  describe('POST /api/polls', () => {
    context('Unhappy polls', () => {
      beforeEach('insert users', () => helpers.seedUsers(db, testUsers));

      it(`responds with 400 when 'end_time' is missing`, () => {
        const newPollMissingTime = {
          ...testPolls[0],
          end_time: null,
        };

        return supertest(app)
          .post('/api/polls')
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send({ poll: newPollMissingTime, items: [] })
          .expect(400, { error: `Missing 'end_time' in request body` });
      });
    });

    context('Unhappy items', () => {
      beforeEach('seed other tables', () => helpers.seedWhatsForLunchTables(db, testUsers, testPolls));

      it(`responds with 400 when 'item_name' is missing`, () => {
        const newItemMissingName = {
          ...testPollItems[0],
          item_name: null
        };

        return supertest(app)
          .post('/api/polls')
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send({ poll: testPolls[0], newItems: [newItemMissingName] })
          .expect(400, { error: `Missing 'item_name' in request body` });
      });

      it(`responds with 400 when 'item_link' is not a valid URL`, () => {
        const itemInvalidLink = {
          ...testPollItems[0],
          item_link: 'invalid.com'
        };

        return supertest(app)
          .post('/api/polls')
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send({ poll: testPolls[0], newItems: [itemInvalidLink] })
          .expect(400, { error: 'Link is not a valid URL' });
      });
    });

    context('Happy path', () => {
      it('responds 201, serialized poll and items', () => {
        const newPoll = {
          poll_name: 'test poll_name',
          end_time: '2029-01-22T16:28:32.615Z'
        };

        const newItems = [
          {
            item_name: 'test item name 1',
            item_address: 'test item address 1',
            item_cuisine: 'test item cuisine 1',
            item_link: 'http://example.com',
          },

          {
            item_name: 'test item name 2',
            item_address: 'test item address 2',
            item_cuisine: 'test item cuisine 2',
            item_link: 'http://example.com',
          },
        ];

        return supertest(app)
          .post('/api/polls')
          .send({ newItems, poll: newPoll, })
          .expect(201)
          .expect(res => {
            const { poll, items } = res.body;
            expect(poll).to.have.property('id');
            expect(poll.poll_name).to.eql(newPoll.poll_name);
            expect(poll.user_id).to.be.null;
            const expectedEndTime = new Date(newPoll.end_time).toLocaleString();
            const actualEndTime = new Date(poll.end_time).toLocaleString();
            expect(actualEndTime).to.eql(expectedEndTime);
            const expectedDateCreated = new Date().toLocaleString();
            const actualDateCreated = new Date(poll.date_created).toLocaleString();
            expect(actualDateCreated).to.eql(expectedDateCreated);
            for (let i = 0; i < items.length; i++) {
              expect(items[i]).to.have.property('id');
              expect(items[i].item_name).to.eql(newItems[i].item_name);
              expect(items[i].item_address).to.eql(newItems[i].item_address);
              expect(items[i].item_cuisine).to.eql(newItems[i].item_cuisine);
              expect(items[i].item_link).to.eql(newItems[i].item_link);
              expect(items[i].item_votes).to.eql(0);
              expect(items[i].poll_id).to.eql(poll.id);
              const expectedDateCreated = new Date().toLocaleString();
              const actualDateCreated = new Date(items[i].date_created).toLocaleString();
              expect(actualDateCreated).to.eql(expectedDateCreated);            
            }
          })
          .expect(res => {
            const { items } = res.body;
            for (let i = 0; i < items.length; i++) {
              db
                .from('whatsforlunch_poll_items')
                .select('*')
                .where({ id: items[i].id })
                .first()
                .then(row => {
                  expect(row.item_name).to.eql(newItems[i].item_name);
                  expect(row.item_address).to.eql(newItems[i].item_address);
                  expect(row.item_cuisine).to.eql(newItems[i].item_cuisine);
                  expect(row.item_link).to.eql(newItems[i].item_link);
                  expect(row.item_votes).to.eql(0);
                  expect(row.poll_id).to.eql(res.body.poll.id);
                  const expectedDBDateCreated = new Date().toLocaleString();
                  const actualDBDateCreated = new Date(row.date_created).toLocaleString();
                  expect(actualDBDateCreated).to.eql(expectedDBDateCreated);
                });
            }
          })
          .expect(res =>
            db
              .from('whatsforlunch_polls')  
              .select('*')
              .where({ id: res.body.poll.id })
              .first()
              .then(row => {
                expect(row.poll_name).to.eql(newPoll.poll_name);
                expect(row.user_id).to.be.null;
                const expectedDBEndTime = new Date(newPoll.end_time).toLocaleString();
                const actualDBEndTime = new Date(row.end_time).toLocaleString();
                expect(actualDBEndTime).to.eql(expectedDBEndTime);
                const expectedDBDateCreated = new Date().toLocaleString();
                const actualDBDateCreated = new Date(row.date_created).toLocaleString();
                expect(actualDBDateCreated).to.eql(expectedDBDateCreated);
              })
          );
      });
    });
  });

  describe('GET /api/polls/:id', () => {
    context('Given no polls', () => {
      beforeEach(() => helpers.seedUsers(db, testUsers));

      it('responds with 404', () => {
        const pollId = 123456;
        return supertest(app)
          .get(`/api/polls/${pollId}`)
          .expect(404, { error: `Poll doesn't exist` });
      });
    });

    context('Given there are polls in the database', () => {
      beforeEach('seed tables', () =>
        helpers.seedWhatsForLunchTables(
          db,
          testUsers,
          testPolls,
          testPollItems,
        )
      );

      it('responds with 200 and the specified poll and items', () => {
        const pollId = 1;
        const expectedPoll = testPolls[pollId - 1];
        const expectedItems = testPollItems.filter(item => item.poll_id === pollId);
        return supertest(app)
          .get(`/api/polls/${pollId}`)
          .expect(200, {
            poll: expectedPoll,
            items: expectedItems,
          });
      });
    });

    context('Given poll and item with XSS attack content', () => {
      const testUser = testUsers[0];
      const {
        maliciousPoll,
        expectedPoll,
      } = helpers.makeMaliciousPoll(testUser);

      const {
        maliciousPollItem,
        expectedPollItem,
      } = helpers.makeMaliciousPollItem(maliciousPoll);

      beforeEach('insert malicious poll and item', () => {
        return helpers.seedMaliciousPollItem(
          db,
          testUser,
          maliciousPoll,
          maliciousPollItem,
        );
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/polls/${maliciousPoll.id}`)
          .expect(200)
          .expect(res => {
            expect(res.body.poll.poll_name).to.eql(expectedPoll.poll_name);
            expect(res.body.items[0].item_name).to.eql(expectedPollItem.item_name);
            expect(res.body.items[0].item_address).to.eql(expectedPollItem.item_address);
            expect(res.body.items[0].item_cuisine).to.eql(expectedPollItem.item_cuisine);
            expect(res.body.items[0].item_link).to.eql(expectedPollItem.item_link);
          });
      });
    });
  });

  describe('PATCH /api/polls/:id', () => {
    context('Given no polls', () => {
      beforeEach('insert users', () => helpers.seedUsers(db, testUsers));

      it('responds with 404', () => {
        const pollId = 123456;
        return supertest(app)
          .patch(`/api/polls/${pollId}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(404, { error: `Poll doesn't exist` });
      });
    });

    context('Given there are polls in the database', () => {
      beforeEach('seed tables', () =>
        helpers.seedWhatsForLunchTables(
          db,
          testUsers,
          testPolls,
          testPollItems,
        )
      );

      it('responds 204 and updates poll and resets votes', () => {
        const pollToUpdate = testPolls[0];
        const updateFields = {
          poll_name: 'updated poll name',
          end_time: '2020-01-22T16:28:32.615Z'
        };

        const expectedPoll = {
          ...pollToUpdate,
          ...updateFields,
        };

        return supertest(app)
          .patch(`/api/polls/${pollToUpdate.id}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send(updateFields)
          .expect(204)
          .then(res =>
            supertest(app)
              .get(`/api/polls/${pollToUpdate.id}`)
              .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
              .expect(res => {
                const { poll, items } = res.body;
                expect(poll).to.eql(expectedPoll);
                items.forEach(item => {
                  expect(item.item_votes).to.eql(0);
                });
              })
          );
      });

      it('responds with 403 Forbidden if poll belongs to different user', () => {
        const pollId = testPolls[0].id;
        const wrongUser = testUsers.find(user => user.id !== testPolls[0].user_id);
        return supertest(app)
          .patch(`/api/polls/${pollId}`)
          .set('Authorization', helpers.makeAuthHeader(wrongUser))
          .send({ poll_name: 'this request will fail' })
          .expect(403, { error: 'Poll belongs to a different user' });
      });

      it('responds with 400 when no required fields supplied', () => {
        const idToUpdate = testPolls[0].id;
        return supertest(app)
          .patch(`/api/polls/${idToUpdate}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send({ irrelevantField: 'foo' })
          .expect(400, { error: `Request body must contain 'poll_name' or 'end_time'` });
      });

      it('responds 204 when updating only a subset of fields', () => {
        const pollToUpdate = testPolls[0];
        const updateFields = {
          poll_name: 'Updated poll_name',
        };

        const expectedPoll = {
          ...pollToUpdate,
          ...updateFields,
        };

        const expectedItems = (
          testPollItems
            .filter(item => item.poll_id === pollToUpdate.id)
            .map(item => {
              return {
                ...item,
                item_votes: 0,
              };
            })
        );

        return supertest(app)
          .patch(`/api/polls/${pollToUpdate.id}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send({
            ...updateFields,
            fieldToIgnore: 'should not be in GET response',
          })
          .expect(204)
          .then(res =>
            supertest(app)  
              .get(`/api/polls/${pollToUpdate.id}`)
              .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
              .expect({ poll: expectedPoll, items: expectedItems })
          );
      });
    });
  });

  describe('DELETE /api/polls/:id', () => {
    context('Given no polls', () => {
      beforeEach('insert users', () => helpers.seedUsers(db, testUsers));

      it('responds with 404', () => {
        const pollId = 123456;
        return supertest(app)
          .delete(`/api/polls/${pollId}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(404, { error: `Poll doesn't exist` });
      });
    });

    context('Given there are polls in the database', () => {
      beforeEach('seed tables', () =>
        helpers.seedWhatsForLunchTables(
          db,
          testUsers,
          testPolls,
        )
      );

      it('responds 204 and removes the poll', () => {
        const pollToRemove = testPolls[2];
        const user = testUsers.find(user => user.id === pollToRemove.user_id);
        const expectedPolls = testPolls.filter(poll => (
          poll.user_id === user.id && poll.id !== pollToRemove.id
        ));

        return supertest(app)
          .delete(`/api/polls/${pollToRemove.id}`)
          .set('Authorization', helpers.makeAuthHeader(user))
          .expect(204)
          .then(res =>
            supertest(app)  
              .get('/api/polls')
              .set('Authorization', helpers.makeAuthHeader(user))
              .expect(expectedPolls)
          );
      });

      it('responds with 403 Forbidden if poll belongs to a different user', () => {
        const pollId = testPolls[0].id;
        const wrongUser = testUsers.find(user => user.id !== testPolls[0].user_id);
        return supertest(app)
          .delete(`/api/polls/${pollId}`)
          .set('Authorization', helpers.makeAuthHeader(wrongUser))
          .expect(403, { error: 'Poll belongs to a different user' });
      });
    });
  });
});
