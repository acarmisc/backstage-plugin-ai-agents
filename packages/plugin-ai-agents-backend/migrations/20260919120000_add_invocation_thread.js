exports.up = async function up(knex) {
  const hasThread = await knex.schema.hasColumn('invocations', 'thread_id');
  if (!hasThread) {
    await knex.schema.alterTable('invocations', table => {
      table.string('thread_id', 120).nullable().index();
    });
  }
  const hasPost = await knex.schema.hasColumn('invocations', 'post');
  if (!hasPost) {
    await knex.schema.alterTable('invocations', table => {
      table.boolean('post').notNullable().defaultTo(false);
    });
  }
};

exports.down = async function down(knex) {
  const hasThread = await knex.schema.hasColumn('invocations', 'thread_id');
  if (hasThread) {
    await knex.schema.alterTable('invocations', table => {
      table.dropColumn('thread_id');
    });
  }
  const hasPost = await knex.schema.hasColumn('invocations', 'post');
  if (hasPost) {
    await knex.schema.alterTable('invocations', table => {
      table.dropColumn('post');
    });
  }
};
