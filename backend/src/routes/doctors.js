const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/doctors
// Retrieve list of doctors with special search filtering
// SECURITY BUG: SQL Injection vulnerability in the search parameter!
// Uses queryRawUnsafe with string concatenation instead of parameterized inputs.
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, specialization } = req.query;

    const doctors = await prisma.doctor.findMany({
      where: {
        name: search ? { contains: search, mode: 'insensitive' } : undefined,
        specialization: (specialization && specialization !== 'All') ? specialization : undefined,
      },
    });

    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Database execution failure' });
  }
});

// GET /api/doctors/stats
// Returns aggregation details about available doctors
// PERFORMANCE BUG: Sequential async calls instead of Promise.all()
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [totalDoctors, surgeonsCount, averageFee, highestExperience] = await Promise.all([
      prisma.doctor.count(),
      prisma.doctor.count({
        where: { department: 'Surgery' },
      }),
      prisma.doctor.aggregate({
        _avg: {
          consultationFee: true,
        },
      }),
      prisma.doctor.aggregate({
        _max: {
          experience: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total: totalDoctors,
        surgeons: surgeonsCount,
        averageFee: Math.round(averageFee._avg.consultationFee || 0),
        maxExperience: highestExperience._max.experience || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching doctor stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/doctors/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json(doctor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
