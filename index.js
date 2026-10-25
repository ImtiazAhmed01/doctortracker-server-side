const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult, query } = require('express-validator');

const port = process.env.PORT || 5000;
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";
const uri = `mongodb+srv://${process.env.DB_user}:${process.env.DB_pass}@cluster0.khtuk.mongodb.net/?retryWrites=true&w=majority`;

// ─── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://doctortracker-client.onrender.com',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    // Allow any onrender.com or netlify.app preview/production domains or localhost port
    if (origin.endsWith('.onrender.com') || origin.endsWith('.netlify.app') || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in production for client convenience
  },
  credentials: true
}));
app.use(express.json());
app.get('/', (req, res) => {
  res.send('🚀 DoctorTracker Server is running successfully!');
});
// ─── MongoDB Client ────────────────────────────────────────────────────────────
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true }
});

// ─── Auth Middleware ───────────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

// ─── Main async function ───────────────────────────────────────────────────────
async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    const db = client.db('doctortracker');
    const usersCollection = db.collection('users');
    const doctorsCollection = db.collection('doctors');
    const patientsCollection = db.collection('patients');
    const blogsCollection = db.collection('blogs');

    // ─── Create Indexes for Performance ─────────────────────────────────────────
    await doctorsCollection.createIndex({ name: 1 });
    await doctorsCollection.createIndex({ createdAt: -1 });
    await doctorsCollection.createIndex({ specialization: 1 });
    await doctorsCollection.createIndex({ email: 1 });
    await patientsCollection.createIndex({ name: 1 });
    await patientsCollection.createIndex({ doctorId: 1 });
    await patientsCollection.createIndex({ createdAt: -1 });
    await patientsCollection.createIndex({ condition: 1 });
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await blogsCollection.createIndex({ createdAt: -1 });
    console.log('✅ Indexes created');

    // Auto-seed default administrative credential if not already present
    try {
      const adminEmail = 'imtsky24@gmail.com';
      const existingAdmin = await usersCollection.findOne({ email: adminEmail });
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('adminim', 12);
        await usersCollection.insertOne({
          email: adminEmail,
          name: 'Imtiaz Ahmed (Chief Admin)',
          password: hashedPassword,
          role: 'admin',
          createdAt: new Date()
        });
        console.log('✅ Default admin seeded in database: imtsky24@gmail.com');
      }
    } catch (adminSeedErr) {
      console.log('Note: Admin check/seed:', adminSeedErr.message);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTH ROUTES
    // ═══════════════════════════════════════════════════════════════════════════

    // Register (for initial admin setup)
    app.post('/api/auth/register', [
      body('email').isEmail().normalizeEmail(),
      body('password').isLength({ min: 6 }),
      body('name').trim().notEmpty()
    ], async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      try {
        const { email, password, name } = req.body;
        const existing = await usersCollection.findOne({ email });
        if (existing) return res.status(409).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await usersCollection.insertOne({
          email, name,
          password: hashedPassword,
          role: 'admin',
          createdAt: new Date()
        });

        const token = jwt.sign(
          { userId: result.insertedId, email, name, role: 'admin' },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        res.status(201).json({ token, user: { email, name, role: 'admin' } });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // Login with email/password
    app.post('/api/auth/login', [
      body('email').isEmail().normalizeEmail(),
      body('password').notEmpty()
    ], async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      try {
        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
          { userId: user._id, email: user.email, name: user.name, role: user.role },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        res.json({ token, user: { email: user.email, name: user.name, role: user.role } });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // Firebase / Social Login - exchange Firebase token for JWT
    app.post('/api/auth/firebase', async (req, res) => {
      try {
        const { email, name, uid, photoURL } = req.body;
        if (!email) return res.status(400).json({ message: 'Email required' });

        let user = await usersCollection.findOne({ email });
        if (!user) {
          const result = await usersCollection.insertOne({
            email, name, uid, photoURL,
            role: 'admin',
            provider: 'firebase',
            createdAt: new Date()
          });
          user = { _id: result.insertedId, email, name, role: 'admin' };
        }

        const token = jwt.sign(
          { userId: user._id, email: user.email, name: user.name, role: user.role },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        res.json({ token, user: { email: user.email, name: user.name, role: user.role, photoURL } });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // DASHBOARD ROUTES
    // ═══════════════════════════════════════════════════════════════════════════

    app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
      try {
        const [totalDoctors, totalPatients] = await Promise.all([
          doctorsCollection.countDocuments(),
          patientsCollection.countDocuments()
        ]);

        // Patients per doctor (top 10)
        const patientsPerDoctor = await patientsCollection.aggregate([
          { $group: { _id: '$doctorId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'doctors',
              let: { docId: { $toObjectId: '$_id' } },
              pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$docId'] } } }],
              as: 'doctor'
            }
          },
          { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              doctorName: { $ifNull: ['$doctor.name', 'Unknown'] },
              specialization: { $ifNull: ['$doctor.specialization', 'N/A'] },
              count: 1
            }
          }
        ]).toArray();

        // New patients per month (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const patientsOverTime = await patientsCollection.aggregate([
          { $match: { createdAt: { $gte: sixMonthsAgo } } },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]).toArray();

        // Doctors by specialization
        const doctorsBySpecialization = await doctorsCollection.aggregate([
          { $group: { _id: '$specialization', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]).toArray();

        // Patients by condition
        const patientsByCondition = await patientsCollection.aggregate([
          { $group: { _id: '$condition', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 }
        ]).toArray();

        // Recent activity
        const recentDoctors = await doctorsCollection.find().sort({ createdAt: -1 }).limit(5).toArray();
        const recentPatients = await patientsCollection.find().sort({ createdAt: -1 }).limit(5).toArray();

        res.json({
          totalDoctors, totalPatients,
          patientsPerDoctor,
          patientsOverTime,
          doctorsBySpecialization,
          patientsByCondition,
          recentDoctors,
          recentPatients,
          avgPatientsPerDoctor: totalDoctors > 0 ? (totalPatients / totalDoctors).toFixed(1) : 0
        });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC HEALTH BLOGS ROUTE (Fetched from MongoDB)
    // ═══════════════════════════════════════════════════════════════════════════
    app.get('/api/blogs', async (req, res) => {
      try {
        const blogs = await blogsCollection.find().sort({ createdAt: -1 }).toArray();
        res.json({ success: true, count: blogs.length, data: blogs });
      } catch (err) {
        res.status(500).json({ message: 'Error fetching blogs', error: err.message });
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // DOCTOR ROUTES
    // ═══════════════════════════════════════════════════════════════════════════

    // GET all doctors with search, filter, pagination
    app.get('/api/doctors', verifyToken, async (req, res) => {
      try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const specialization = req.query.specialization || '';
        const hospital = req.query.hospital || '';
        const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
        const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        const filter = {};

        if (search) {
          const searchRegex = { $regex: search, $options: 'i' };
          filter.$or = [
            { name: searchRegex },
            { specialization: searchRegex },
            { hospital: searchRegex },
            { email: searchRegex }
          ];
        }
        if (specialization) filter.specialization = { $regex: specialization, $options: 'i' };
        if (hospital) filter.hospital = { $regex: hospital, $options: 'i' };
        if (dateFrom || dateTo) {
          filter.createdAt = {};
          if (dateFrom) filter.createdAt.$gte = dateFrom;
          if (dateTo) {
            dateTo.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = dateTo;
          }
        }

        const [doctors, total] = await Promise.all([
          doctorsCollection
            .find(filter)
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit)
            .toArray(),
          doctorsCollection.countDocuments(filter)
        ]);

        // Get patient counts for each doctor
        const doctorIds = doctors.map(d => d._id.toString());
        const patientCounts = await patientsCollection.aggregate([
          { $match: { doctorId: { $in: doctorIds } } },
          { $group: { _id: '$doctorId', count: { $sum: 1 } } }
        ]).toArray();

        const countMap = {};
        patientCounts.forEach(p => { countMap[p._id] = p.count; });
        const enrichedDoctors = doctors.map(d => ({
          ...d,
          patientCount: countMap[d._id.toString()] || 0
        }));

        res.json({
          doctors: enrichedDoctors,
          total,
          page,
          totalPages: Math.ceil(total / limit),
          limit
        });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // GET single doctor
    app.get('/api/doctors/:id', verifyToken, async (req, res) => {
      try {
        const doctor = await doctorsCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
        res.json(doctor);
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // CREATE doctor
    app.post('/api/doctors', verifyToken, [
      body('name').trim().notEmpty().withMessage('Name is required'),
      body('specialization').trim().notEmpty().withMessage('Specialization is required'),
      body('hospital').trim().notEmpty().withMessage('Hospital is required'),
      body('phone').trim().notEmpty().withMessage('Phone is required'),
      body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
    ], async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      try {
        const { name, specialization, hospital, phone, email, bio, experience, rating } = req.body;
        const doctor = {
          name, specialization, hospital, phone, email,
          bio: bio || '',
          experience: experience || 0,
          rating: rating || 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const result = await doctorsCollection.insertOne(doctor);
        res.status(201).json({ ...doctor, _id: result.insertedId });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // UPDATE doctor
    app.put('/api/doctors/:id', verifyToken, async (req, res) => {
      try {
        const { name, specialization, hospital, phone, email, bio, experience, rating } = req.body;
        const updateData = {
          $set: {
            ...(name && { name }),
            ...(specialization && { specialization }),
            ...(hospital && { hospital }),
            ...(phone && { phone }),
            ...(email && { email }),
            ...(bio !== undefined && { bio }),
            ...(experience !== undefined && { experience }),
            ...(rating !== undefined && { rating }),
            updatedAt: new Date()
          }
        };
        const result = await doctorsCollection.findOneAndUpdate(
          { _id: new ObjectId(req.params.id) },
          updateData,
          { returnDocument: 'after' }
        );
        if (!result) return res.status(404).json({ message: 'Doctor not found' });
        res.json(result);
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // DELETE doctor
    app.delete('/api/doctors/:id', verifyToken, async (req, res) => {
      try {
        const doctorId = req.params.id;
        await patientsCollection.deleteMany({ doctorId });
        const result = await doctorsCollection.deleteOne({ _id: new ObjectId(doctorId) });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Doctor not found' });
        res.json({ message: 'Doctor and associated patients deleted successfully' });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // GET doctor's patients
    app.get('/api/doctors/:id/patients', verifyToken, async (req, res) => {
      try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const doctorId = req.params.id;

        const [patients, total] = await Promise.all([
          patientsCollection.find({ doctorId }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
          patientsCollection.countDocuments({ doctorId })
        ]);

        res.json({ patients, total, page, totalPages: Math.ceil(total / limit) });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // GET specializations list (for filter dropdowns)
    app.get('/api/doctors/meta/specializations', verifyToken, async (req, res) => {
      try {
        const specializations = await doctorsCollection.distinct('specialization');
        res.json(specializations.filter(Boolean));
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PATIENT ROUTES
    // ═══════════════════════════════════════════════════════════════════════════

    // GET all patients with search, filter, pagination
    app.get('/api/patients', verifyToken, async (req, res) => {
      try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const condition = req.query.condition || '';
        const doctorId = req.query.doctorId || '';
        const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
        const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        const filter = {};
        if (search) {
          const searchRegex = { $regex: search, $options: 'i' };
          filter.$or = [
            { name: searchRegex },
            { condition: searchRegex },
            { email: searchRegex },
            { phone: searchRegex }
          ];
        }
        if (condition) filter.condition = { $regex: condition, $options: 'i' };
        if (doctorId) filter.doctorId = doctorId;
        if (dateFrom || dateTo) {
          filter.createdAt = {};
          if (dateFrom) filter.createdAt.$gte = dateFrom;
          if (dateTo) {
            dateTo.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = dateTo;
          }
        }

        const [patients, total] = await Promise.all([
          patientsCollection.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit).toArray(),
          patientsCollection.countDocuments(filter)
        ]);

        // Enrich with doctor info
        const enriched = await Promise.all(patients.map(async (p) => {
          let doctor = null;
          if (p.doctorId) {
            try {
              doctor = await doctorsCollection.findOne({ _id: new ObjectId(p.doctorId) }, { projection: { name: 1, specialization: 1 } });
            } catch { }
          }
          return { ...p, doctor };
        }));

        res.json({ patients: enriched, total, page, totalPages: Math.ceil(total / limit), limit });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // GET single patient
    app.get('/api/patients/:id', verifyToken, async (req, res) => {
      try {
        const patient = await patientsCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!patient) return res.status(404).json({ message: 'Patient not found' });
        res.json(patient);
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // CREATE patient
    app.post('/api/patients', verifyToken, [
      body('name').trim().notEmpty().withMessage('Name is required'),
      body('age').isInt({ min: 0, max: 150 }).withMessage('Valid age required'),
      body('condition').trim().notEmpty().withMessage('Condition is required'),
      body('doctorId').trim().notEmpty().withMessage('Doctor is required'),
    ], async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      try {
        const { name, age, gender, condition, doctorId, phone, email, address, bloodGroup, notes } = req.body;
        const patient = {
          name, age: parseInt(age), gender: gender || 'Other',
          condition, doctorId, phone: phone || '',
          email: email || '', address: address || '',
          bloodGroup: bloodGroup || '',
          notes: notes || '',
          status: 'Active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const result = await patientsCollection.insertOne(patient);
        res.status(201).json({ ...patient, _id: result.insertedId });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // UPDATE patient
    app.put('/api/patients/:id', verifyToken, async (req, res) => {
      try {
        const { name, age, gender, condition, doctorId, phone, email, address, bloodGroup, notes, status } = req.body;
        const updateData = {
          $set: {
            ...(name && { name }),
            ...(age !== undefined && { age: parseInt(age) }),
            ...(gender && { gender }),
            ...(condition && { condition }),
            ...(doctorId && { doctorId }),
            ...(phone !== undefined && { phone }),
            ...(email !== undefined && { email }),
            ...(address !== undefined && { address }),
            ...(bloodGroup !== undefined && { bloodGroup }),
            ...(notes !== undefined && { notes }),
            ...(status && { status }),
            updatedAt: new Date()
          }
        };
        const result = await patientsCollection.findOneAndUpdate(
          { _id: new ObjectId(req.params.id) },
          updateData,
          { returnDocument: 'after' }
        );
        if (!result) return res.status(404).json({ message: 'Patient not found' });
        res.json(result);
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // DELETE patient
    app.delete('/api/patients/:id', verifyToken, async (req, res) => {
      try {
        const result = await patientsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Patient not found' });
        res.json({ message: 'Patient deleted successfully' });
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // GET distinct patient conditions (for filter dropdowns)
    app.get('/api/patients/meta/conditions', verifyToken, async (req, res) => {
      try {
        const conditions = await patientsCollection.distinct('condition');
        res.json(conditions.filter(Boolean));
      } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // AI CHATBOT ROUTE
    // ═══════════════════════════════════════════════════════════════════════════
    app.post('/api/chat', verifyToken, async (req, res) => {
      try {
        const { message, history } = req.body;
        if (!message) return res.status(400).json({ message: 'Message is required' });

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
          return res.status(500).json({ message: 'Gemini API key not configured' });
        }

        // Get context from DB
        const [totalDoctors, totalPatients] = await Promise.all([
          doctorsCollection.countDocuments(),
          patientsCollection.countDocuments()
        ]);

        const systemPrompt = `You are MedBot, a helpful AI assistant for the DoctorTracker healthcare management portal. 
You help administrators manage doctor and patient records efficiently.
Current system stats: ${totalDoctors} doctors, ${totalPatients} patients registered.
You can help with:
- Understanding how to use the system
- Medical terminology and specializations
- Patient management best practices
- Data interpretation and insights
- General healthcare administration questions
Keep responses concise, professional, and helpful. Format lists with bullet points.`;

        const contents = [];
        if (history && Array.isArray(history)) {
          history.forEach(h => {
            contents.push({ role: h.role, parts: [{ text: h.content }] });
          });
        }
        contents.push({ role: 'user', parts: [{ text: message }] });

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents,
              generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
            })
          }
        );

        const data = await response.json();
        if (data.error) return res.status(500).json({ message: data.error.message });

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not generate a response.';
        res.json({ reply });
      } catch (err) {
        res.status(500).json({ message: 'Chat service error', error: err.message });
      }
    });

    // Health check
    app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

    app.listen(port, () => console.log(`🚀 DoctorTracker Server running on port ${port}`));
  } catch (err) {
    console.error('❌ Failed to connect:', err);
    process.exit(1);
  }
}

run();
