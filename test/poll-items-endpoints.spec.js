const knex = require('knex');
const supertest = require('supertest');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Poll Items Endpoints', () => {
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

  describe('GET /api/items/poll/:poll_id', () => {
    context('Given no items', () => {
      beforeEach('seed other tables', () => helpers.seedWhatsForLunchTables(db, testUsers, testPolls));

      it('responds with 200 and an empty list', () => {
        const pollId = testPolls[0].id;
        return supertest(app)
          .get(`/api/items/poll/${pollId}`)
          .expect(200, []);
      });
    });

    context('Given there are items in the database', () => {
      beforeEach('seed tables', () =>
        helpers.seedWhatsForLunchTables(
          db,
          testUsers,
          testPolls,
          testPollItems,
        )
      );

      it('responds with 200 and items for the requested poll', () => {
        const expectedItems = testPollItems.filter(item => item.poll_id === testPolls[0].id);
        return supertest(app)
          .get(`/api/items/poll/${testPolls[0].id}`)
          .expect(200, expectedItems);
      });
    });

    context('Given an item with XSS content', () => {
      const testUser = testUsers[0];
      const testPoll = testPolls[0];
      const {
        maliciousPollItem,
        expectedPollItem,
      } = helpers.makeMaliciousPollItem(testPoll);

      beforeEach('insert malicious item', () => {
        return helpers.seedMaliciousPollItem(
          db,
          testUser,
          testPoll,
          maliciousPollItem,
        );
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/items/poll/${testPoll.id}`)
          .expect(200)
          .expect(res => {
            expect(res.body[0].item_name).to.eql(expectedPollItem.item_name);
            expect(res.body[0].item_address).to.eql(expectedPollItem.item_address);
            expect(res.body[0].item_cuisine).to.eql(expectedPollItem.item_cuisine);
            expect(res.body[0].item_link).to.eql(expectedPollItem.item_link);
          });
      });
    });
  });

  describe('POST /api/items/poll/:poll_id', () => {
    beforeEach('seed other tables', () => helpers.seedWhatsForLunchTables(db, testUsers, testPolls));

    context('Unhappy paths', () => {
      it(`responds with 400 when 'item_name' is missing`, () => {
        const newItemMissingName = {
          ...testPollItems[0],
          item_name: null
        };

        return supertest(app)
          .post(`/api/items/poll/${newItemMissingName.poll_id}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send([newItemMissingName])
          .expect(400, { error: `Missing 'item_name' in request body` });
      });

      it(`responds with 400 when 'item_link' is not a valid URL`, () => {
        const itemInvalidLink = {
          ...testPollItems[0],
          item_link: 'invalid.com'
        };

        return supertest(app)
          .post(`/api/items/poll/${itemInvalidLink.poll_id}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send([itemInvalidLink])
          .expect(400, { error: 'Link is not a valid URL' });
      });

      it(`responds with 403 when logged-in user doesn't match poll owner`, () => {
        const newItem = testPollItems[0];
        return supertest(app)
          .post(`/api/items/poll/${newItem.poll_id}`)
          .send([newItem])
          .expect(403, { error: 'Poll belongs to a different user' });
      });
    });

    context('Happy path', () => {
      it('responds 201, serialized item', () => {
        const poll = testPolls[3];
        const newItem = [
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
          .post(`/api/items/poll/${poll.id}`)
          .send(newItem)
          .expect(201)
          .expect(res => {
            const items = res.body;
            for (let i = 0; i < items.length; i++) {
              expect(items[i]).to.have.property('id');
              expect(items[i].item_name).to.eql(newItem[i].item_name);
              expect(items[i].item_address).to.eql(newItem[i].item_address);
              expect(items[i].item_cuisine).to.eql(newItem[i].item_cuisine);
              expect(items[i].item_link).to.eql(newItem[i].item_link);
              expect(items[i].item_votes).to.eql(0);
              expect(items[i].poll_id).to.eql(poll.id);
              const expectedDateCreated = new Date().toLocaleString();
              const actualDateCreated = new Date(items[i].date_created).toLocaleString();
              expect(actualDateCreated).to.eql(expectedDateCreated);            
            }
          })
          .expect(res => {
            const items = res.body;
            for (let i = 0; i < items.length; i++) {
              db
                .from('whatsforlunch_poll_items')
                .select('*')
                .where({ id: items[i].id })
                .first()
                .then(row => {
                  expect(row.item_name).to.eql(newItem[i].item_name);
                  expect(row.item_address).to.eql(newItem[i].item_address);
                  expect(row.item_cuisine).to.eql(newItem[i].item_cuisine);
                  expect(row.item_link).to.eql(newItem[i].item_link);
                  expect(row.item_votes).to.eql(0);
                  expect(row.poll_id).to.eql(poll.id);
                  const expectedDBDateCreated = new Date().toLocaleString();
                  const actualDBDateCreated = new Date(row.date_created).toLocaleString();
                  expect(actualDBDateCreated).to.eql(expectedDBDateCreated);
                });
            }
          });
      });
    });
  });

  describe('PATCH /api/items/:id', () => {
    context('Given no items', () => {
      beforeEach('insert users', () => helpers.seedUsers(db, testUsers));

      it('responds with 404', () => {
        const itemId = 123456;
        return supertest(app)
          .patch(`/api/items/${itemId}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(404, { error: `Item doesn't exist` });
      });
    });

    context('Given there are items in the database', () => {
      beforeEach('seed tables', () =>
        helpers.seedWhatsForLunchTables(
          db,
          testUsers,
          testPolls,
          testPollItems,
        )
      );

      it('responds 204 and updates item', () => {
        const itemToUpdate = testPollItems[0];
        const updateFields = {
          item_name: 'updated item name',
          item_address: 'updated item address',
          item_cuisine: 'updated item cuisine',
          item_link: 'updated item link',
        };

        const expectedItem = {
          ...itemToUpdate,
          ...updateFields,
        };

        return supertest(app)
          .patch(`/api/items/${itemToUpdate.id}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send(updateFields)
          .expect(204)
          .then(res =>
            supertest(app)
              .get(`/api/items/poll/${itemToUpdate.poll_id}`)
              .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
              .expect(res => {
                const item = res.body.find(item => item.id === itemToUpdate.id);
                expect(item).to.eql(expectedItem);
              })
          );
      });

      it('responds with 403 Forbidden if referenced poll belongs to different user', () => {
        const item = testPollItems[0];
        const poll = testPolls.find(poll => poll.id === item.poll_id);
        const wrongUser = testUsers.find(user => user.id !== poll.user_id);
        return supertest(app)
          .patch(`/api/items/${item.id}`)
          .set('Authorization', helpers.makeAuthHeader(wrongUser))
          .send({ item_name: 'this request will fail' })
          .expect(403, { error: 'Poll belongs to a different user' });
      });

      it('responds with 400 when no required fields supplied', () => {
        const idToUpdate = testPollItems[0].id;
        return supertest(app)
          .patch(`/api/items/${idToUpdate}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send({ irrelevantField: 'foo' })
          .expect(400, { error: `Request body must contain one of 'item_name', 'item_address', 'item_cuisine', or 'item_link'` });
      });

      it('responds 204 when updating only a subset of fields', () => {
        const itemToUpdate = testPollItems[0];
        const updateFields = {
          item_name: 'Updated item name',
        };

        const expectedItem = {
          ...itemToUpdate,
          ...updateFields,
        };

        return supertest(app)
          .patch(`/api/items/${itemToUpdate.id}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send({
            ...updateFields,
            fieldToIgnore: 'should not be in GET response',
          })
          .expect(204)
          .then(res =>
            supertest(app)
              .get(`/api/items/poll/${itemToUpdate.poll_id}`)
              .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
              .expect(res => {
                const item = res.body.find(item => item.id === itemToUpdate.id);
                expect(item).to.eql(expectedItem);
              })  
          );
      });
    });
  });

  describe('DELETE /api/items/:id', () => {
    context('Given no items', () => {
      beforeEach('insert users', () => helpers.seedUsers(db, testUsers));

      it('responds with 404', () => {
        const itemId = 123456;
        return supertest(app)
          .delete(`/api/items/${itemId}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(404, { error: `Item doesn't exist` });
      });
    });

    context('Given there are items in the database', () => {
      beforeEach('seed tables', () =>
        helpers.seedWhatsForLunchTables(
          db,
          testUsers,
          testPolls,
          testPollItems,
        )
      );

      it('responds 204 and removes the item', () => {
        const itemToRemove = testPollItems[2];
        const poll = testPolls.find(poll => poll.id === itemToRemove.poll_id);
        const user = testUsers.find(user => user.id === poll.user_id);
        const expectedItems = testPollItems.filter(item => (
          item.poll_id === poll.id && item.id !== itemToRemove.id
        ));

        return supertest(app)
          .delete(`/api/items/${itemToRemove.id}`)
          .set('Authorization', helpers.makeAuthHeader(user))
          .expect(204)
          .then(res =>
            supertest(app)
              .get(`/api/items/poll/${poll.id}`)
              .set('Authorization', helpers.makeAuthHeader(user))
              .expect(expectedItems)
          );
      });

      it('responds with 403 forbidden if referenced poll belongs to a different user', () => {
        const item = testPollItems[0];
        const poll = testPolls.find(poll => poll.id === item.poll_id);
        const wrongUser = testUsers.find(user => user.id !== poll.user_id);
        return supertest(app)
          .delete(`/api/items/${item.id}`)
          .set('Authorization', helpers.makeAuthHeader(wrongUser))
          .expect(403, { error: 'Poll belongs to a different user' });
      });
    });
  });

  describe('PATCH /api/items/vote/:id', () => {
    context('Given no items', () => {

      it('responds with 404', () => {
        const itemId = 123456;
        return supertest(app)
          .patch(`/api/items/vote/${itemId}`)
          .expect(404, { error: `Item doesn't exist` });
      });
    });

    context('Given there are items in the database', () => {
      beforeEach('seed tables', () =>
        helpers.seedWhatsForLunchTables(
          db,
          testUsers,
          testPolls,
          testPollItems,
        )
      );

      it('responds 204 and updates vote count', () => {
        const itemToVote = testPollItems[0];
        const expectedItem = {
          ...itemToVote,
          item_votes: itemToVote.item_votes + 1,
        };

        return supertest(app)
          .patch(`/api/items/vote/${itemToVote.id}`)
          .expect(204)
          .then(res =>
            supertest(app)
              .get(`/api/items/poll/${itemToVote.poll_id}`)
              .expect(res => {
                const item = res.body.find(item => item.id === itemToVote.id);
                expect(item).to.eql(expectedItem);
              })
          );
      });
    });
  });

  describe('PATCH /api/items/resetVotes/:poll_id', () => {
    context('Given no polls', () => {
      beforeEach('insert users', () => helpers.seedUsers(db, testUsers));

      it('responds with 404', () => {
        const pollId = 123456;
        return supertest(app)
          .patch(`/api/items/resetVotes/${pollId}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(404, { error: `Poll doesn't exist` })
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

      it('responds 204 and resets vote counts', () => {
        const idToUpdate = testPolls[0].id;
        const user = testUsers.find(user => user.id === testPolls[0].user_id);
        return supertest(app)
          .patch(`/api/items/resetVotes/${idToUpdate}`)
          .set('Authorization', helpers.makeAuthHeader(user))
          .expect(204)
          .then(res =>
            supertest(app)
            .get(`/api/items/poll/${idToUpdate}`)
            .expect(res => {
              res.body.forEach(item => {
                expect(item.item_votes).to.eql(0);
              });
            })
          );
      });
    });
  });
});