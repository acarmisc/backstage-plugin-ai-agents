exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable('invocations');
  if (exists) return;
  await knex.schema.createTable('invocations', table => {
    table.increments('id').primary();
    table.string('entity_ref').notNullable().index();
    table.string('user_ref', 200).nullable();
    table.string('session_id', 80).notNullable();
    table.text('prompt').notNullable();
    table.enum('status', ['ok', 'error']).notNullable();
    table.text('response_text').nullable();
    table.text('error_message').nullable();
    table.bigInteger('latency_ms').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable().index();
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('invocations');
};
