const xss = require('xss');

const PollItemsService = {
  getAllItemsByPollId(db, poll_id) {
    return db('whatsforlunch_poll_items')
      .select('*')
      .where({ poll_id });
  },

  getItemById(db, id) {
    return db('whatsforlunch_poll_items')
      .where({ id })
      .first();
  },

  insertItem(db, newItem) {
    return db
      .insert(newItem)
      .into('whatsforlunch_poll_items')
      .returning('*');
  },

  updateItem(db, id, newItemFields) {
    return db('whatsforlunch_poll_items')
      .where({ id })
      .update(newItemFields);
  },

  deleteItem(db, id) {
    return db('whatsforlunch_poll_items')
      .where({ id })
      .delete();
  },

  serializeItem(item) {
    return {
      id: item.id,
      item_name: xss(item.item_name),
      item_address: xss(item.item_address),
      item_cuisine: xss(item.item_cuisine),
      item_link: xss(item.item_link),
      item_votes: item.item_votes,
      date_created: new Date(item.date_created),
      poll_id: item.poll_id
    };
  },

  serializeItems(items) {
    return items.map(this.serializeItem);
  }
}

module.exports = PollItemsService;
