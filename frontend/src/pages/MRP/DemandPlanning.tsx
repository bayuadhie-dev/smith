import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  DocumentArrowDownIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
interface DemandForecast {
  product_id: number;
  product_name: string;
  product_code: string;
  category: string;
  current_demand: number | null;
  forecasted_demand: number | null;
  variance_percent: number | null;
  confidence_level: number | null;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality_factor: number | null;
  last_updated: string;
}

interface HistoricalDemand {
  date: string;
  actual_demand: number;
  forecasted_demand: number;
  variance: number;
}

interface SeasonalityPattern {
  month: string;
  seasonal_index: number;
  avg_demand: number;
  peak_demand: number;
  low_demand: number;
}

interface ForecastAccuracy {
  product_name: string;
  mape: number; // Mean Absolute Percentage Error
  mad: number;  // Mean Absolute Deviation
  mse: number;  // Mean Squared Error
  accuracy_grade: 'A' | 'B' | 'C' | 'D';
}

const DemandPlanning: React.FC = () => {
  const { t } = useLanguage();

  const [demandForecasts, setDemandForecasts] = useState<DemandForecast[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalDemand[]>([]);
  const [seasonalityData, setSeasonalityData] = useState<SeasonalityPattern[]>([]);
  const [forecastAccuracy, setForecastAccuracy] = useState<ForecastAccuracy[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState('3months');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [forecastMethod, setForecastMethod] = useState('auto');

  useEffect(() => {
    loadDemandData();
  }, [selectedPeriod, selectedCategory, selectedProduct, forecastMethod]);

  const loadDemandData = async () => {
    try {
      setLoading(true);
      
      const params = {
        period: selectedPeriod,
        category: selectedCategory,
        product: selectedProduct,
        method: forecastMethod
      };

      const [forecastRes, historicalRes, seasonalRes, accuracyRes] = await Promise.all([
        axiosInstance.get('/api/mrp/demand/forecast', { params }),
        axiosInstance.get('/api/mrp/demand/historical', { params }),
        axiosInstance.get('/api/mrp/demand/seasonality', { params }),
        axiosInstance.get('/api/mrp/demand/accuracy', { params })
      ]);

      setDemandForecasts(forecastRes.data?.forecasts || []);
      setHistoricalData(historicalRes.data?.historical || []);
      setSeasonalityData(seasonalRes.data?.seasonality || []);
      setForecastAccuracy(accuracyRes.data?.accuracy || []);
    } catch (error) {
      console.error('Failed to load demand data:', error);
      // 2026-10-07: this used to fall back to 5 fake products (product_id
      // 1-5, including one literally named "FunnelIcon Media Pro" - a
      // leftover from a broken find/replace), a 7-month fake historical
      // demand series, 12 fake monthly seasonality indices, and fake
      // forecast-accuracy grades (MAPE/MAD/MSE) on ANY API error. A demand
      // planner acting on a fake "increasing 20.8% demand, confidence
      // 85.5%" for a product that shares a real product_id could drive a
      // real over/under-procurement decision. Honest empty state instead.
      setDemandForecasts([]);
      setHistoricalData([]);
      setSeasonalityData([]);
      setForecastAccuracy([]);
    } finally {
      setLoading(false);
    }
  };

  const runForecastCalculation = async () => {
    try {
      setLoading(true);
      await axiosInstance.post('/api/mrp/demand/calculate-forecast', {
        period: selectedPeriod,
        method: forecastMethod
      });
      await loadDemandData();
    } catch (error) {
      console.error('Failed to calculate forecast:', error);
    }
  };

  const exportForecastData = () => {
    // Implementation for exporting forecast data
    console.log('Exporting forecast data...');
  };

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const formatPercent = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0.0%';
    }
    return `${num.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />;
      case 'decreasing': return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
      default: return <div className="h-4 w-4 bg-gray-400 rounded-full"></div>;
    }
  };

  const getConfidenceColor = (confidence: number | undefined | null) => {
    if (confidence === undefined || confidence === null || isNaN(confidence)) {
      return 'text-gray-600 bg-gray-100';
    }
    if (confidence >= 90) return 'text-green-600 bg-green-100';
    if (confidence >= 80) return 'text-blue-600 bg-blue-100';
    if (confidence >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getAccuracyColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Loading demand planning data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link
            to="/app/mrp"
            className="flex items-center text-gray-600 hover:text-gray-900 dark:text-white"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to MRP Dashboard
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Demand Planning</h1>
            <p className="text-gray-600 mt-1">Forecast demand and plan production requirements</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={runForecastCalculation}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowPathIcon className="h-5 w-5 mr-2" />
            Recalculate Forecast
          </button>
          <button
            onClick={exportForecastData}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
            Export Data
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Forecast Period</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2"
            >
              <option value="1month">1 Month</option>
              <option value="3months">3 Months</option>
              <option value="6months">6 Months</option>
              <option value="1year">1 Year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('products.bom.category')}</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2"
            >
              <option value="all">All Categories</option>
              <option value="nonwoven">Nonwoven Fabrics</option>
              <option value="medical">Medical Products</option>
              <option value="filter">FunnelIcon Media</option>
              <option value="geotextile">Geotextiles</option>
              <option value="raw">Raw Materials</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('production.product')}</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2"
            >
              <option value="all">All Products</option>
              <option value="1">Nonwoven Fabric A</option>
              <option value="2">Medical Mask Material</option>
              <option value="3">FunnelIcon Media Pro</option>
              <option value="4">Geotextile Fabric</option>
              <option value="5">PP Granules</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Forecast Method</label>
            <select
              value={forecastMethod}
              onChange={(e) => setForecastMethod(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2"
            >
              <option value="auto">Auto (Best Fit)</option>
              <option value="linear">Linear Regression</option>
              <option value="exponential">Exponential Smoothing</option>
              <option value="seasonal">Seasonal Decomposition</option>
              <option value="arima">ARIMA</option>
            </select>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historical vs Forecast */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Historical vs Forecasted Demand</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value, name) => [
                formatNumber(value as number),
                name === 'actual_demand' ? 'Actual' : 'Forecasted'
              ]} />
              <Line type="monotone" dataKey="actual_demand" stroke="#3B82F6" strokeWidth={2} name="Actual" />
              <Line type="monotone" dataKey="forecasted_demand" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" name="Forecasted" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Seasonality Pattern */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Seasonality Pattern</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={seasonalityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value, name) => [
                name === 'seasonal_index' ? (value as number).toFixed(2) : formatNumber(value as number),
                name === 'seasonal_index' ? 'Seasonal Index' :
                name === 'avg_demand' ? 'Average Demand' :
                name === 'peak_demand' ? 'Peak Demand' : 'Low Demand'
              ]} />
              <Area type="monotone" dataKey="peak_demand" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
              <Area type="monotone" dataKey="avg_demand" stackId="2" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
              <Area type="monotone" dataKey="low_demand" stackId="3" stroke="#10B981" fill="#10B981" fillOpacity={0.8} />
              <Line type="monotone" dataKey="seasonal_index" stroke="#F59E0B" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Demand Forecast Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Product Demand Forecasts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('production.product')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Current Demand</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Forecasted</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Variance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Trend</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Seasonality</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {demandForecasts.map((forecast) => (
                <tr key={forecast.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{forecast.product_name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{forecast.product_code}</div>
                      <div className="text-xs text-gray-400">{forecast.category}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                    {formatNumber(forecast.current_demand)}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                    {formatNumber(forecast.forecasted_demand)}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const variance = forecast.variance_percent ?? 0;
                      return (
                        <span className={`font-medium ${
                          variance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {variance >= 0 ? '+' : ''}{formatPercent(forecast.variance_percent)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getConfidenceColor(forecast.confidence_level)}`}>
                      {formatPercent(forecast.confidence_level)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      {getTrendIcon(forecast.trend)}
                      <span className="ml-1 capitalize text-sm">{forecast.trend}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {forecast.seasonality_factor !== undefined && forecast.seasonality_factor !== null && !isNaN(forecast.seasonality_factor) 
                      ? `${forecast.seasonality_factor.toFixed(2)}x` 
                      : '1.00x'
                    }
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(forecast.last_updated).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forecast Accuracy */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Forecast Accuracy Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {forecastAccuracy.map((accuracy, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">{accuracy.product_name}</h4>
                <span className={`px-2 py-1 text-xs font-semibold rounded ${getAccuracyColor(accuracy.accuracy_grade)}`}>
                  Grade {accuracy.accuracy_grade}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">MAPE:</span>
                  <span className="font-medium">{formatPercent(accuracy.mape)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">MAD:</span>
                  <span className="font-medium">{formatNumber(accuracy.mad)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">MSE:</span>
                  <span className="font-medium">{formatNumber(accuracy.mse)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DemandPlanning;
