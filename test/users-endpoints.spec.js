const knex = require('knex');
const bcrypt = require('bcryptjs');
const xss = require('xss');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Users Endpoints', () => {
  let db;

  const { testUsers } = helpers.makeWhatsForLunchFixtures();
  const testUser = testUsers[0];

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

  describe('POST /api/users', () => {
    context('User Validation', () => {
      beforeEach('insert users', () =>
        helpers.seedUsers(
          db,
          testUsers,
        )
      );

      const requiredFields = ['user_name', 'password', 'full_name'];

      requiredFields.forEach(field => {
        const registerAttemptBody = {
          user_name: 'test user_name',
          password: 'test password',
          full_name: 'test full_name',
        };

        it(`responds with 400 required error when '${field}' is missing`, () => {
          delete registerAttemptBody[field];

          return supertest(app)
            .post('/api/users')
            .send(registerAttemptBody)
            .expect(400, {
              error: `Missing '${field}' in request body`
            });
        });
      });

      it(`responds 400 'Password must be longer than 8 characters' when short password`, () => {
        const userShortPassword = {
          user_name: 'test user_name',
          password: '1234567',
          full_name: 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(userShortPassword)
          .expect(400, { error: 'Password must be longer than 8 characters' });
      });
      
      it(`responds 400 'Password must be less than 72 characters' when long password`, () => {
        const userLongPassword = {
          user_name: 'test user_name',
          password: '*'.repeat(73),
          full_name: 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(userLongPassword)
          .expect(400, { error: 'Password must be less than 72 characters' });
      });

      it('responds 400 error when password starts with spaces', () => {
        const userPasswordStartsSpaces = {
          user_name: 'test user_name',
          password: ' 1Aa!2Bb@',
          full_name: 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(userPasswordStartsSpaces)
          .expect(400, { error: 'Password must not start or end with empty space' });
      });

      it('responds 400 error when password ends with spaces', () => {
        const userPasswordEndsSpaces = {
          user_name: 'test user_name',
          password: '1Aa!2Bb@ ',
          full_name: 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(userPasswordEndsSpaces)
          .expect(400, { error: 'Password must not start or end with empty space' });
      });

      it(`responds 400 error when password isn't complex enough`, () => {
        const userPasswordNotComplex = {
          user_name: 'test user_name',
          password: '11AAaabb',
          full_name: 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(userPasswordNotComplex)
          .expect(400, {error: 'Password must contain at least 1 upper case letter, lower case letter, number, and special character' });
      });

      it(`responds 400 'User name already taken' when user_name isn't unique`, () => {
        const duplicateUser = {
          user_name: testUser.user_name,
          password: '11AAaa!!',
          full_name: 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(duplicateUser)
          .expect(400, { error: 'Username already taken' });
      });
    });

    context('Happy path', () => {
      it('responds 201, serialized user, storing bcrypted password', () => {
        const newUser = {
          user_name: 'test user_name',
          password: '11AAaa!!',
          full_name: 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(newUser)
          .expect(201)
          .expect(res => {
            expect(res.body).to.have.property('id');
            expect(res.body.user_name).to.eql(xss(newUser.user_name));
            expect(res.body.full_name).to.eql(xss(newUser.full_name));
            expect(res.body).to.not.have.property('password');
            expect(res.headers.location).to.eql(`/api/users/${res.body.id}`);
            const expectedDateCreated = new Date().toLocaleString();
            const actualDateCreated = new Date(res.body.date_created).toLocaleString();
            expect(actualDateCreated).to.eql(expectedDateCreated);
          })
          .expect(res =>
            db
              .from('whatsforlunch_users')
              .select('*')
              .where({ id: res.body.id })
              .first()
              .then(row => {
                expect(row.user_name).to.eql(newUser.user_name);
                expect(row.full_name).to.eql(newUser.full_name);
                const expectedDBDateCreated = new Date().toLocaleString();
                const actualDBDateCreated = new Date(row.date_created).toLocaleString();
                expect(actualDBDateCreated).to.eql(expectedDBDateCreated);

                return bcrypt.compare(newUser.password, row.password);
              })
              .then(compareMatch => {
                expect(compareMatch).to.be.true;
              })
          );
      });
    });
  });

  describe('GET /api/users', () => {
    context('Given no users', () => {
      it('responds 401 Unauthorized', () => {
        return supertest(app)
        .get('/api/users')
        .set('Authorization', helpers.makeAuthHeader(testUser))
        .expect(401, { error: 'Unauthorized request' });
      });
    });

    context('Given there are users in the database', () => {
      beforeEach('insert users', () =>
        helpers.seedUsers(
          db,
          testUsers,
        )
      );

      it('responds with 200 and the user described in token', () => {
        return supertest(app)
          .get('/api/users')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(200)
          .then(res => {
            expect(res.body.id).to.eql(testUser.id);
            expect(res.body.user_name).to.eql(testUser.user_name);
            expect(res.body.full_name).to.eql(testUser.full_name);
          });
      });

      context('Given XSS attack in user fields', () => {
        const { maliciousUser, expectedUser } = helpers.makeMaliciousUser();

        beforeEach('insert malicious user', () => {
          return helpers.seedMaliciousUser(
            db,
            maliciousUser,
          );
        });

        it('removes XSS attack content', () => {
          return supertest(app)
            .get('/api/users')
            .set('Authorization', helpers.makeAuthHeader(maliciousUser))
            .expect(200)
            .expect(res => {
              expect(res.body.user_name).to.eql(expectedUser.user_name);
              expect(res.body.full_name).to.eql(expectedUser.full_name);
            });
        });
      })
    });
  });
});
