BEGIN;

TRUNCATE
  whatsforlunch_users,
  whatsforlunch_polls,
  whatsforlunch_poll_items
  RESTART IDENTITY CASCADE;

INSERT INTO whatsforlunch_users (
  user_name,
  full_name,
  password
) VALUES
  (
    'demo',
    'Demo User',
    '$2a$10$KjHtvQYd8Nm2/RwLloLLQenaMQEdk9N95mtbY6gOAHAKLA.FY0Bau'
  ),
  (
    'demo2',
    'Demo User 2',
    '$2a$10$mBieKSsvVTjkPH0IX4jutucDTaTwUthhP7DiEKweIv8iUYzYuR.sW'
  );

INSERT INTO whatsforlunch_polls (
  poll_name,
  end_time,
  user_id
) VALUES
  (
    'Poll 1',
    '2029-01-22T16:28:32.615Z',
    1
  ),
  (
    'Poll 2',
    '2029-01-22T16:28:32.615Z',
    2
  ),
  (
    'Poll 3',
    '2020-01-22T16:28:32.615Z',
    1
  );

INSERT INTO whatsforlunch_poll_items (
  item_name,
  item_address,
  item_cuisine,
  item_link,
  item_votes,
  poll_id
) VALUES
  (
    'Restaurant 1',
    '123 Main St',
    'Italian',
    'http://www.example.com',
    3,
    1
  ),
  (
    'Restaurant 2',
    '456 Main St',
    'Sandwiches',
    'http://www.example.com',
    4,
    1
  ),
  (
    'Restaurant 3',
    '789 Main St',
    'Burgers',
    'http://www.example.com',
    0,
    1
  ),
  (
    'Restaurant 4',
    '321 Main St',
    'Sushi',
    'http://www.example.com',
    2,
    1
  ),
  (
    'Restaurant 5',
    '654 Main St',
    'Mexican',
    'http://www.example.com',
    3,
    2
  ),
  (
    'Restaurant 6',
    '987 Main St',
    'Pizza',
    'http://www.example.com',
    5,
    2
  ),
  (
    'Restaurant 7',
    '147 Main St',
    'Indian',
    'http://www.example.com',
    0,
    2
  ),
  (
    'Restaurant 8',
    '258 Main St',
    'Barbecue',
    'http://www.example.com',
    3,
    3
  ),
  (
    'Restaurant 9',
    '369 Main St',
    'Greek',
    'http://www.example.com',
    4,
    3
  ),
  (
    'Restaurant 10',
    '741 Main St',
    'Chinese',
    'http://www.example.com',
    0,
    3
  );

COMMIT;
