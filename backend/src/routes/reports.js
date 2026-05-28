const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/reports/doctor-stats
// Highly inefficient nested loop aggregate reporting for admin/receptionists dashboard
// PERFORMANCE BUG: Performs multiple nested DB queries inside a loop for every doctor.
// Runs sequentially, blocking/scaling terrible with doctors count.
router.get('/doctor-stats', authenticate, async (req, res) => {
  try {
    const start = Date.now();

    // 1. Fetch all doctors and stats in parallel
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [doctors, appointmentStats, queueStats] = await Promise.all([
      prisma.doctor.findMany(),
      prisma.appointment.groupBy({
        by: ['doctorId', 'status'],
        _count: {
          _all: true,
        },
      }),
      prisma.queueToken.groupBy({
        by: ['doctorId'],
        where: {
          createdAt: { gte: today },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    // 2. Build lookup maps for fast O(1) access
    const appMap = {};
    appointmentStats.forEach(stat => {
      if (!appMap[stat.doctorId]) {
        appMap[stat.doctorId] = { PENDING: 0, COMPLETED: 0, CANCELLED: 0 };
      }
      appMap[stat.doctorId][stat.status] = stat._count._all;
    });

    const queueMap = {};
    queueStats.forEach(stat => {
      queueMap[stat.doctorId] = stat._count._all;
    });

    // 3. Compile report data
    const reportData = doctors.map(doc => {
      const docApps = appMap[doc.id] || { PENDING: 0, COMPLETED: 0, CANCELLED: 0 };
      const totalAppointments = docApps.PENDING + docApps.COMPLETED + docApps.CANCELLED;
      const completedAppointments = docApps.COMPLETED;
      const cancelledAppointments = docApps.CANCELLED;
      const todayQueueSize = queueMap[doc.id] || 0;
      const revenue = completedAppointments * doc.consultationFee;

      return {
        id: doc.id,
        name: doc.name,
        specialization: doc.specialization,
        department: doc.department,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        todayQueueSize,
        revenue,
      };
    });

    const durationMs = Date.now() - start;

    res.json({
      success: true,
      timeTakenMs: durationMs,
      data: reportData,
    });
  } catch (error) {
    console.error('Failed to generate doctor stats report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
