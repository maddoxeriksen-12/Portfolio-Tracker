import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calculator, Calendar, DollarSign, Settings2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import usePortfolioStore from '../store/portfolioStore';

const formatCurrency = (value) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
};

const formatCurrencyFull = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
};

export default function Projections() {
  const { projections, assets, fetchProjections, fetchOverview, setAssetCAGR } = usePortfolioStore();
  const [years, setYears] = useState(10);
  const [monthlyContribution, setMonthlyContribution] = useState(0);
  const [assetCAGRs, setAssetCAGRs] = useState({});
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    fetchProjections(years, monthlyContribution);
  }, [years, monthlyContribution]);

  const handleCAGRChange = async (assetId, cagr) => {
    setAssetCAGRs({ ...assetCAGRs, [assetId]: cagr });
    await setAssetCAGR(assetId, parseFloat(cagr));
    fetchProjections(years, monthlyContribution);
  };

  // Chart data
  const chartData = projections?.projections?.map(p => ({
    year: p.year === 0 ? 'Now' : `Year ${p.year}`,
    portfolio: p.portfolioValue,
    contributions: p.contributionsValue,
    income: p.netIncomeValue,
    total: p.totalValue
  })) || [];

  // Asset breakdown for the final year
  const finalYearAssets = projections?.projections?.[years]?.assetValues || [];

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Future Projections</h1>
          <p className="text-midnight-400 mt-1">Project your portfolio growth based on CAGR estimates</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`btn-secondary flex items-center gap-2 ${showSettings ? 'bg-accent-500/20 border-accent-500/50' : ''}`}
        >
          <Settings2 className="w-5 h-5" />
          Settings
        </button>
      </div>

      {/* Controls */}
      {showSettings && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-display font-semibold text-white mb-4">Projection Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-midnight-300">Time Horizon</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={years}
                  onChange={(e) => setYears(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-midnight-700 rounded-lg appearance-none cursor-pointer accent-accent-500"
                />
                <span className="text-white font-mono w-20 text-right">{years} years</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-midnight-300">Monthly Contribution</label>
              <input
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)}
                className="input-field"
                placeholder="500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-midnight-300">Net Monthly Income</label>
              <div className="input-field bg-midnight-700/30 cursor-not-allowed">
                <span className="text-midnight-200">
                  {formatCurrencyFull(projections?.summary?.monthlyNetIncome || 0)}
                </span>
              </div>
              <p className="text-xs text-midnight-400">From income - expenses</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-midnight-300">Average CAGR</label>
              <div className="input-field bg-midnight-700/30 cursor-not-allowed">
                <span className="text-midnight-200 font-mono">
                  {(projections?.summary?.averageCAGR || 7).toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-midnight-400">Used for contribution growth</p>
            </div>
          </div>

          {/* Asset CAGR Settings */}
          {assets && assets.length > 0 && (
            <div className="mt-6 pt-6 border-t border-midnight-700/50">
              <h4 className="text-sm font-medium text-midnight-300 mb-4">Asset CAGR Estimates</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.map((asset) => (
                  <div key={asset.assetId} className="flex items-center gap-3">
                    <span className="text-sm text-white w-16">{asset.symbol}</span>
                    <input
                      type="number"
                      step="0.1"
                      value={assetCAGRs[asset.assetId] ?? 7}
                      onChange={(e) => handleCAGRChange(asset.assetId, e.target.value)}
                      className="input-field w-24 text-center"
                      placeholder="7"
                    />
                    <span className="text-sm text-midnight-400">%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Current Value</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">
            {formatCurrencyFull(projections?.summary?.currentValue || 0)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Projected Value ({years}Y)</span>
          </div>
          <p className="text-2xl font-display font-bold text-gain">
            {formatCurrencyFull(projections?.summary?.projectedValue || 0)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <Calculator className="w-4 h-4" />
            <span className="text-sm">Total Growth</span>
          </div>
          <p className="text-2xl font-display font-bold text-accent-400">
            {formatCurrencyFull(projections?.summary?.totalGrowth || 0)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Growth Multiple</span>
          </div>
          <p className="text-2xl font-display font-bold text-warning">
            {projections?.summary?.currentValue > 0
              ? `${(projections.summary.projectedValue / projections.summary.currentValue).toFixed(1)}x`
              : 'N/A'}
          </p>
        </motion.div>
      </div>

      {/* Main Projection Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-display font-semibold text-white mb-6">Portfolio Growth Projection</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2a97ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2a97ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="year" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#627d98', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#627d98', fontSize: 12 }}
                tickFormatter={formatCurrency}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#243b53',
                  border: '1px solid #334e68',
                  borderRadius: '12px',
                  color: '#d9e2ec'
                }}
                formatter={(value) => formatCurrencyFull(value)}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="total"
                name="Total Value"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorTotal)"
              />
              <Area
                type="monotone"
                dataKey="portfolio"
                name="Portfolio Only"
                stroke="#2a97ff"
                strokeWidth={2}
                fill="url(#colorPortfolio)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Yearly Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-midnight-800/50">
          <h3 className="text-lg font-display font-semibold text-white">Yearly Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-midnight-800/50">
                <th className="table-header px-6 py-4">Year</th>
                <th className="table-header px-6 py-4 text-right">Portfolio Value</th>
                <th className="table-header px-6 py-4 text-right">Contributions</th>
                <th className="table-header px-6 py-4 text-right">Net Income</th>
                <th className="table-header px-6 py-4 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {projections?.projections?.map((p, index) => (
                <tr 
                  key={p.year} 
                  className={`hover:bg-midnight-800/30 transition-colors ${p.year === years ? 'bg-accent-500/5' : ''}`}
                >
                  <td className="table-cell px-6 font-medium text-white">
                    {p.year === 0 ? 'Current' : `Year ${p.year}`}
                  </td>
                  <td className="table-cell px-6 text-right font-mono text-midnight-200">
                    {formatCurrencyFull(p.portfolioValue)}
                  </td>
                  <td className="table-cell px-6 text-right font-mono text-midnight-200">
                    {formatCurrencyFull(p.contributionsValue)}
                  </td>
                  <td className="table-cell px-6 text-right font-mono text-midnight-200">
                    {formatCurrencyFull(p.netIncomeValue)}
                  </td>
                  <td className="table-cell px-6 text-right font-mono font-medium text-gain">
                    {formatCurrencyFull(p.totalValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Asset Breakdown for Final Year */}
      {finalYearAssets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-display font-semibold text-white mb-4">
            Projected Asset Values (Year {years})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {finalYearAssets.map((asset, index) => (
              <div 
                key={index}
                className="p-4 bg-midnight-800/30 rounded-xl border border-midnight-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">{asset.symbol}</span>
                  <span className="text-xs text-midnight-400">{asset.estimatedCAGR}% CAGR</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-midnight-400">Current</span>
                    <span className="font-mono text-midnight-200">{formatCurrencyFull(asset.currentValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-midnight-400">Projected</span>
                    <span className="font-mono text-gain">{formatCurrencyFull(asset.futureValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-midnight-700/50">
                    <span className="text-midnight-400">Growth</span>
                    <span className="font-mono text-accent-400">+{formatCurrencyFull(asset.growth)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Info Box */}
      <div className="glass-card p-6 border-l-4 border-accent-500">
        <h4 className="text-sm font-semibold text-white mb-2">About These Projections</h4>
        <p className="text-sm text-midnight-300">
          These projections are based on your estimated CAGR (Compound Annual Growth Rate) for each asset. 
          They assume consistent growth and don't account for market volatility, inflation, or taxes. 
          Actual results will vary. Use these projections for planning purposes only.
        </p>
      </div>
    </div>
  );
}
