const db = require("../../config/db");

exports.checkOverlap = async (userId, startDate, endDate) => {
  const result = await db.query(
    `SELECT id FROM leave_requests 
     WHERE user_id = $1 
       AND status != 'rejected' 
       AND (start_date <= $3 AND end_date >= $2)`, 
    [userId, startDate, endDate]
  );
  return result.rowCount > 0;
};

exports.createRequest = async (userId, type, startDate, endDate, reason, attachmentUrl) => {
  const result = await db.query(
    `INSERT INTO leave_requests 
      (user_id, type, start_date, end_date, reason, attachment_url, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING *`,
    [userId, type, startDate, endDate, reason, attachmentUrl]
  );
  return result.rows[0];
};

exports.findAll = async (status) => {
  let query = `
    SELECT 
      lr.*, 
      u.name as user_name, 
      u.email,
      admin.name as validator_name f
    FROM leave_requests lr
    LEFT JOIN users u ON lr.user_id = u.id
    LEFT JOIN users admin ON lr.approved_by = admin.id
  `;
  const params = [];
  
  if (status) {
    query += ` WHERE lr.status = $1`;
    params.push(status);
  }
  
  query += ` ORDER BY lr.created_at DESC`;
  const result = await db.query(query, params);
  return result.rows;
};

exports.findByUser = async (userId) => {
  const result = await db.query(
    `SELECT 
       lr.*, 
       admin.name as validator_name 
     FROM leave_requests lr
     LEFT JOIN users admin ON lr.approved_by = admin.id
     WHERE lr.user_id = $1 
     ORDER BY lr.created_at DESC`,
    [userId]
  );
  return result.rows;
};

exports.rejectRequest = async (id, note, adminId) => {
  await db.query(
    `UPDATE leave_requests 
     SET status = 'rejected', 
         rejection_note = $1, 
         approved_by = $3, 
         updated_at = NOW() 
     WHERE id = $2`,
    [note, id, adminId]
  );
};

exports.approveRequest = async (id, adminId) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const updateRes = await client.query(
      `UPDATE leave_requests 
       SET status = 'approved', approved_by = $2, updated_at = NOW() 
       WHERE id = $1 
       RETURNING user_id, type, start_date, end_date`,
      [id, adminId]
    );

    if (updateRes.rowCount === 0) throw new Error("Request not found");
    const { user_id, type, start_date, end_date } = updateRes.rows[0];

    const insertQuery = `
      INSERT INTO attendances (user_id, date, status, ip_address, user_agent, screen_size, risk_flag)
      SELECT 
        $1, 
        d::date, 
        $2, 
        'SYSTEM', 'SYSTEM', '0x0', 0
      FROM generate_series($3::date, $4::date, '1 day'::interval) as d
      WHERE EXTRACT(ISODOW FROM d) < 6 
      ON CONFLICT (user_id, date) 
      DO UPDATE SET status = EXCLUDED.status, risk_flag = 0
    `;

    await client.query(insertQuery, [user_id, type.toUpperCase(), start_date, end_date]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};