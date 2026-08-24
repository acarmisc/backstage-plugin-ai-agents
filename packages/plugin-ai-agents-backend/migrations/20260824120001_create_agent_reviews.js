exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable('agent_reviews');
  if (exists) return;
  await knex.schema.createTable('agent_reviews', table => {
    table.increments('id').primary();
    table.string('entity_ref').notNullable().index();
    table.string('user_ref', 200).nullable();
    table.integer('rating').notNullable();
    table.text('comment').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable().index();
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('agent_reviews');
};
