const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Protected Endpoints', () => {
  let db;

  const {
    testUsers,
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

  beforeEach('insert users', () =>
    helpers.seedUsers(
      db,
      testUsers,
    )
  );

  const protectedEndpoints = [
    {
      name: 'GET /api/users',
      path: '/api/users',
      method: supertest(app).get
    },
    {
      name: 'GET /api/polls',
      path: '/api/polls',
      method: supertest(app).get
    },
    {
      name: 'PATCH /api/polls/:id',
      path: '/api/polls/1',
      method: supertest(app).patch
    },
    {
      name: 'DELETE /api/polls/:id',
      path: '/api/polls/1',
      method: supertest(app).delete
    },
  ];

  protectedEndpoints.forEach(endpoint => {
    describe(endpoint.name, () => {
      it(`responds with 401 'Missing bearer token' when no bearer token`, () => {
        return endpoint.method(endpoint.path)
          .expect(401, { error: 'Missing bearer token' });
      });

      it(`responds 401 'Unauthorized request' when invalid JWT secret`, () => {
        const validUser = testUsers[0];
        const invalidSecret = 'bad-secret';
        return endpoint.method(endpoint.path)
          .set('Authorization', helpers.makeAuthHeader(validUser, invalidSecret))
          .expect(401, {error: 'Unauthorized request' });
      });

      it(`responds 401 'Unauthorized request' when invalid sub in payload`, () => {
        const invalidUser = { user_name: 'invalid_user_name', id: 1 };
        return endpoint.method(endpoint.path)
          .set('Authorization', helpers.makeAuthHeader(invalidUser))
          .expect(401, { error: 'Unauthorized request' });
      });
    });
  });
});
