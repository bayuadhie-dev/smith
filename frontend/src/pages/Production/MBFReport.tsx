import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { 
  CalendarIcon, 
  ChartBarIcon, 
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  UserIcon,
  ArrowLeftIcon,
  DocumentArrowDownIcon,
  PaperAirplaneIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  ChatBubbleBottomCenterTextIcon,
  PlusIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ArchiveBoxIcon,
  InformationCircleIcon,
  CalendarDaysIcon,
  DocumentPlusIcon,
  CursorArrowRaysIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import axios from 'axios';
import { format } from 'date-fns';
import { usePermissions } from '../../contexts/PermissionContext';

// Types
interface MBFReport {
  id: number;
  report_number: string;
  delivery_date: string;
  period_start: string;
  period_end: string;
  target_octenic: number;
  target_gloveclean: number;
  total_target: number;
  actual_octenic: number;
  actual_gloveclean: number;
  total_actual: number;
  achievement_percentage: number;
  // Carton values
  target_octenic_cartons: number;
  target_gloveclean_cartons: number;
  total_target_cartons: number;
  actual_octenic_cartons: number;
  actual_gloveclean_cartons: number;
  total_actual_cartons: number;
  issue_explanation?: string;
  status: string;
  approval_status?: string;
  approvals: {
    staff: { name?: string; signature?: string; date?: string; notes?: string };
    supervisor: { name?: string; signature?: string; date?: string; notes?: string };
    manager: { name?: string; signature?: string; date?: string; notes?: string };
  };
  created_at: string;
  created_by: number;
  details_by_day: { [key: string]: MBFReportDetail[] };
}

interface MBFReportDetail {
  id: number;
  day_name?: string;
  day_date?: string;
  shift_number: number;
  shift_name: string;
  target_octenic: number;
  target_gloveclean: number;
  target_total: number;
  actual_octenic: number;
  actual_gloveclean: number;
  actual_total: number;
  target_cloth_octenic: number;
  target_cloth_gloveclean: number;
  target_isolation_roll: number;
  target_karton_octenic: number;
  target_karton_gloveclean: number;
  actual_cloth_octenic: number;
  actual_cloth_gloveclean: number;
  actual_isolation_roll: number;
  actual_karton_octenic: number;
  actual_karton_gloveclean: number;
  target_roll_packaging_octenic: number;
  target_roll_packaging_gloveclean: number;
  actual_roll_packaging_octenic: number;
  actual_roll_packaging_gloveclean: number;
  target_roll_sticker_octenic: number;
  actual_roll_sticker_octenic: number;
  status: 'achieved' | 'minus';
  notes?: string;
  // New quality fields
  octn_setting_packaging: number;
  octn_setting_sticker: number;
  octn_grade_b: number;
  octn_grade_c: number;
  octn_waste_packaging: number;
  octn_waste_sticker: number;
  glvcn_setting_packaging: number;
  glvcn_grade_b: number;
  glvcn_grade_c: number;
  glvcn_waste_packaging: number;
}

interface FormData {
  delivery_date: string;
  period_start: string;
  period_end: string;
  target_octenic: number;
  target_gloveclean: number;
  issue_explanation?: string;
}

const MBFReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const isNew = !id;

  const { isAdmin, isSuperAdmin } = usePermissions();
  const [report, setReport] = useState<MBFReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedShift2Days, setExpandedShift2Days] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<string>('');

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      delivery_date: format(new Date(), 'yyyy-MM-dd'),
      period_start: format(new Date(), 'yyyy-MM-dd'),
      period_end: format(new Date(), 'yyyy-MM-dd'),
      target_octenic: 0,
      target_gloveclean: 0,
      issue_explanation: ''
    }
  });

  const watchedValues = watch();

  // Fetch report data if editing
  useEffect(() => {
    if (isEditing && id) {
      fetchReport();
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || (user.is_super_admin ? 'superadmin' : user.is_admin ? 'admin' : ''));
  }, [id, isEditing]);

  useEffect(() => {
    if (report) {
      // Set form values
      setValue('delivery_date', report.delivery_date.split('T')[0]);
      setValue('period_start', report.period_start.split('T')[0]);
      setValue('period_end', report.period_end.split('T')[0]);
      // Convert pcs back to karton for form display, round to avoid decimals
      setValue('target_octenic', Math.round(report.target_octenic / 39));
      setValue('target_gloveclean', Math.round(report.target_gloveclean / 72));
      setValue('issue_explanation', report.issue_explanation || '');
    }
  }, [report, setValue]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/mbf-report/reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReport(response.data.report);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const createReport = async (data: FormData) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      // Convert cartons back to pieces for backend storage
      const payload = {
        ...data,
        target_octenic: (data.target_octenic || 0) * 39,
        target_gloveclean: (data.target_gloveclean || 0) * 72
      };
      const response = await axios.post('/api/mbf-report/reports', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Report created successfully');
      navigate(`/app/production/mbf-report/${response.data.report_id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create report');
    } finally {
      setSaving(false);
    }
  };

  const updateReport = async (data: FormData) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      // Convert cartons back to pieces for backend storage
      const payload = {
        ...data,
        target_octenic: (data.target_octenic || 0) * 39,
        target_gloveclean: (data.target_gloveclean || 0) * 72,
        details: report?.details_by_day ? Object.values(report.details_by_day).flat() : []
      };
      await axios.put(`/api/mbf-report/reports/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Report updated successfully');
      if (id) fetchReport();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update report');
    } finally {
      setSaving(false);
    }
  };

  const submitReport = async () => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(`/api/mbf-report/reports/${id}/submit`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Report submitted for approval');
      if (id) fetchReport();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const approveReport = async (level: 'supervisor' | 'manager') => {
    try {
      const token = localStorage.getItem('token');
      const notes = prompt('Add approval notes (optional):');
      await axios.post(`/api/mbf-report/reports/${id}/approve`, 
        { level, notes: notes || '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Report approved');
      if (id) fetchReport();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve report');
    }
  };

  const rejectReport = async () => {
    try {
      const reason = prompt('Reason for rejection:');
      if (!reason) return;
      
      const token = localStorage.getItem('token');
      await axios.post(`/api/mbf-report/reports/${id}/reject`, 
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Report rejected');
      if (id) fetchReport();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject report');
    }
  };

  const syncProductionData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/mbf-report/sync-production-data', 
        { report_id: id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.synced === false) {
        toast.error(response.data.message || 'No work orders found for this period');
      } else {
        toast.success(response.data.message || 'Production data synced successfully');
      }
      if (id) fetchReport();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to sync production data');
    }
  };

  const updateDetailValue = (day: string, shift: number, field: string, value: number | string) => {
    setReport(prev => {
      if (!prev) return prev;
      
      // Deep clone: create new arrays for EVERY day to prevent reference leaks
      const updatedDetails: Record<string, any[]> = {};
      for (const [key, arr] of Object.entries(prev.details_by_day)) {
        updatedDetails[key] = arr.map(d => ({ ...d }));
      }
      
      const dayDetails = updatedDetails[day];
      if (!dayDetails) return prev;
      
      const detailIndex = dayDetails.findIndex(d => d.shift_number === shift);
      if (detailIndex < 0) return prev;
      
      const detail = dayDetails[detailIndex];
      (detail as any)[field] = value;
      
      // Constants
      const OCTENIC_CLOTH_PER_PCS = 0.9; // 35.1 meters / 39 pcs
      const GLOVECLEAN_CLOTH_PER_PCS = 0.4875; // 35.1 meters / 72 pcs

      // Recalculate totals and auto-calc kebutuhan
      if (field === 'target_octenic' || field === 'target_gloveclean') {
        detail.target_total = detail.target_octenic + detail.target_gloveclean;
        detail.target_cloth_octenic = detail.target_octenic * OCTENIC_CLOTH_PER_PCS;
        detail.target_cloth_gloveclean = detail.target_gloveclean * GLOVECLEAN_CLOTH_PER_PCS;
        detail.target_karton_octenic = detail.target_octenic > 0 ? detail.target_octenic / 39 : 0;
        detail.target_karton_gloveclean = detail.target_gloveclean > 0 ? detail.target_gloveclean / 72 : 0;
        detail.target_roll_packaging_octenic = detail.target_octenic > 0 ? detail.target_octenic / 4761 : 0;
        detail.target_roll_packaging_gloveclean = detail.target_gloveclean > 0 ? detail.target_gloveclean / 5000 : 0;
        detail.target_roll_sticker_octenic = detail.target_octenic > 0 ? detail.target_octenic / 2000 : 0;
      } else if (field === 'actual_octenic' || field === 'actual_gloveclean') {
        detail.actual_total = (detail.actual_octenic || 0) + (detail.actual_gloveclean || 0);
        detail.actual_cloth_octenic = (detail.actual_octenic || 0) * OCTENIC_CLOTH_PER_PCS;
        detail.actual_cloth_gloveclean = (detail.actual_gloveclean || 0) * GLOVECLEAN_CLOTH_PER_PCS;
        detail.actual_roll_sticker_octenic = detail.actual_octenic > 0 ? detail.actual_octenic / 2000 : 0;
        
        // Auto-calculate packaging rolls (Bug fix)
        detail.actual_roll_packaging_octenic = (detail.actual_octenic || 0) > 0 ? (detail.actual_octenic || 0) / 4761 : 0;
        detail.actual_roll_packaging_gloveclean = (detail.actual_gloveclean || 0) > 0 ? (detail.actual_gloveclean || 0) / 5000 : 0;
        
        // Auto-calculate isolation roll (1 roll per 100 cartons)
        detail.actual_isolation_roll = (detail.actual_octenic || 0) > 0 ? (detail.actual_octenic || 0) / 3900 : 0;
      } else if (field.includes('grade') || field.includes('setting')) {
        // Handle Octenic Quality/Waste
        if (field.startsWith('octn_')) {
          const wasteBase = (detail.octn_setting_packaging || 0) + 
                            (detail.octn_setting_sticker || 0) + 
                            (detail.octn_grade_b || 0) + 
                            (detail.octn_grade_c || 0);
          detail.octn_waste_packaging = wasteBase / 4761;
          detail.octn_waste_sticker = ((detail.octn_setting_sticker || 0) + 
                                       (detail.octn_grade_b || 0) + 
                                       (detail.octn_grade_c || 0)) / 2000;
          detail.octn_waste_cloth_chem = `${((detail.octn_grade_c || 0) * 0.9).toFixed(1)}m / ${((detail.octn_grade_c || 0) * 81).toFixed(0)}g`;
        }
        // Handle Gloveclean Quality/Waste
        if (field.startsWith('glvcn_')) {
          const wasteBase = (detail.glvcn_setting_packaging || 0) + 
                            (detail.glvcn_grade_b || 0) + 
                            (detail.glvcn_grade_c || 0);
          detail.glvcn_waste_packaging = wasteBase / 5000;
          detail.glvcn_waste_cloth_chem = `${((detail.glvcn_grade_c || 0) * 0.4875).toFixed(1)}m / ${((detail.glvcn_grade_c || 0) * 37.8).toFixed(1)}ml`;
        }
      }
      
      detail.status = (detail.actual_total || 0) >= (detail.target_total || 0) ? 'achieved' : 'minus';
      
      const newReport = { ...prev, details_by_day: updatedDetails };
      
      // Auto-summarize notes into issue_explanation
      if (field === 'notes') {
        const dayNamesId: Record<string, string> = { Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu', Thursday: 'Kamis', Friday: 'Jumat', Saturday: 'Sabtu', Sunday: 'Minggu' };
        const allNotes = Object.entries(updatedDetails)
          .flatMap(([, details]) =>
            details
              .filter(d => d.notes && d.notes.trim() !== '')
              .map(d => `${dayNamesId[d.day_name || ''] || d.day_name || ''}: ${d.notes}`)
          );
        
        const summaryStr = allNotes.length > 0 ? allNotes.join('; ') : '';
        newReport.issue_explanation = summaryStr;
        setValue('issue_explanation', summaryStr, { shouldDirty: true, shouldValidate: true });
      }

      return newReport;
    });
  };

  const role = userRole ? userRole.toLowerCase() : '';
  const isAdminOrManager = role.includes('admin') || role.includes('manager') || role.includes('supervisor') || isAdmin || isSuperAdmin;
  const canEdit = isNew || report?.status === 'draft';
  const canSubmit = report?.status === 'draft' && (role.includes('staff') || isAdminOrManager);
  const canApproveSupervisor = report?.status === 'pending_review' && (role.includes('supervisor') || isAdminOrManager);
  const canApproveManager = report?.status === 'pending_review' && (isAdminOrManager && (report?.approvals.supervisor.date || role.includes('admin') || isSuperAdmin));

  // Computed summary values (reactive to form inputs)
  // Input is in KARTON, convert to pcs: Octenic = 39 pcs/karton, Gloveclean = 72 pcs/karton
  const OCTENIC_PER_KARTON = 39;
  const GLOVECLEAN_PER_KARTON = 72;
  const computedTargetOctenicKarton = Number(watchedValues.target_octenic) || 0;
  const computedTargetGlovecleanKarton = Number(watchedValues.target_gloveclean) || 0;
  const computedTargetOctenicPcs = computedTargetOctenicKarton * OCTENIC_PER_KARTON;
  const computedTargetGlovecleanPcs = computedTargetGlovecleanKarton * GLOVECLEAN_PER_KARTON;
  const computedTotalTargetPcs = computedTargetOctenicPcs + computedTargetGlovecleanPcs;
  const computedTotalTargetKarton = computedTargetOctenicKarton + computedTargetGlovecleanKarton;
  const computedTotalActual = report ? Number(report.total_actual) : 0;
  const computedActualOctenic = report ? Number(report.actual_octenic) : 0;
  const computedActualGloveclean = report ? Number(report.actual_gloveclean) : 0;
  const computedActualKarton = (computedActualOctenic / OCTENIC_PER_KARTON) + (computedActualGloveclean / GLOVECLEAN_PER_KARTON);
  const computedAchievement = computedTotalTargetPcs > 0 ? (computedTotalActual / computedTotalTargetPcs * 100) : 0;
  const needsIssueExplanation = computedTotalActual < computedTotalTargetPcs && computedTotalTargetPcs > 0;

  const prepareDashboardData = () => {
    if (!report) return { radialData: [], productData: [], wasteData: [] };
    
    // 1. Overall Achievement Data for Radial Bar
    const radialData = [
      { name: 'Total Achievement', value: computedAchievement, fill: '#10b981' }
    ];

    // 2. Comparative Product Benchmark
    const productData = [
      { name: 'Octenic', Target: computedTargetOctenicPcs, Actual: computedActualOctenic },
      { name: 'Gloveclean', Target: computedTargetGlovecleanPcs, Actual: computedActualGloveclean }
    ];

    // 3. Detailed Waste Aggregates
    const details = Object.values(report.details_by_day).flat();
    const octnWastePcs = details.reduce((sum, d) => sum + (Number(d.octn_setting_packaging) || 0) + (Number(d.octn_setting_sticker) || 0) + (Number(d.octn_grade_b) || 0) + (Number(d.octn_grade_c) || 0), 0);
    const glvcnWastePcs = details.reduce((sum, d) => sum + (Number(d.glvcn_setting_packaging) || 0) + (Number(d.glvcn_grade_b) || 0) + (Number(d.glvcn_grade_c) || 0), 0);
    
    const octnMeters = octnWastePcs * 0.9;
    const glvcnMeters = glvcnWastePcs * 0.4875;

    const wasteMetrics = {
      octn: {
        cloth: octnMeters,
        chem: octnMeters * 90,
        pkg: details.reduce((sum, d) => sum + (Number(d.octn_waste_packaging) || 0), 0),
        stc: details.reduce((sum, d) => sum + (Number(d.octn_waste_sticker) || 0), 0),
        reject: details.reduce((sum, d) => sum + (Number(d.octn_grade_b) || 0) + (Number(d.octn_grade_c) || 0), 0)
      },
      glvcn: {
        cloth: glvcnMeters,
        chem: glvcnMeters * 80,
        pkg: details.reduce((sum, d) => sum + (Number(d.glvcn_waste_packaging) || 0), 0),
        reject: details.reduce((sum, d) => sum + (Number(d.glvcn_grade_b) || 0) + (Number(d.glvcn_grade_c) || 0), 0)
      }
    };

    return { radialData, productData, wasteMetrics };
  };



  const prepareChartData = () => {
    if (!report?.details_by_day) return [];
    
    return Object.entries(report.details_by_day)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, details]) => {
        const dayLabel = format(new Date(date), 'EEE');
        const dayTarget = details.reduce((sum, d) => sum + Number(d.target_total || 0), 0);
        const dayActual = details.reduce((sum, d) => sum + Number(d.actual_total || 0), 0);
        const octenic = details.reduce((sum, d) => sum + Number(d.actual_octenic || 0), 0);
        const gloveclean = details.reduce((sum, d) => sum + Number(d.actual_gloveclean || 0), 0);
        
        return {
          name: dayLabel,
          target: dayTarget,
          actual: dayActual,
          octenic,
          gloveclean,
          fullDate: date
        };
      });
  };

  const { radialData, productData, wasteMetrics } = prepareDashboardData();
  const chartData = prepareChartData();

  if (loading && isEditing) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-t-4 border-b-4 border-blue-600 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-4 bg-blue-600 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
           {/* Header with gradient */}
           <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-500 px-6 py-10 text-center text-white relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
              <div className="relative z-10">
                <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/30 shadow-inner">
                   <DocumentPlusIcon className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight">New Report</h2>
                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-[0.2em] mt-2 opacity-80">Initialize Production Period</p>
              </div>
           </div>
           
           <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                      <CalendarIcon className="h-3 w-3" />
                      Period Start
                    </label>
                    <Controller name="period_start" control={control} render={({ field }) => (
                       <input {...field} type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none" />
                    )} />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                      <CalendarIcon className="h-3 w-3" />
                      Period End
                    </label>
                    <Controller name="period_end" control={control} render={({ field }) => (
                       <input {...field} type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none" />
                    )} />
                 </div>
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                    <DocumentTextIcon className="h-3 w-3" />
                    Delivery Date
                 </label>
                 <Controller name="delivery_date" control={control} render={({ field }) => (
                    <input {...field} type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none" />
                 )} />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Target Octn (Ctn)</label>
                    <Controller name="target_octenic" control={control} render={({ field }) => (
                       <input {...field} type="number" placeholder="0" className="w-full bg-blue-50/30 border border-blue-100 rounded-xl px-4 py-2.5 text-base font-black text-blue-900 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none" />
                    )} />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Target Glvc (Ctn)</label>
                    <Controller name="target_gloveclean" control={control} render={({ field }) => (
                       <input {...field} type="number" placeholder="0" className="w-full bg-indigo-50/30 border border-indigo-100 rounded-xl px-4 py-2.5 text-base font-black text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none" />
                    )} />
                 </div>
              </div>

              <div className="space-y-3 pt-2">
                <button 
                  onClick={handleSubmit(createReport)} 
                  disabled={saving}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-xs tracking-[0.2em] uppercase transition-all shadow-xl shadow-indigo-200 hover:shadow-indigo-300 active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  {saving ? (
                     <div className="animate-spin h-5 w-5 border-3 border-white/30 border-t-white rounded-full" />
                  ) : <DocumentArrowDownIcon className="h-5 w-5" />}
                  Initialize Report
                </button>
                
                <button 
                  onClick={() => navigate('/app/production')}
                  className="w-full text-slate-400 hover:text-slate-600 font-bold text-[9px] uppercase tracking-[0.3em] py-2 transition-colors flex items-center justify-center gap-2"
                >
                   <ArrowLeftIcon className="h-3 w-3" />
                   Cancel
                </button>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-2 md:p-3">
      <div className="max-w-[1600px] mx-auto space-y-3">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-50 flex justify-between items-center bg-white">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => navigate('/app/production')} 
                className="p-1 hover:bg-gray-50 rounded-full transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4 text-gray-400" />
              </button>
              <div>
                <h1 className="text-[13px] font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
                  MBF Production & Delivery Target
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${report?.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {report?.status || 'Draft'}
                  </span>
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button disabled={saving} onClick={handleSubmit(isNew ? createReport : updateReport)} className="flex items-center px-4 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-bold hover:bg-blue-700 transition-all shadow-sm">
                <DocumentArrowDownIcon className="h-3.5 w-3.5 mr-1" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              {!isNew && canEdit && (
                <button onClick={syncProductionData} className="flex items-center px-4 py-1 bg-gray-600 text-white rounded-lg text-[11px] font-bold hover:bg-gray-700 transition-all shadow-sm">
                  <ArrowPathIcon className="h-3.5 w-3.5 mr-1" />
                  Sync
                </button>
              )}
              {canSubmit && (
                <button 
                  onClick={submitReport} 
                  disabled={submitting || (needsIssueExplanation && !watchedValues.issue_explanation)} 
                  className="flex items-center px-4 py-1 bg-green-600 text-white rounded-lg text-[11px] font-bold hover:bg-green-700 transition-all shadow-sm disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="h-3.5 w-3.5 mr-1" />
                  Submit for Approval
                </button>
              )}
            </div>
          </div>

          <div className="p-2 md:p-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Basic Info Group */}
              <div className="lg:col-span-8 p-3 bg-gray-50/50 rounded-xl border border-gray-100/50">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-[8px] font-bold text-gray-400 uppercase ml-1">Period Start</label>
                    <Controller
                      name="period_start"
                      control={control}
                      render={({ field }) => (
                        <input {...field} type="date" className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-gray-700 transition-all" disabled={!canEdit} />
                      )}
                    />
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-[8px] font-bold text-gray-400 uppercase ml-1">Period End</label>
                    <Controller
                      name="period_end"
                      control={control}
                      render={({ field }) => (
                        <input {...field} type="date" className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-gray-700 transition-all" disabled={!canEdit} />
                      )}
                    />
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-[8px] font-bold text-gray-400 uppercase ml-1">Delivery</label>
                    <Controller
                      name="delivery_date"
                      control={control}
                      render={({ field }) => (
                        <input {...field} type="date" className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-gray-700 transition-all" disabled={!canEdit} />
                      )}
                    />
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-[8px] font-bold text-gray-400 uppercase ml-1">Target Octn (Ctn)</label>
                    <Controller
                      name="target_octenic"
                      control={control}
                      render={({ field }) => (
                        <input {...field} type="number" onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-black text-blue-900 transition-all" disabled={!canEdit} />
                      )}
                    />
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-[8px] font-bold text-gray-400 uppercase ml-1">Target Glvcn (Ctn)</label>
                    <Controller
                      name="target_gloveclean"
                      control={control}
                      render={({ field }) => (
                        <input {...field} type="number" onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-black text-purple-900 transition-all" disabled={!canEdit} />
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-200/50">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter leading-none">Total Target</span>
                    <span className="text-sm font-black text-blue-900 leading-tight">{computedTotalTargetKarton.toLocaleString()} <span className="text-[8px] font-bold opacity-60 uppercase">Ctn</span></span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-green-600 uppercase tracking-tighter leading-none">Total Actual</span>
                    <span className="text-sm font-black text-green-700 leading-tight">{computedActualKarton.toFixed(1)} <span className="text-[8px] font-bold opacity-60 uppercase">Ctn</span></span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-purple-600 uppercase tracking-tighter leading-none">Achievement</span>
                    <span className="text-sm font-black text-purple-700 leading-tight">{computedAchievement.toFixed(1)}%</span>
                  </div>
                  <div className="bg-orange-50/50 px-2 py-1 rounded-lg border border-orange-100 flex flex-col justify-center">
                    <span className="text-[8px] font-black text-orange-600 uppercase leading-none mb-0.5">Report Month</span>
                    <span className="text-[9px] font-black text-orange-800 uppercase leading-none">
                      {watchedValues.period_start ? format(new Date(watchedValues.period_start), 'MMM yyyy') : '---'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remarks/Issue Group */}
              <div className="lg:col-span-4 p-2.5 bg-white border border-gray-100 rounded-xl flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <InformationCircleIcon className="h-3.5 w-3.5 text-gray-300" />
                  <span className="text-[9px] font-bold text-gray-300 uppercase">Remarks & Issues</span>
                </div>
                <Controller
                  name="issue_explanation"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      placeholder={needsIssueExplanation ? "WAJIB: Jelaskan kendala target tidak tercapai..." : "Ringkasan kendala harian..."}
                      className={`flex-grow w-full bg-gray-50/30 border-none focus:ring-0 text-[10px] text-gray-600 italic resize-none rounded-lg p-1 ${needsIssueExplanation && !field.value ? 'bg-red-50/50' : ''}`}
                      disabled={!canEdit}
                    />
                  )}
                />
              </div>
            </div>
          </div>
        </div>
        {/* Executive Analytics Dashboard - Summary Hub */}
        {report && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pb-1">
            {/* Box 1: Overall Achievement Gauge */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col h-[180px] relative overflow-hidden group">
               <div className="flex items-center gap-1.5 mb-2 relative z-10">
                  <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                  <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Efficiency Gauge</h3>
               </div>
               <div className="flex-grow flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart 
                      innerRadius="80%" 
                      outerRadius="100%" 
                      data={radialData} 
                      startAngle={225} 
                      endAngle={-45}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <RadialBar 
                        background 
                        dataKey="value" 
                        cornerRadius={10} 
                        fill="#10b981" 
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                    <span className="text-2xl font-black text-emerald-600 leading-none">{computedAchievement.toFixed(1)}%</span>
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Achievement</span>
                  </div>
               </div>
            </div>

            {/* Box 2: Production Benchmark */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col h-[180px]">
               <div className="flex items-center gap-1.5 mb-4">
                  <div className="w-1 h-3 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Product Benchmark</h3>
               </div>
               <div className="flex-grow">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#1e293b' }} width={70} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        content={({ active, payload }) => {
                          if (active && payload) {
                             return (
                               <div className="bg-white/95 backdrop-blur-md border border-gray-100 p-2 rounded-xl shadow-xl">
                                  {payload.map((e: any, i: number) => (
                                    <p key={i} className="text-[8px] font-bold flex justify-between gap-4">
                                      <span className="text-gray-400">{e.name}:</span>
                                      <span style={{ color: e.color }} className="font-black">{e.value.toLocaleString()}</span>
                                    </p>
                                  ))}
                               </div>
                             );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="Target" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={14} />
                      <Bar dataKey="Actual" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={10} style={{ transform: 'translateY(-12px)' }} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Box 3: Detailed Waste Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col h-[180px]">
               <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1 h-3 bg-purple-600 rounded-full"></div>
                  <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Waste Analytics</h3>
               </div>
               <div className="flex-grow grid grid-cols-2 gap-3 divide-x divide-gray-50 mt-1">
                   {/* Octenic Waste Column */}
                   <div className="space-y-1.5 pr-1">
                     <span className="text-[7px] font-black text-indigo-500 uppercase tracking-wider block mb-1 border-b border-indigo-50/50 pb-0.5">OCTENIC LOSS</span>
                     <div className="flex justify-between items-center bg-indigo-50/30 px-1 py-0.5 rounded">
                       <span className="text-[7px] font-bold text-gray-400">CLOTH METERS</span>
                       <span className="text-[9px] font-black text-indigo-900">{wasteMetrics.octn.cloth.toFixed(1)}<span className="text-[6px] ml-0.5">METERS</span></span>
                     </div>
                     <div className="flex justify-between items-center bg-indigo-50/30 px-1 py-0.5 rounded">
                       <span className="text-[7px] font-bold text-gray-400">CHEMICAL GRAMS</span>
                       <span className="text-[9px] font-black text-indigo-900">{Math.round(wasteMetrics.octn.chem)}<span className="text-[6px] ml-0.5">GRAMS</span></span>
                     </div>
                     <div className="flex justify-between items-center bg-gray-50/50 px-1 py-0.5 rounded">
                       <span className="text-[7px] font-bold text-gray-400 text-opacity-60 uppercase">PACKAGING / STICKER WASTE</span>
                       <span className="text-[9px] font-black text-slate-700">{wasteMetrics.octn.pkg}/{wasteMetrics.octn.stc}</span>
                     </div>
                     <div className="flex justify-between items-center bg-red-50/30 px-1 py-0.5 rounded">
                       <span className="text-[7px] font-bold text-red-400 uppercase">REJECT PIECES</span>
                       <span className="text-[9px] font-black text-red-700">{wasteMetrics.octn.reject}<span className="text-[6px] ml-0.5">PIECES</span></span>
                     </div>
                   </div>

                   {/* Gloveclean Waste Column */}
                   <div className="space-y-1.5 pl-3">
                     <span className="text-[7px] font-black text-purple-500 uppercase tracking-wider block mb-1 border-b border-purple-50/50 pb-0.5">GLOVECLEAN LOSS</span>
                     <div className="flex justify-between items-center bg-purple-50/30 px-1 py-0.5 rounded">
                       <span className="text-[7px] font-bold text-gray-400">CLOTH METERS</span>
                       <span className="text-[9px] font-black text-purple-900">{wasteMetrics.glvcn.cloth.toFixed(1)}<span className="text-[6px] ml-0.5">METERS</span></span>
                     </div>
                     <div className="flex justify-between items-center bg-purple-50/30 px-1 py-0.5 rounded">
                       <span className="text-[7px] font-bold text-gray-400">CHEMICAL GRAMS</span>
                       <span className="text-[9px] font-black text-purple-900">{Math.round(wasteMetrics.glvcn.chem)}<span className="text-[6px] ml-0.5">GRAMS</span></span>
                     </div>
                     <div className="flex justify-between items-center bg-gray-50/50 px-1 py-0.5 rounded">
                       <span className="text-[7px] font-bold text-gray-400 text-opacity-60 uppercase tracking-tighter">PACKAGING WASTE</span>
                       <span className="text-[9px] font-black text-slate-700">{wasteMetrics.glvcn.pkg}</span>
                     </div>
                     <div className="flex justify-between items-center bg-red-50/30 px-1 py-0.5 rounded">
                       <span className="text-[7px] font-bold text-red-400 uppercase tracking-tighter">REJECT PIECES</span>
                       <span className="text-[9px] font-black text-red-700">{wasteMetrics.glvcn.reject}<span className="text-[6px] ml-0.5">PIECES</span></span>
                     </div>
                   </div>
               </div>
            </div>
          </div>
        )}

        {/* Daily Production Cards */}
        {report && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-black text-gray-800 flex items-center gap-1.5 uppercase tracking-widest">
                <span className="w-1 h-3 bg-blue-600 rounded-full"></span>
                Daily Production Cards
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
              {Object.entries(report.details_by_day).map(([dayKey, dayDetails]) => {
                const dayNamesId: Record<string, string> = { Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu', Thursday: 'Kamis', Friday: 'Jumat', Saturday: 'Sabtu', Sunday: 'Minggu' };
                const firstDetail = dayDetails[0];
                const dbDayName = firstDetail?.day_name || '';
                const indonesianDay = dayNamesId[dbDayName] || dbDayName;
                const formattedDate = firstDetail?.day_date ? format(new Date(firstDetail.day_date), 'dd MMM yyyy') : dayKey;
                
                const dayActual = dayDetails.reduce((sum, d) => sum + (d.actual_total || 0), 0);
                const dayTarget = dayDetails.reduce((sum, d) => sum + (d.target_total || 0), 0);
                const dayAchieved = dayActual >= dayTarget;

                return (
                  <div key={dayKey} className={`bg-white rounded-xl shadow-sm border ${dayAchieved ? 'border-green-100' : 'border-red-100'} transition-all overflow-hidden`}>
                    <div className={`px-2 py-1 border-b flex justify-between items-center ${dayAchieved ? 'bg-green-50/20' : 'bg-red-50/20'}`}>
                      <div className="flex items-center gap-2">
                         <span className={`text-[11px] font-black uppercase ${dayAchieved ? 'text-green-800' : 'text-red-800'}`}>{indonesianDay}</span>
                         <span className="text-[8px] text-gray-400 font-bold">{formattedDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="text-right">
                          <p className={`text-[10px] font-black leading-none ${dayAchieved ? 'text-green-700' : 'text-red-700'}`}>{dayActual.toLocaleString()} <span className="text-[7px] opacity-70 uppercase">pcs</span></p>
                        </div>
                        {dayAchieved ? <CheckCircleIcon className="h-3 w-3 text-green-500" /> : <InformationCircleIcon className="h-3 w-3 text-red-500" />}
                      </div>
                    </div>

                    <div className="p-2 space-y-2">
                      {dayDetails.map((detail, detailIdx) => {
                        const isShift2 = detail.shift_number === 2;
                        const hasData = (detail.actual_total || 0) > 0 || (detail.notes && detail.notes.trim() !== '');
                        const isExpanded = expandedShift2Days.has(dayKey);
                        
                        // Check if Shift 2 is hidden for this day
                        const s2Exists = dayDetails.some(d => d.shift_number === 2);
                        const s2HasData = dayDetails.some(d => d.shift_number === 2 && ((d.actual_total || 0) > 0 || (d.notes && d.notes.trim() !== '')));
                        const isS2Hidden = s2Exists && !s2HasData && !isExpanded;

                        // Don't render Shift 2 if it's hidden
                        if (isShift2 && isS2Hidden) return null;

                        return (
                          <div key={detail.id} className={`${detailIdx > 0 ? 'border-t border-dashed border-gray-50 pt-1' : ''}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="flex items-center gap-1">
                                <span className="bg-gray-900 text-white text-[7px] font-black px-1 rounded uppercase">S{detail.shift_number}</span>
                                {detail.shift_number === 1 && isS2Hidden && canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = new Set(expandedShift2Days);
                                      next.add(dayKey);
                                      setExpandedShift2Days(next);
                                    }}
                                    className="p-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-all shadow-sm group"
                                    title="Tambah Shift 2"
                                  >
                                    <PlusIcon className="h-2 w-2" />
                                  </button>
                                )}
                              </div>
                              <div className="h-[1px] flex-grow bg-gray-50"></div>
                            </div>

                            <div className="space-y-2 mt-1">
                              {/* OCTENIC PRODUCT BLOCK */}
                              <div className="bg-blue-50/20 border border-blue-100 rounded-xl p-2 transition-all hover:bg-blue-50/40">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded shadow-sm">OCTENIC PRODUCTION</span>
                                  <div className="flex gap-4">
                                    <div className="flex flex-col items-end">
                                      <span className="text-[6px] font-bold text-gray-400 uppercase tracking-widest">Target Pcs</span>
                                      <input type="number" value={detail.target_octenic || ''} onChange={(e) => updateDetailValue(dayKey, detail.shift_number, 'target_octenic', parseFloat(e.target.value) || 0)} className="w-16 bg-white border border-blue-200 rounded text-[10px] font-black text-center text-blue-900 focus:ring-1 focus:ring-blue-600 outline-none transition-all" disabled={!canEdit} />
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="text-[6px] font-bold text-gray-400 uppercase tracking-widest">Actual Pcs</span>
                                      <input type="number" value={detail.actual_octenic || ''} onChange={(e) => updateDetailValue(dayKey, detail.shift_number, 'actual_octenic', parseFloat(e.target.value) || 0)} className="w-16 bg-white border border-green-200 rounded text-[10px] font-black text-center text-green-700 focus:ring-1 focus:ring-green-600 outline-none transition-all" disabled={!canEdit} />
                                    </div>
                                    <div className="flex flex-col items-end bg-gray-50 px-2 rounded-lg border border-gray-100">
                                      <span className="text-[6px] font-bold text-gray-400 uppercase tracking-widest">Cartons</span>
                                      <span className="text-[10px] font-black text-gray-800">{(detail.actual_octenic / 39).toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
                                  <div className="bg-white/60 p-1.5 rounded-lg border border-blue-100/50">
                                    <span className="text-[6px] font-black text-blue-400 uppercase block mb-1">CLOTH METERS</span>
                                    <span className="text-[10px] font-black text-blue-900">{detail.actual_cloth_octenic?.toFixed(1) || 0} <span className="text-[6px] text-gray-400">m</span></span>
                                  </div>
                                  <div className="bg-white/60 p-1.5 rounded-lg border border-blue-100/50">
                                    <span className="text-[6px] font-black text-blue-400 uppercase block mb-1">ISOLASI ROLL</span>
                                    <input type="number" step="0.01" value={typeof detail.actual_isolation_roll === 'number' ? detail.actual_isolation_roll.toFixed(2) : detail.actual_isolation_roll || ''} onChange={(e) => updateDetailValue(dayKey, detail.shift_number, 'actual_isolation_roll', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-[10px] font-black text-blue-900 focus:ring-0 outline-none" disabled={!canEdit} />
                                  </div>
                                  <div className="bg-white/60 p-1.5 rounded-lg border border-blue-100/50">
                                    <span className="text-[6px] font-black text-blue-400 uppercase block mb-1">PACKAGING ROLL</span>
                                    <input type="number" step="0.01" value={typeof detail.actual_roll_packaging_octenic === 'number' ? detail.actual_roll_packaging_octenic.toFixed(2) : detail.actual_roll_packaging_octenic || ''} onChange={(e) => updateDetailValue(dayKey, detail.shift_number, 'actual_roll_packaging_octenic', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-[10px] font-black text-blue-900 focus:ring-0 outline-none" disabled={!canEdit} />
                                  </div>
                                  <div className="bg-white/60 p-1.5 rounded-lg border border-blue-100/50">
                                    <span className="text-[6px] font-black text-blue-400 uppercase block mb-1">STICKER ROLL</span>
                                    <input type="number" step="0.01" value={typeof detail.actual_roll_sticker_octenic === 'number' ? detail.actual_roll_sticker_octenic.toFixed(2) : detail.actual_roll_sticker_octenic || ''} onChange={(e) => updateDetailValue(dayKey, detail.shift_number, 'actual_roll_sticker_octenic', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-[10px] font-black text-blue-900 focus:ring-0 outline-none" disabled={!canEdit} />
                                  </div>
                                </div>

                                <div className="bg-yellow-50/30 border border-yellow-100/60 rounded-lg p-1.5">
                                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-yellow-100/50">
                                    <span className="text-[7px] font-black text-yellow-700 uppercase tracking-widest">Quality & Waste Details</span>
                                    <div className="flex gap-3 text-[7px] font-black">
                                       <span className="text-red-600">PACKAGING WASTE: {detail.octn_waste_packaging?.toFixed(2) || 0}</span>
                                       <span className="text-red-600">STICKER WASTE: {detail.octn_waste_sticker?.toFixed(2) || 0}</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-5 gap-1">
                                    <div className="bg-white/80 p-1 rounded border border-yellow-100 flex flex-col items-center">
                                      <span className="text-[5px] font-bold text-gray-400 uppercase">Waste METERS/GRAMS</span>
                                      <span className="text-[8px] font-black text-yellow-800">{detail.octn_waste_cloth_chem || '0M / 0G'}</span>
                                    </div>
                                    {['octn_setting_packaging', 'octn_setting_sticker', 'octn_grade_b', 'octn_grade_c'].map(f => (
                                      <div key={f} className="bg-white/80 p-0.5 rounded border border-yellow-100 flex flex-col items-center">
                                        <span className="text-[5px] font-bold text-gray-400 uppercase">{f.split('_').slice(1).join(' ')}</span>
                                        <input type="number" value={(detail as any)[f] || ''} onChange={(e) => updateDetailValue(dayKey, detail.shift_number, f, parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-[9px] font-black text-center text-yellow-900 focus:ring-0 outline-none" disabled={!canEdit} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* GLOVECLEAN PRODUCT BLOCK */}
                              <div className="bg-purple-50/20 border border-purple-100 rounded-xl p-2 transition-all hover:bg-purple-50/40">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="px-2 py-0.5 bg-purple-600 text-white text-[8px] font-black rounded shadow-sm">GLOVECLEAN PRODUCTION</span>
                                  <div className="flex gap-4">
                                    <div className="flex flex-col items-end">
                                      <span className="text-[6px] font-bold text-gray-400 uppercase tracking-widest">Target Pcs</span>
                                      <input type="number" value={detail.target_gloveclean || ''} onChange={(e) => updateDetailValue(dayKey, detail.shift_number, 'target_gloveclean', parseFloat(e.target.value) || 0)} className="w-16 bg-white border border-purple-200 rounded text-[10px] font-black text-center text-purple-900 focus:ring-1 focus:ring-purple-600 outline-none transition-all" disabled={!canEdit} />
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="text-[6px] font-bold text-gray-400 uppercase tracking-widest">Actual Pcs</span>
                                      <input type="number" value={detail.actual_gloveclean || ''} onChange={(e) => updateDetailValue(dayKey, detail.shift_number, 'actual_gloveclean', parseFloat(e.target.value) || 0)} className="w-16 bg-white border border-green-200 rounded text-[10px] font-black text-center text-green-700 focus:ring-1 focus:ring-green-600 outline-none transition-all" disabled={!canEdit} />
                                    </div>
                                    <div className="flex flex-col items-end bg-gray-50 px-2 rounded-lg border border-gray-100">
                                      <span className="text-[6px] font-bold text-gray-400 uppercase tracking-widest">Cartons</span>
                                      <span className="text-[10px] font-black text-gray-800">{(detail.actual_gloveclean / 72).toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
                                  <div className="bg-white/60 p-1.5 rounded-lg border border-purple-100/50">
                                    <span className="text-[6px] font-black text-purple-400 uppercase block mb-1">CLOTH METERS</span>
                                    <span className="text-[10px] font-black text-purple-900">{detail.actual_cloth_gloveclean?.toFixed(1) || 0} <span className="text-[6px] text-gray-400">m</span></span>
                                  </div>
                                  <div className="bg-white/60 p-1.5 rounded-lg border border-purple-100/50">
                                    <span className="text-[6px] font-black text-purple-400 uppercase block mb-1">PACKAGING ROLL</span>
                                    <input type="number" step="0.01" value={typeof detail.actual_roll_packaging_gloveclean === 'number' ? detail.actual_roll_packaging_gloveclean.toFixed(2) : detail.actual_roll_packaging_gloveclean || ''} onChange={(e) => updateDetailValue(dayKey, detail.shift_number, 'actual_roll_packaging_gloveclean', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-[10px] font-black text-purple-900 focus:ring-0 outline-none" disabled={!canEdit} />
                                  </div>
                                </div>

                                <div className="bg-emerald-50/30 border border-emerald-100/60 rounded-lg p-1.5">
                                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-emerald-100/50">
                                    <span className="text-[7px] font-black text-emerald-700 uppercase tracking-widest">Quality & Waste Details</span>
                                    <div className="flex gap-3 text-[7px] font-black">
                                       <span className="text-red-600">PACKAGING WASTE: {detail.glvcn_waste_packaging?.toFixed(2) || 0}</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 gap-1">
                                    <div className="bg-white/80 p-1 rounded border border-emerald-100 flex flex-col items-center">
                                      <span className="text-[5px] font-bold text-gray-400 uppercase">Waste METERS/GRAMS</span>
                                      <span className="text-[8px] font-black text-emerald-800">{detail.glvcn_waste_cloth_chem || '0M / 0ML'}</span>
                                    </div>
                                    {['glvcn_setting_packaging', 'glvcn_grade_b', 'glvcn_grade_c'].map(f => (
                                      <div key={f} className="bg-white/80 p-0.5 rounded border border-emerald-100 flex flex-col items-center">
                                        <span className="text-[5px] font-bold text-gray-400 uppercase">{f.split('_').slice(1).join(' ')}</span>
                                        <input type="number" value={(detail as any)[f] || ''} onChange={(e) => updateDetailValue(dayKey, detail.shift_number, f, parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-[9px] font-black text-center text-emerald-900 focus:ring-0 outline-none" disabled={!canEdit} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Shift Notes Overlay */}
                            <div className="mt-1 flex items-center gap-1.5 p-1 bg-gray-50/50 rounded-md border border-gray-100">
                               <ChatBubbleBottomCenterTextIcon className="h-2.5 w-2.5 text-gray-300" />
                               <input 
                                 type="text" 
                                 value={detail.notes || ''} 
                                 onChange={(e) => updateDetailValue(dayKey, detail.shift_number, 'notes', e.target.value)}
                                 className="bg-transparent border-none focus:ring-0 p-0 text-[8px] font-medium text-gray-500 italic flex-grow"
                                 placeholder="Kendala harian (misal: mesin trouble)..."
                                 disabled={!canEdit}
                               />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Compact Legend Footer */}
            <div className="mt-4 border-t border-gray-100 pt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[7px] font-black uppercase tracking-tighter text-gray-400">
              <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_3px_rgba(34,197,94,0.4)]"></div> ACHIEVED</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> MINUS</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3">
                <span title="Waste Packaging (Kg)">PAC: <span className="text-gray-900">W. PACKAGING</span></span>
                <span title="Waste Sticker (Pcs)">STI: <span className="text-gray-900">W. STICKER</span></span>
                <span title="Setting Mesin (Pcs)">SET: <span className="text-gray-900">SETTING</span></span>
                <span title="Produksi Grade B/C (Pcs)">B/C: <span className="text-gray-900">GRADE REJECT</span></span>
                <span title="Kebutuhan Kain (Mtr) & Obat (Gram/Ml)">K&O: <span className="text-gray-900">WASTE KAIN+OBAT</span></span>
                <span title="Penggunaan Roll (Isolasi, Packaging, Sticker)">ROLLS: <span className="text-gray-900">ISOLASI, PKG, STC</span></span>
              </div>
            </div>
          </div>
        )}

        {/* Improved Signature/Progress Tracker */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'STAFF PREP', name: report?.approvals.staff.name, date: report?.approvals.staff.date, role: 'staff' },
            { label: 'SUPERVISOR', name: report?.approvals.supervisor.name, date: report?.approvals.supervisor.date, role: 'supervisor' },
            { label: 'MANAGER', name: report?.approvals.manager.name, date: report?.approvals.manager.date, role: 'manager' }
          ].map((item, idx) => (
            <div key={idx} className={`bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 transition-all ${item.date ? 'bg-green-50/10' : ''}`}>
               <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.date ? 'bg-green-100 text-green-600' : 'bg-gray-50 text-gray-300'}`}>
                  {item.date ? <CheckCircleIcon className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
               </div>
               <div className="flex-grow">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{item.label}</p>
                  <p className="text-[10px] font-bold text-gray-800 leading-none">{item.name || '---'}</p>
                  {item.date && (
                    <p className="text-[7px] text-gray-400 mt-0.5">{format(new Date(item.date), 'dd/MM/yy HH:mm')}</p>
                  )}
               </div>
               {!item.date && (
                 <div className="flex gap-1">
                   {item.role === 'supervisor' && canApproveSupervisor && (
                      <button onClick={() => approveReport('supervisor')} className="p-1 px-2 bg-blue-600 text-white text-[9px] font-black rounded-lg">APPROVE</button>
                   )}
                   {item.role === 'manager' && canApproveManager && (
                      <button onClick={() => approveReport('manager')} className="p-1 px-2 bg-blue-600 text-white text-[9px] font-black rounded-lg">APPROVE</button>
                   )}
                 </div>
               )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MBFReportPage;
