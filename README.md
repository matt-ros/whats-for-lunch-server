# What's For Lunch?

[Live App](https://whats-for-lunch-client.vercel.app/)

[What's For Lunch Client Repo](https://github.com/matt-ros/whats-for-lunch-client)

## Summary

What's For Lunch makes it easy for a group to decide where to eat.  Create a poll, share with your group, eat at the winning spot!  It was originally intended for co-workers eating lunch, but it can be used by anyone!  No sign up is required to create or vote in a poll, but an account will allow you to edit and reuse your previous polls.

## Screenshots

### Landing Page

![Screenshot of Landing page](https://i.ibb.co/phVScmD/Screenshot-landing-page.png)

### Poll Page

![Screenshot of Poll page](https://i.ibb.co/KWR75Ch/Screenshot-poll.png)

### Results Page

![Screenshot of Results page](https://i.ibb.co/nncgsXR/Screenshot-results.png)

### User Homepage

![Screenshot of User Homepage](https://i.ibb.co/183Lx4d/screenshot-homepage.png)

## API Endpoints

### `/auth/login`

`POST` logs in a user with valid credentials

### `/items/:id`

`DELETE` deletes an item from a poll (Protected)

### `/items/poll/:poll_id`

`GET` retrieves all poll items associated with the specified poll

`POST` adds an array of new poll items associated with the specified poll

### `/items/vote/:id`

`PATCH` increments the vote count by 1 for the specified item

### `/items/resetVotes/:poll_id`

`PATCH` sets the vote count to 0 for all items associated with the specified poll (Protected)

### `/polls`

`GET` retrieves all polls associated with the currently logged in user (Protected)

`POST` adds a new poll.  If the user is logged in, the poll is associated with that user

### `/polls/:id`

`GET` retrieves the specified poll

`PATCH` updates the poll's information (Protected)

`DELETE` deletes the poll (Protected)

### `/users`

`POST` creates a new user

`GET` retrieves the current user's information (Protected)

## Technology

* Node.js
* Express
* PostgreSQL
* Knex.js for database queries
* Mocha/Chai/Supertest for testing
