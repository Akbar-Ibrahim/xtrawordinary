import mysql from "mysql2/promise";

const connectionString = process.env.MYSQL_DATABASE_URL;

if (!connectionString) {
  console.log("No MYSQL_DATABASE_URL — skipping MySQL migration");
  process.exit(0);
}

async function migrate() {
  const pool = mysql.createPool(connectionString!);
  const conn = await pool.getConnection();

  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS group_round_attempts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        round_id INT NOT NULL,
        user_id INT NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX gra_round_idx (round_id),
        INDEX gra_user_idx (user_id),
        UNIQUE INDEX gra_round_user_idx (round_id, user_id)
      )
    `);
    console.log("group_round_attempts table ready");

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS daily_challenge_attempts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        challenge_date VARCHAR(20) NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX dca_user_idx (user_id),
        UNIQUE INDEX dca_user_date_idx (user_id, challenge_date)
      )
    `);
    console.log("daily_challenge_attempts table ready");
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
