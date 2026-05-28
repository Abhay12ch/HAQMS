'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/common/Navbar';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Activity, User, ShieldAlert, Calendar, Mail, Phone,
  Clock, Heart, FileText, ShieldCheck
} from 'lucide-react';

export default function PatientHistoryRecords() {
  const { user, token, API_BASE_URL } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [patient, setPatient] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Navigation Guard
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user]);

  // Fetch Patient & Doctors data
  useEffect(() => {
    if (!user || !id || !token) return;

    // Check authorization: only DOCTOR or ADMIN can view clinical history
    if (user.role !== 'DOCTOR' && user.role !== 'ADMIN') {
      setLoading(false);
      setError('ACCESS DENIED: You do not have the required permissions to view clinical patient records.');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch patient with appointments
        const patientRes = await fetch(`${API_BASE_URL}/patients/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!patientRes.ok) {
          if (patientRes.status === 404) {
            throw new Error('Patient record not found.');
          }
          throw new Error('Failed to retrieve patient medical records.');
        }
        
        const patientData = await patientRes.json();
        setPatient(patientData);

        // Fetch doctors list for name lookup
        const doctorsRes = await fetch(`${API_BASE_URL}/doctors`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (doctorsRes.ok) {
          const doctorsData = await doctorsRes.json();
          setDoctors(doctorsData);
        }
        
        setError('');
      } catch (err) {
        console.error('Failed to load patient history records:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user, token]);

  if (!user) return null;

  // Build doctor lookup map
  const doctorMap = {};
  doctors.forEach(doc => {
    doctorMap[doc.id] = doc;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 sm:p-8">
        
        {/* Back Link Button */}
        <div className="mb-6">
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Staff Dashboard
          </Link>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="pulse-loader">
              <div></div>
              <div></div>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-400">Retrieving secure clinical history records...</p>
          </div>
        ) : error ? (
          /* Error / Access Denied State */
          <div className="glass p-8 rounded-2xl border border-rose-500/35 bg-rose-500/5 text-center max-w-2xl mx-auto space-y-4">
            <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto animate-pulse" />
            <h3 className="text-xl font-extrabold text-slate-200">Security Clearance Error</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              {error}
            </p>
            <div className="pt-4">
              <Link 
                href="/dashboard"
                className="px-6 py-2.5 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 font-extrabold text-xs rounded-lg border border-rose-500/30 transition-all uppercase tracking-widest"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : patient ? (
          /* Main Clinical Record Layout */
          <div className="space-y-8">
            
            {/* Header Banner Section */}
            <div className="glass p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-teal-500/10 text-teal-400 rounded-2xl border border-teal-500/20 shadow-inner">
                  <User className="h-8 w-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-slate-100 tracking-tight">{patient.name}</h1>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 text-xxs font-extrabold tracking-wide uppercase border border-teal-500/20">
                      <ShieldCheck className="h-3 w-3" />
                      Clearance Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Patient Case ID: <span className="font-mono text-teal-400 font-bold">{patient.id}</span>
                  </p>
                </div>
              </div>

              {/* Bio Details Cards */}
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="px-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl">
                  <span className="block text-slate-500 font-bold uppercase tracking-wider text-xxs">Age</span>
                  <span className="font-bold text-slate-200">{patient.age} Years</span>
                </div>
                <div className="px-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl">
                  <span className="block text-slate-500 font-bold uppercase tracking-wider text-xxs">Gender</span>
                  <span className="font-bold text-slate-200 capitalize">{patient.gender}</span>
                </div>
              </div>
            </div>

            {/* Grid for Medical History & Contact Info */}
            <div className="grid gap-8 md:grid-cols-3">
              
              {/* Patient Contact Info Card */}
              <div className="glass p-6 rounded-2xl border border-slate-800 bg-slate-900/30 h-fit space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                  Contact Information
                </h3>
                <div className="space-y-3.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-teal-400 shrink-0" />
                    <span className="font-semibold">{patient.phoneNumber}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 text-teal-400 shrink-0" />
                    <span className="font-semibold truncate">{patient.email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-4 w-4 text-teal-400 shrink-0" />
                    <span className="text-slate-400">Registered: </span>
                    <span className="font-semibold">{new Date(patient.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Medical History Card */}
              <div className="md:col-span-2 glass p-6 rounded-2xl border border-slate-800 bg-slate-900/30 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-500" />
                  Clinical Anamnesis / Medical History
                </h3>
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-sm leading-relaxed text-slate-300 font-medium">
                  {patient.medicalHistory ? (
                    patient.medicalHistory.toUpperCase()
                  ) : (
                    <span className="italic text-slate-500">NO RELEVANT MEDICAL HISTORY OR PRE-EXISTING CONDITIONS REGISTERED FOR THIS PATIENT RECORD.</span>
                  )}
                </div>
              </div>

            </div>

            {/* Appointment Consultation History Table */}
            <div className="glass p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/30 space-y-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-400" />
                Clinical Consultation Chronology
              </h3>

              {!patient.appointments || patient.appointments.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic text-sm">
                  No appointments registered in chronology for this patient.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-sm text-left">
                    <thead>
                      <tr className="text-slate-500 uppercase tracking-widest text-xxs font-bold border-b border-slate-800">
                        <th className="pb-3">Date & Time</th>
                        <th className="pb-3">Attending Physician</th>
                        <th className="pb-3">Consultation Reason</th>
                        <th className="pb-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {patient.appointments.map((app) => {
                        const doctor = doctorMap[app.doctorId];
                        return (
                          <tr key={app.id} className="hover:bg-slate-900/25 transition-colors">
                            <td className="py-4 font-mono text-slate-300 text-xs font-bold">
                              {new Date(app.appointmentDate).toLocaleString([], {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="py-4 font-bold text-slate-200">
                              {doctor ? doctor.name : `Dr. ID: ${app.doctorId.slice(0, 8)}`}
                              {doctor && (
                                <span className="block text-xxs text-slate-500 font-normal uppercase tracking-wider mt-0.5">
                                  {doctor.specialization}
                                </span>
                              )}
                            </td>
                            <td className="py-4 text-slate-400 font-semibold">{app.reason || 'Routine general checkup'}</td>
                            <td className="py-4 text-right">
                              <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-extrabold tracking-wide uppercase border ${
                                app.status === 'COMPLETED' 
                                  ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' 
                                  : app.status === 'CANCELLED' 
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {app.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="text-center text-slate-400 py-12">No patient details resolved.</div>
        )}

      </main>
    </div>
  );
}
