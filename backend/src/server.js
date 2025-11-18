const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

dotenv.config();

// ============ FIREBASE: READ FROM RAILWAY VARIABLES (NO JSON FILE) ============
const serviceAccount = {
  type: "service_account",
  project_id: process.env.project_id,
  private_key_id: process.env.private_key_id,
  private_key: process.env.private_key?.replace(/\\n/g, '\n'),  // Important: fix newlines
  client_email: process.env.client_email,
  client_id: process.env.client_id,
  auth_uri: process.env.auth_uri,
  token_uri: process.env.token_uri,
  auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
  client_x509_cert_url: process.env.client_x509_cert_url,
  universe_domain: process.env.universe_domain || "googleapis.com"
};

let db;
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log('Firebase connected successfully using env variables!');
} catch (error) {
  console.error('Firebase init failed:', error.message);
  process.exit(1);
}

// ============ CLOUDINARY ============
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
});

const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Use memory storage (better for Railway/Render)
const upload = multer({ storage: multer.memoryStorage() });

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ── HELPER FUNCTIONS (same as yours) ─────────────────────────────────────
const safeString = (val) => (val && typeof val === 'string') ? val.trim() : '';
const safeDate = (val) => {
  const s = safeString(val);
  return s && s.length >= 10 ? s : null;
};

const parseTime = (str) => {
  const s = safeString(str);
  if (!s) return null;
  const parts = s.split(':').map(p => parseInt(p, 10));
  if (parts.length < 2) return null;
  const [h, m, sec = 0] = parts;
  if (isNaN(h) || isNaN(m) || isNaN(sec)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59 || sec < 0 || sec > 59) return null;
  return h * 3600 + m * 60 + sec;
};

const secondsToHMS = (sec) => {
  const h = Math.floor(sec / 3600).toString().padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

// ── ALL YOUR ROUTES (100% unchanged, just using memory upload) ─────────────
app.get('/', (req, res) => {
  res.send('Attendance Backend LIVE on Railway + Firebase Firestore!');
});

// Students CRUD
app.get('/students', async (req, res) => {
  try {
    const snap = await db.collection('students').get();
    const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(students);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/students/search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const lowerQ = q.toLowerCase().trim();
    if (!lowerQ) return res.json([]);
    const snap = await db.collection('students').get();
    const results = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(s => (s.RegNo || '').toLowerCase().includes(lowerQ) || (s.Name || '').toLowerCase().includes(lowerQ));
    res.json(results);
  } catch (error) { res.status(500).json({ error: error.message Marginal }); }
});

app.post('/students', upload.single('photo'), async (req, res) => {
  try {
    const { Name, Gender, RegNo, Phone, Email, BloodGroup, Department, DOB } = req.body;
    let photoUrl = '';
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${b64}`, {
        folder: 'attendance/students'
      });
      photoUrl = result.secure_url;
    }
    const docRef = await db.collection('students').add({
      Name, Gender, RegNo, Phone, Email, BloodGroup, Department, DOB, photo: photoUrl
    });
    res.json({ id: docRef.id, message: 'Student added' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/students/:id', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${b64}`);
      data.photo = result.secure_url;
    }
    await db.collection('students').doc(id).update(data);
    res.json({ message: 'Student updated' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/students/:id', async (req, res) => {
  try {
    await db.collection('students').doc(req.params.id).delete();
    res.json({ message: 'Student deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Attendance + All Other Routes (100% same as yours)
app.post('/attendance', async (req, res) => {
  try {
    const { RegNo, Date, Status, Reason, TimeIn, TimeOut, Location } = req.body;
    if (!RegNo || !Date || !Status) return res.status(400).json({ error: 'Missing fields' });
    const dateStr = Date.replace(/-/g, '');
    const id = `_${dateStr}_${RegNo}`;
    await db.collection('attendance').doc(id).set({
      RegNo, Date, Status, Reason: Reason || '', TimeIn: TimeIn || '', TimeOut: TimeOut || '', Location: Location || ''
    }, { merge: true });
    io.emit('attendanceUpdate');
    res.json({ message: 'Attendance recorded' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/attendance/:id', async (req, res) => {
  try {
    await db.collection('attendance').doc(req.params.id).update(req.body);
    io.emit('attendanceUpdate');
    res.json({ message: 'Attendance updated' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ── Attendance ─────────────────────────────────────────────────────────────
app.post('/attendance', async (req, res) => {
  try {
    const { RegNo, Date, Status, Reason, TimeIn, TimeOut, Location } = req.body;
    if (!RegNo || !Date || !Status) {
      return res.status(400).json({ error: 'RegNo, Date, Status required' });
    }
    const dateStr = Date.replace(/-/g, '');
    const id = `_${dateStr}_${RegNo}`;
    await db.collection('attendance').doc(id).set({
      RegNo, Date, Status, Reason: Reason || '', TimeIn: TimeIn || '', TimeOut: TimeOut || '', Location: Location || ''
    });
    io.emit('attendanceUpdate');
    res.json({ message: 'Attendance recorded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/attendance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('attendance').doc(id).update(req.body);
    io.emit('attendanceUpdate');
    res.json({ message: 'Attendance updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /attendance/summary (Today) ───────────────────────────────────────
app.get('/attendance/summary', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const attSnap = await db.collection('attendance')
      .where('__name__', '>=', `_${today}`)
      .where('__name__', '<', `_${today}\uf8ff`)
      .get();

    const studentsSnap = await db.collection('students').get();
    const totalStudents = studentsSnap.size;

    let present = 0, absent = 0;
    const absentReasons = {};

    attSnap.forEach(doc => {
      const d = doc.data();
      if (d.Status === 'Present') present++;
      else if (d.Status === 'Absent') {
        absent++;
        const r = d.Reason || 'Unknown';
        absentReasons[r] = (absentReasons[r] || 0) + 1;
      }
    });

    res.json({ totalStudents, present, absent, absentWithReasons: absentReasons });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /attendance/overall ───────────────────────────────────────────────
app.get('/attendance/overall', async (req, res) => {
  try {
    const studentsSnap = await db.collection('students').get();
    const totalStudents = studentsSnap.size;

    const regToDept = {};
    const departments = {};
    studentsSnap.forEach(doc => {
      const d = doc.data() || {};
      const reg = safeString(d.RegNo);
      const dept = safeString(d.Department) || 'Unknown';
      if (reg) regToDept[reg] = dept;
      departments[dept] = (departments[dept] || 0) + 1;
    });

    const attSnap = await db.collection('attendance').get();

    const academicDays = new Set();
    const monthlyDays = {}, monthlyPres = {};
    const absenceReasons = {};

    let totalPresent = 0, totalAbsent = 0;
    let approved = 0, unapproved = 0;
    let arrivalSec = 0, hoursSec = 0, presentWithTime = 0;
    const deptPres = {};

    attSnap.forEach(doc => {
      const a = doc.data() || {};
      const date = safeDate(a.Date);
      const status = safeString(a.Status);
      const reason = safeString(a.Reason);
      const reg = safeString(a.RegNo);

      if (date && date.length >= 10) {
        academicDays.add(date);
        const month = date.slice(0, 7);
        if (!monthlyDays[month]) monthlyDays[month] = new Set();
        monthlyDays[month].add(date);
      }

      if (status === 'Present') {
        totalPresent++;
        const dept = regToDept[reg] || 'Unknown';
        deptPres[dept] = (deptPres[dept] || 0) + 1;

        if (date) {
          const month = date.slice(0, 7);
          monthlyPres[month] = (monthlyPres[month] || 0) + 1;
        }

        const inSec = parseTime(a.TimeIn);
        const outSec = parseTime(a.TimeOut);
        if (inSec !== null && outSec !== null && outSec >= inSec) {
          arrivalSec += inSec;
          hoursSec += outSec - inSec;
          presentWithTime++;
        }
      } else if (status === 'Absent') {
        totalAbsent++;
        const r = reason || 'Unknown';
        absenceReasons[r] = (absenceReasons[r] || 0) + 1;
        if (r !== 'Unknown') approved++;
        else unapproved++;
      }
    });

    const totalAcademicDays = academicDays.size;
    const totalPossible = totalStudents * totalAcademicDays;

    const attendanceRate = totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(2) : '0.00';
    const absenteeismRate = totalPossible > 0 ? ((totalAbsent / totalPossible) * 100).toFixed(2) : '0.00';

    const averageArrivalTime = presentWithTime > 0 ? secondsToHMS(arrivalSec / presentWithTime) : 'N/A';
    const averageHoursAttended = presentWithTime > 0 ? (hoursSec / presentWithTime / 3600).toFixed(2) : 'N/A';

    const attendanceByDept = {};
    Object.keys(departments).forEach(dept => {
      const possible = departments[dept] * totalAcademicDays;
      const present = deptPres[dept] || 0;
      attendanceByDept[dept] = possible > 0 ? ((present / possible) * 100).toFixed(2) : '0.00';
    });

    const monthlyTrends = {};
    Object.keys(monthlyDays).forEach(month => {
      const days = monthlyDays[month].size;
      const possible = totalStudents * days;
      const present = monthlyPres[month] || 0;
      monthlyTrends[month] = possible > 0 ? ((present / possible) * 100).toFixed(2) : '0.00';
    });

    res.json({
      totalStudents, totalAcademicDays, totalDaysPresent: totalPresent, totalDaysAbsent: totalAbsent,
      approvedLeaves: approved, unapprovedAbsences: unapproved,
      averageArrivalTime, averageHoursAttended, attendanceRate, absenteeismRate,
      attendanceByDept, absenceReasons, monthlyTrends
    });
  } catch (error) {
    console.error('/attendance/overall error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /attendance/history/:regno ───────────────────────────────────────
app.get('/attendance/history/:regno', async (req, res) => {
  try {
    const { regno } = req.params;
    const snap = await db.collection('attendance').where('RegNo', '==', regno).get();
    const history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /attendance/topbottom ─────────────────────────────────────────────
app.get('/attendance/topbottom', async (req, res) => {
  try {
    const studentsSnap = await db.collection('students').get();
    const rates = [];

    for (const doc of studentsSnap.docs) {
      const student = doc.data();
      const reg = student.RegNo;
      if (!reg) continue;

      const attSnap = await db.collection('attendance').where('RegNo', '==', reg).get();
      const total = attSnap.size;
      let present = 0;
      attSnap.forEach(d => { if (d.data().Status === 'Present') present++; });
      const percentage = total > 0 ? (present / total * 100).toFixed(2) : '0.00';
      rates.push({ ...student, percentage: parseFloat(percentage) });
    }

    rates.sort((a, b) => b.percentage - a.percentage);
    const top5 = rates.slice(0, 5);
    const bottom5 = rates.slice(-5).reverse();

    res.json({ top5, bottom5 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /attendance/locations ─────────────────────────────────────────────
app.get('/attendance/locations', async (req, res) => {
  try {
    const snap = await db.collection('attendance').get();
    const locations = {};
    snap.forEach(doc => {
      const loc = safeString(doc.data().Location) || 'Unknown';
      locations[loc] = (locations[loc] || 0) + 1;
    });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Backend is running! Firebase & Cloudinary connected.');
});

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
