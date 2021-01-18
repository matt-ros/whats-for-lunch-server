BEGIN;

TRUNCATE
  whatsforlunch_users
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

COMMIT;
