const { expect } = require('chai');
const knex = require('knex');
const supertest = require('supertest');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Polls Endpoints', () => {
  let db;

  const {
    testUsers,
    testPolls
  } = helpers.makeWhatsForLunchFixtures();

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL
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
          testPolls
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
        expectedPoll
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
    beforeEach('insert users', () => helpers.seedUsers(db, testUsers));

    context('Unhappy path', () => {
      it(`responds with 400 when 'end_time' is missing`, () => {
        const newPollMissingTime = {
          ...testPolls[0],
          end_time: null
        };
        return supertest(app)
          .post('/api/polls')
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .send(newPollMissingTime)
          .expect(400, { error: `Missing 'end_time' in request body` });
      });
    });

    context('Happy path', () => {
      it('responds 201, serialized poll', () => {
        const newPoll = {
          poll_name: 'test poll_name',
          end_time: '2029-01-22T16:28:32.615Z'
        };
        return supertest(app)
          .post('/api/polls')
          .send(newPoll)
          .expect(201)
          .expect(res => {
            expect(res.body).to.have.property('id');
            expect(res.body.poll_name).to.eql(newPoll.poll_name);
            expect(res.body.user_id).to.be.null;
            const expectedEndTime = new Date(newPoll.end_time).toLocaleString();
            const actualEndTime = new Date(res.body.end_time).toLocaleString();
            expect(actualEndTime).to.eql(expectedEndTime);
            const expectedDateCreated = new Date().toLocaleString();
            const actualDateCreated = new Date(res.body.date_created).toLocaleString();
            expect(actualDateCreated).to.eql(expectedDateCreated);
          })
          .expect(res =>
            db
              .from('whatsforlunch_polls')  
              .select('*')
              .where({ id: res.body.id })
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
        )
      );

      it('responds with 200 and the specified poll', () => {
        const pollId = 1;
        const expectedPoll = testPolls[pollId - 1];
        return supertest(app)
          .get(`/api/polls/${pollId}`)
          .expect(200, expectedPoll);
      });
    });

    context('Given poll with XSS attack content', () => {
      const testUser = testUsers[0];
      const {
        maliciousPoll,
        expectedPoll
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
          .get(`/api/polls/${maliciousPoll.id}`)
          .expect(200)
          .expect(res => {
            expect(res.body.poll_name).to.eql(expectedPoll.poll_name);
          });
      });
    });
  });

  
})