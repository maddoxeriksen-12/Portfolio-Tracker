import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import usePortfolioStore from '../store/portfolioStore';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatPercent = (value) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const COLORS = ['#2a97ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function Dashboard() {
  const { overview, assets, fetchOverview, fetchReturns, isLoading } = usePortfolioStore();
  const [returns, setReturns] = useState(null);
  const [timeframe, setTimeframe] = useState('1Y');

  useEffect(() => {
    fetchOverview();
    loadReturns('1Y');
  }, []);

  const loadReturns = async (tf) => {
    setTimeframe(tf);
    const data = await fetchReturns(tf);
    setReturns(data);
  };

  const timeframes = ['1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'ALL'];

  // Prepare pie chart data
  const pieData = assets?.map(asset => ({
    name: asset.symbol,
    value: asset.currentValue,
    color: COLORS[assets.indexOf(asset) % COLORS.length]
  })) || [];

  // Mock performance data for chart
  const performanceData = [
    { date: 'Jan', value: overview?.totalCostBasis || 0 },
    { date: 'Feb', value: (overview?.totalCostBasis || 0) * 1.02 },
    { date: 'Mar', value: (overview?.totalCostBasis || 0) * 0.98 },
    { date: 'Apr', value: (overview?.totalCostBasis || 0) * 1.05 },
    { date: 'May', value: (overview?.totalCostBasis || 0) * 1.08 },
    { date: 'Jun', value: (overview?.totalCostBasis || 0) * 1.03 },
    { date: 'Jul', value: (overview?.totalCostBasis || 0) * 1.10 },
    { date: 'Aug', value: (overview?.totalCostBasis || 0) * 1.07 },
    { date: 'Sep', value: (overview?.totalCostBasis || 0) * 1.12 },
    { date: 'Oct', value: (overview?.totalCostBasis || 0) * 1.09 },
    { date: 'Nov', value: (overview?.totalCostBasis || 0) * 1.15 },
    { date: 'Dec', value: overview?.totalCurrentValue || 0 }
  ];

  const isPositive = (overview?.totalGainLoss || 0) >= 0;

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Dashboard</h1>
          <p className="text-midnight-400 mt-1">Your portfolio at a glance</p>
        </div>
        <button
          onClick={() => fetchOverview()}
          disabled={isLoading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between">
            <span className="stat-label">Total Value</span>
            <div className="p-2 rounded-lg bg-accent-500/10">
              <Wallet className="w-5 h-5 text-accent-400" />
            </div>
          </div>
          <p className="stat-value text-white">
            {formatCurrency(overview?.totalCurrentValue || 0)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between">
            <span className="stat-label">Total Return</span>
            <div className={`p-2 rounded-lg ${isPositive ? 'bg-gain/10' : 'bg-loss/10'}`}>
              {isPositive ? (
                <TrendingUp className="w-5 h-5 text-gain" />
              ) : (
                <TrendingDown className="w-5 h-5 text-loss" />
              )}
            </div>
          </div>
          <p className={`stat-value ${isPositive ? 'text-gain' : 'text-loss'}`}>
            {formatCurrency(overview?.totalGainLoss || 0)}
          </p>
          <p className={`text-sm ${isPositive ? 'text-gain' : 'text-loss'}`}>
            {formatPercent(overview?.totalGainLossPercent || 0)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between">
            <span className="stat-label">Stocks</span>
            <div className="p-2 rounded-lg bg-accent-500/10">
              <BarChart3 className="w-5 h-5 text-accent-400" />
            </div>
          </div>
          <p className="stat-value text-white">
            {formatCurrency(overview?.stocksValue || 0)}
          </p>
          <p className="text-sm text-midnight-400">
            {(overview?.stocksAllocation || 0).toFixed(1)}% of portfolio
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between">
            <span className="stat-label">Crypto</span>
            <div className="p-2 rounded-lg bg-warning/10">
              <PieChart className="w-5 h-5 text-warning" />
            </div>
          </div>
          <p className="stat-value text-white">
            {formatCurrency(overview?.cryptoValue || 0)}
          </p>
          <p className="text-sm text-midnight-400">
            {(overview?.cryptoAllocation || 0).toFixed(1)}% of portfolio
          </p>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 glass-card p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-display font-semibold text-white">Performance</h3>
            <div className="flex flex-wrap gap-1">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => loadReturns(tf)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    timeframe === tf
                      ? 'bg-accent-500 text-white'
                      : 'text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/50'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2a97ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2a97ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#627d98', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#627d98', fontSize: 12 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#243b53',
                    border: '1px solid #334e68',
                    borderRadius: '12px',
                    color: '#d9e2ec'
                  }}
                  formatter={(value) => [formatCurrency(value), 'Value']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#2a97ff"
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Allocation Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-display font-semibold text-white mb-6">Allocation</h3>
          {pieData.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#243b53',
                        border: '1px solid #334e68',
                        borderRadius: '12px',
                        color: '#d9e2ec'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {pieData.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-midnight-300">{item.name}</span>
                    </div>
                    <span className="text-sm font-mono text-midnight-200">
                      {((item.value / (overview?.totalCurrentValue || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-midnight-400">
              No assets yet
            </div>
          )}
        </motion.div>
      </div>

      {/* Holdings Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-midnight-800/50">
          <h3 className="text-lg font-display font-semibold text-white">Holdings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-midnight-800/50">
                <th className="table-header px-6 py-4">Asset</th>
                <th className="table-header px-6 py-4 text-right">Quantity</th>
                <th className="table-header px-6 py-4 text-right">Avg Cost</th>
                <th className="table-header px-6 py-4 text-right">Price</th>
                <th className="table-header px-6 py-4 text-right">Value</th>
                <th className="table-header px-6 py-4 text-right">Return</th>
              </tr>
            </thead>
            <tbody>
              {assets?.map((asset, index) => {
                const assetIsPositive = asset.gainLoss >= 0;
                return (
                  <tr key={index} className="hover:bg-midnight-800/30 transition-colors">
                    <td className="table-cell px-6">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
                          style={{ backgroundColor: COLORS[index % COLORS.length] + '20', color: COLORS[index % COLORS.length] }}
                        >
                          {asset.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{asset.symbol}</p>
                          <p className="text-xs text-midnight-400">{asset.assetType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell px-6 text-right font-mono text-midnight-200">
                      {asset.quantity.toFixed(asset.assetType === 'CRYPTO' ? 6 : 2)}
                    </td>
                    <td className="table-cell px-6 text-right font-mono text-midnight-200">
                      {formatCurrency(asset.costBasis / asset.quantity)}
                    </td>
                    <td className="table-cell px-6 text-right font-mono text-midnight-200">
                      {formatCurrency(asset.currentPrice)}
                    </td>
                    <td className="table-cell px-6 text-right font-mono text-white font-medium">
                      {formatCurrency(asset.currentValue)}
                    </td>
                    <td className="table-cell px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {assetIsPositive ? (
                          <ArrowUpRight className="w-4 h-4 text-gain" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-loss" />
                        )}
                        <span className={`font-mono font-medium ${assetIsPositive ? 'text-gain' : 'text-loss'}`}>
                          {formatPercent(asset.gainLossPercent)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!assets || assets.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-midnight-400">
                    No holdings yet. Add your first transaction to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
