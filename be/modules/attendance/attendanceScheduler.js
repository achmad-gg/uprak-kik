const cron = require('node-cron');
const db = require('../../config/db'); 
const axios = require('axios');
const FONNTE_TOKEN = process.env.FONNTE_TOKEN_WA;

const JAM_MASUK_KANTOR = 9; 
const JADWAL_NOTIFIKASI_WA = '0 18 * * *';
const JADWAL_AUTO_CLOSE = '59 23 * * *';
const JAM_PULANG_DEFAULT = '17:00:00'; 



const sendWhatsAppAlert = async (phone, name) => {
  if (!phone) return;

  let formattedPhone = phone;
  if (phone.startsWith('0')) {
    formattedPhone = '62' + phone.slice(1);
  }

  const message = `Halo ${name} 👋,\n\nSistem mendeteksi Anda *BELUM CHECK-OUT* hari ini.\n\nMohon segera lakukan Check-Out melalui aplikasi sebelum jam 23:59, atau sistem akan menutup absensi Anda secara otomatis.\n\nTerima kasih.`;

  try {
    const response = await axios.post('https://api.fonnte.com/send', {
      target: formattedPhone,
      message: message,
    }, {
      headers: {
        'Authorization': FONNTE_TOKEN
      }
    });

    console.log(`[WA] Kirim ke ${name} (${formattedPhone}): ${response.data.status ? 'Berhasil' : 'Gagal'}`);
  } catch (error) {
    console.error(`[WA ERROR] Gagal kirim ke ${name}:`, error.message);
  }
};

const initScheduler = () => {
  console.log('🕒 Attendance Scheduler is Running...');

  // ============================================================
  // TASK 1: PERINGATAN VIA WHATSAPP (Jalan jam 18:00)
  // ============================================================
  cron.schedule(JADWAL_NOTIFIKASI_WA, async () => {
    await runWAReminderJob();
    console.log('Running Task: Sending WA Reminders...');
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      
      const query = `
        SELECT u.name, u.phone_number 
        FROM attendances a
        JOIN users u ON u.id = a.user_id
        WHERE a.date = $1 
          AND a.check_in_at IS NOT NULL 
          AND a.check_out_at IS NULL
      `;
      
      const result = await db.query(query, [todayStr]);

      if (result.rows.length > 0) {
        console.log(`Ditemukan ${result.rows.length} karyawan lupa checkout. Mengirim WA...`);
        
        for (const user of result.rows) {
          await sendWhatsAppAlert(user.phone_number, user.name);
        }
      } else {
        console.log('Semua aman. Tidak ada yang lupa checkout.');
      }
    } catch (err) {
      console.error('Error Task WA:', err);
    }
  });

  // ============================================================
  // TASK 2: AUTO CHECKOUT / CORN JOB (Jalan jam 23:59)
  // ============================================================
  cron.schedule(JADWAL_AUTO_CLOSE, async () => {
    console.log('Running Task: Auto-Checkout Cleanup...');
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const query = `
        UPDATE attendances 
        SET check_out_at = (date || ' ' || $1)::timestamp,
            status = 'auto_closed',
            risk_flag = COALESCE(risk_flag, 0) | 16  
        WHERE date = $2
          AND check_in_at IS NOT NULL 
          AND check_out_at IS NULL
      `;

      const result = await db.query(query, [JAM_PULANG_DEFAULT, todayStr]);

      if (result.rowCount > 0) {
        console.log(`✅ Sukses Auto-Checkout untuk ${result.rowCount} karyawan.`);
      } else {
        console.log('Tidak ada data yang perlu di Auto-Checkout malam ini.');
      }

    } catch (err) {
      console.error('Error Task Auto-Checkout:', err);
    }
  });
};

const runWAReminderJob = async () => {
  console.log('Running Task: Sending WA Reminders (Manual/Cron)...');
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const query = `
      SELECT u.name, u.phone_number 
      FROM attendances a
      JOIN users u ON u.id = a.user_id
      WHERE a.date = $1 
        AND a.check_in_at IS NOT NULL 
        AND a.check_out_at IS NULL
    `;
    
    const result = await db.query(query, [todayStr]);

    if (result.rows.length > 0) {
      console.log(`Ditemukan ${result.rows.length} orang. Mengirim WA...`);
      for (const user of result.rows) {
        await sendWhatsAppAlert(user.phone_number, user.name);
      }
      return { status: 'success', count: result.rows.length };
    } else {
      console.log('Semua aman, tidak ada notif dikirim.');
      return { status: 'empty', count: 0 };
    }
  } catch (err) {
    console.error('Error Task WA:', err);
    return { status: 'error', message: err.message };
  }
};

module.exports = { initScheduler, JAM_MASUK_KANTOR, runWAReminderJob };