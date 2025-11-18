const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const dotenv = require('dotenv');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

// Firebase Web SDK
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDocs, setDoc, updateDoc, query, where } = require('firebase/firestore');

dotenv.config();

// Cloudinary setup
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary connected successfully');
} catch (error) {
  console.error('❌ Cloudinary config failed:', error.message);
  process.exit(1);
}

// Firebase Web SDK initialization
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
console.log('✅ Firebase Web SDK initialized successfully');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: process.env.CLIENT_URL || 'https://attandance-managment-system-three.vercel.app', methods: ['GET','POST'], credentials: true },
});

const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CLIENT_URL || 'https://attandance-managment-system-three.vercel.app', credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

// ── HELPER FUNCTIONS ───────────────────────────────────────────────────────
const safeString = (val) => (val && typeof val === 'string') ? val.trim() : '';
const safeDate = (val) => { const s = safeString(val); return s && s.length >= 10 ? s : null; };
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
  const h = Math.floor(sec / 3600).toString().padStart(2,'0');
  const m = Math.floor((sec % 3600)/60).toString().padStart(2,'0');
  const s = Math.floor(sec % 60).toString().padStart(2,'0');
  return `${h}:${m}:${s}`;
};
const getCollectionDocs = async (colName) => {
  const snap = await getDocs(collection(db, colName));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ── CRUD: Students ────────────────────────────────────────────────────────
app.get('/students', async (req, res) => {
  try { const students = await getCollectionDocs('students'); res.json(students); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/students/search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const lowerQ = q.toLowerCase().trim();
    if (!lowerQ) return res.json([]);
    const students = await getCollectionDocs('students');
    const results = students.filter(s => {
      const reg = (s.RegNo || '').toLowerCase();
      const name = (s.Name || '').toLowerCase();
      return reg.includes(lowerQ) || name.includes(lowerQ);
    });
    res.json(results);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/students', upload.single('photo'), async (req, res) => {
  try {
    const { Name, Gender, RegNo, Phone, Email, BloodGroup, Department, DOB } = req.body;
    let photoUrl = '';
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      photoUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }
    const studentRef = doc(collection(db, 'students'));
    await setDoc(studentRef, { Name, Gender, RegNo, Phone, Email, BloodGroup, Department, DOB, photo: photoUrl });
    res.json({ id: studentRef.id, message: 'Student added' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/students/:id', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      data.photo = result.secure_url;
      fs.unlinkSync(req.file.path);
    }
    const studentRef = doc(db,'students',id);
    await updateDoc(studentRef, data);
    res.json({ message: 'Student updated' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const studentRef = doc(db,'students',id);
    await updateDoc(studentRef,{deleted:true}); // or deleteDoc(studentRef)
    res.json({ message: 'Student deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ── Attendance ─────────────────────────────────────────────────────────────
app.post('/attendance', async (req, res) => {
  try {
    const { RegNo, Date, Status, Reason, TimeIn, TimeOut, Location } = req.body;
    if (!RegNo || !Date || !Status) return res.status(400).json({ error: 'RegNo, Date, Status required' });
    const dateStr = Date.replace(/-/g,'');
    const attRef = doc(db,'attendance',`_${dateStr}_${RegNo}`);
    await setDoc(attRef,{ RegNo, Date, Status, Reason:Reason||'', TimeIn:TimeIn||'', TimeOut:TimeOut||'', Location:Location||'' });
    io.emit('attendanceUpdate');
    res.json({ message:'Attendance recorded' });
  } catch (error) { res.status(500).json({ error:error.message }); }
});

app.put('/attendance/:id', async (req,res)=>{
  try { const { id } = req.params; const attRef = doc(db,'attendance',id); await updateDoc(attRef,req.body); io.emit('attendanceUpdate'); res.json({ message:'Attendance updated' }); }
  catch(error){ res.status(500).json({ error:error.message }); }
});

// ── GET /attendance/summary ─────────────────────────────────────────────
app.get('/attendance/summary', async (req,res)=>{
  try {
    const today = new Date().toISOString().split('T')[0].replace(/-/g,'');
    const attSnap = await getCollectionDocs('attendance');
    const studentsSnap = await getCollectionDocs('students');
    const totalStudents = studentsSnap.length;

    let present=0, absent=0; const absentReasons={};
    attSnap.forEach(d=>{
      if(d.Status==='Present') present++; 
      else if(d.Status==='Absent'){ absent++; const r=d.Reason||'Unknown'; absentReasons[r]=(absentReasons[r]||0)+1; }
    });
    res.json({ totalStudents,present,absent,absentWithReasons:absentReasons });
  } catch(e){ res.status(500).json({ error:e.message }); }
});

// ── GET /attendance/overall ─────────────────────────────────────────────
app.get('/attendance/overall', async (req,res)=>{
  try {
    const studentsSnap = await getCollectionDocs('students');
    const totalStudents = studentsSnap.length;

    const regToDept = {}; const departments = {};
    studentsSnap.forEach(d=>{
      const reg = safeString(d.RegNo);
      const dept = safeString(d.Department)||'Unknown';
      if(reg) regToDept[reg]=dept;
      departments[dept] = (departments[dept]||0)+1;
    });

    const attSnap = await getCollectionDocs('attendance');
    const academicDays = new Set();
    const monthlyDays = {}, monthlyPres = {};
    const absenceReasons = {};
    let totalPresent=0, totalAbsent=0, approved=0, unapproved=0;
    let arrivalSec=0, hoursSec=0, presentWithTime=0;
    const deptPres={};

    attSnap.forEach(a=>{
      const date = safeDate(a.Date);
      const status = safeString(a.Status);
      const reason = safeString(a.Reason);
      const reg = safeString(a.RegNo);

      if(date && date.length>=10){
        academicDays.add(date);
        const month = date.slice(0,7);
        if(!monthlyDays[month]) monthlyDays[month]=new Set();
        monthlyDays[month].add(date);
      }

      if(status==='Present'){
        totalPresent++;
        const dept = regToDept[reg]||'Unknown';
        deptPres[dept]=(deptPres[dept]||0)+1;

        if(date){
          const month=date.slice(0,7);
          monthlyPres[month]=(monthlyPres[month]||0)+1;
        }

        const inSec=parseTime(a.TimeIn); const outSec=parseTime(a.TimeOut);
        if(inSec!==null && outSec!==null && outSec>=inSec){
          arrivalSec+=inSec; hoursSec+=outSec-inSec; presentWithTime++;
        }
      } else if(status==='Absent'){
        totalAbsent++; const r=reason||'Unknown';
        absenceReasons[r]=(absenceReasons[r]||0)+1;
        if(r!=='Unknown') approved++; else unapproved++;
      }
    });

    const totalAcademicDays = academicDays.size;
    const totalPossible = totalStudents*totalAcademicDays;
    const attendanceRate = totalPossible>0?((totalPresent/totalPossible)*100).toFixed(2):'0.00';
    const absenteeismRate = totalPossible>0?((totalAbsent/totalPossible)*100).toFixed(2):'0.00';
    const averageArrivalTime = presentWithTime>0?secondsToHMS(arrivalSec/presentWithTime):'N/A';
    const averageHoursAttended = presentWithTime>0?(hoursSec/presentWithTime/3600).toFixed(2):'N/A';

    const attendanceByDept={};
    Object.keys(departments).forEach(dept=>{
      const possible = departments[dept]*totalAcademicDays;
      const present = deptPres[dept]||0;
      attendanceByDept[dept] = possible>0?((present/possible)*100).toFixed(2):'0.00';
    });

    const monthlyTrends={};
    Object.keys(monthlyDays).forEach(month=>{
      const days = monthlyDays[month].size;
      const possible = totalStudents*days;
      const present = monthlyPres[month]||0;
      monthlyTrends[month]=possible>0?((present/possible)*100).toFixed(2):'0.00';
    });

    res.json({
      totalStudents, totalAcademicDays, totalDaysPresent:totalPresent, totalDaysAbsent:totalAbsent,
      approvedLeaves:approved, unapprovedAbsences:unapproved,
      averageArrivalTime, averageHoursAttended, attendanceRate, absenteeismRate,
      attendanceByDept, absenceReasons, monthlyTrends
    });
  } catch(e){ res.status(500).json({ error:e.message }); }
});

// ── GET /attendance/history/:regno ─────────────────────────────────────
app.get('/attendance/history/:regno', async (req,res)=>{
  try {
    const { regno } = req.params;
    const attSnap = await getCollectionDocs('attendance');
    const history = attSnap.filter(d=>d.RegNo===regno);
    res.json(history);
  } catch(e){ res.status(500).json({ error:e.message }); }
});

// ── GET /attendance/topbottom ───────────────────────────────────────────
app.get('/attendance/topbottom', async (req,res)=>{
  try {
    const studentsSnap = await getCollectionDocs('students');
    const rates=[];

    for(const s of studentsSnap){
      const reg = safeString(s.RegNo);
      if(!reg) continue;
      const attSnap = await getCollectionDocs('attendance');
      const studentAtt = attSnap.filter(a=>a.RegNo===reg);
      const total = studentAtt.length;
      let present = studentAtt.filter(a=>a.Status==='Present').length;
      const percentage = total>0?(present/total*100).toFixed(2):'0.00';
      rates.push({...s, percentage:parseFloat(percentage)});
    }

    rates.sort((a,b)=>b.percentage-a.percentage);
    const top5 = rates.slice(0,5);
    const bottom5 = rates.slice(-5).reverse();
    res.json({ top5,bottom5 });
  } catch(e){ res.status(500).json({ error:e.message }); }
});

// ── GET /attendance/locations ───────────────────────────────────────────
app.get('/attendance/locations', async (req,res)=>{
  try {
    const attSnap = await getCollectionDocs('attendance');
    const locations={};
    attSnap.forEach(a=>{
      const loc=safeString(a.Location)||'Unknown';
      locations[loc]=(locations[loc]||0)+1;
    });
    res.json(locations);
  } catch(e){ res.status(500).json({ error:e.message }); }
});

// Root
app.get('/',(req,res)=>{ res.send('Backend is running! Firebase Web SDK & Cloudinary connected.'); });

server.listen(PORT,()=>{ console.log(`Backend running on port ${PORT}`); });

