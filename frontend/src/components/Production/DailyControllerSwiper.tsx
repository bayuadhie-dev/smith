import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  PlayIcon, 
  PauseIcon,
  CogIcon,
  CubeIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import DailyController from '../../pages/Production/DailyController';
import axiosInstance from '../../utils/axiosConfig';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface DailyControllerSwiperProps {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

interface DailySummary {
  date: string;
  machines_count: number;
  total_production: number;
  total_runtime: number;
  total_downtime: number;
  total_idle: number;
  avg_oee: number;
}

const DailyControllerSwiper: React.FC<DailyControllerSwiperProps> = ({
  year,
  month,
  startDate,
  endDate
}) => {
  const [dates, setDates] = useState<string[]>([]);
  const [autoPlay, setAutoPlay] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dailySummaries, setDailySummaries] = useState<{ [key: string]: DailySummary }>({});
  const [loadingSummaries, setLoadingSummaries] = useState(true);

  useEffect(() => {
    generateDates();
  }, [startDate, endDate]);

  useEffect(() => {
    if (dates.length > 0) {
      fetchAllDailySummaries();
    }
  }, [dates]);

  const generateDates = () => {
    const dateList: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let current = new Date(start);
    while (current <= end) {
      dateList.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    setDates(dateList);
  };

  const fetchAllDailySummaries = async () => {
    if (!dates || dates.length === 0) return;
    
    setLoadingSummaries(true);
    try {
      const summaries: { [key: string]: DailySummary } = {};
      
      // Fetch all dates in parallel
      await Promise.all(
        dates.map(async (date) => {
          try {
            const response = await axiosInstance.get(`/api/oee/public/daily-controller?date=${date}`);
            if (response.data.success && response.data.summary) {
              summaries[date] = {
                date,
                machines_count: response.data.summary.machines_count || 0,
                total_production: response.data.summary.total_production || 0,
                total_runtime: response.data.summary.total_runtime || 0,
                total_downtime: response.data.summary.total_downtime || 0,
                total_idle: response.data.summary.total_idle || 0,
                avg_oee: response.data.summary.avg_oee || 0,
              };
            }
          } catch (error) {
            console.error(`Error fetching data for ${date}:`, error);
          }
        })
      );
      
      setDailySummaries(summaries);
    } catch (error) {
      console.error('Error fetching daily summaries:', error);
    } finally {
      setLoadingSummaries(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const currentSummary = (dates && dates[currentSlide] && dailySummaries[dates[currentSlide]]) || {
    machines_count: 0,
    total_production: 0,
    total_runtime: 0,
    total_downtime: 0,
    total_idle: 0,
    avg_oee: 0,
  };

  // Debug logging
  console.log('DailyControllerSwiper - Current Slide:', currentSlide);
  console.log('DailyControllerSwiper - Current Date:', dates?.[currentSlide]);
  console.log('DailyControllerSwiper - Current Summary:', currentSummary);
  console.log('DailyControllerSwiper - Loading:', loadingSummaries);

  if (!dates || dates.length === 0) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Header with Colored Summary Cards - Matching Daily Controller Colors */}
      <div className="mb-6 space-y-4">
        {/* Date and Controls */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Daily Controller - {formatDate(dates[currentSlide])}
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Hari {currentSlide + 1} / {dates.length}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                autoPlay
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {autoPlay ? (
                <>
                  <PauseIcon className="h-5 w-5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5" />
                  <span>Auto Play</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Summary Cards - EXACT COLORS from Daily Controller */}
        {loadingSummaries ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {/* Blue - Mesin Aktif */}
            <div 
              className="rounded-xl p-4 text-white shadow-lg"
              style={{ background: 'linear-gradient(to bottom right, #3b82f6, #2563eb)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <CogIcon className="h-5 w-5 opacity-80" />
                <span className="text-sm opacity-80">Mesin Aktif</span>
              </div>
              <p className="text-3xl font-bold">{currentSummary.machines_count}</p>
            </div>

            {/* Green - Total Output */}
            <div 
              className="rounded-xl p-4 text-white shadow-lg"
              style={{ background: 'linear-gradient(to bottom right, #22c55e, #16a34a)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <CubeIcon className="h-5 w-5 opacity-80" />
                <span className="text-sm opacity-80">Total Output</span>
              </div>
              <p className="text-3xl font-bold">{currentSummary.total_production.toLocaleString()}</p>
            </div>

            {/* Emerald - Total Runtime */}
            <div 
              className="rounded-xl p-4 text-white shadow-lg"
              style={{ background: 'linear-gradient(to bottom right, #10b981, #059669)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <ClockIcon className="h-5 w-5 opacity-80" />
                <span className="text-sm opacity-80">Total Runtime</span>
              </div>
              <p className="text-3xl font-bold">{currentSummary.total_runtime} <span className="text-lg">menit</span></p>
            </div>

            {/* Red - Total Downtime */}
            <div 
              className="rounded-xl p-4 text-white shadow-lg"
              style={{ background: 'linear-gradient(to bottom right, #ef4444, #dc2626)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <ExclamationTriangleIcon className="h-5 w-5 opacity-80" />
                <span className="text-sm opacity-80">Total Downtime</span>
              </div>
              <p className="text-3xl font-bold">{currentSummary.total_downtime} <span className="text-lg">menit</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Swiper with Full Daily Controller */}
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        spaceBetween={20}
        slidesPerView={1}
        navigation={{
          prevEl: '.swiper-button-prev-custom',
          nextEl: '.swiper-button-next-custom',
        }}
        pagination={{
          clickable: true,
          dynamicBullets: true,
        }}
        autoplay={autoPlay ? {
          delay: 15000, // 15 seconds per slide (longer for detailed view)
          disableOnInteraction: false,
        } : false}
        onSlideChange={(swiper) => setCurrentSlide(swiper.activeIndex)}
        className="daily-controller-swiper"
      >
        {dates.map((date) => (
          <SwiperSlide key={date}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              {/* Embed Full Daily Controller */}
              <DailyController 
                initialDate={date}
                embedded={true}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Navigation Buttons */}
      <button
        className="swiper-button-prev-custom absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        style={{ marginTop: '2rem' }}
      >
        <ChevronLeftIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
      </button>
      <button
        className="swiper-button-next-custom absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        style={{ marginTop: '2rem' }}
      >
        <ChevronRightIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Info Footer */}
      <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          💡 <strong>Tip:</strong> Gunakan tombol Auto Play untuk mode monitoring otomatis. 
          Swipe atau gunakan arrow untuk navigasi manual.
        </p>
      </div>
    </div>
  );
};

export default DailyControllerSwiper;
