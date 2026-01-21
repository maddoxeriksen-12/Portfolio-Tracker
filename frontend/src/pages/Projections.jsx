import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calculator, Calendar, DollarSign, Settings2, Edit3, Check } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
  const [yearlyContributions, setYearlyContributions] = useState(() => {
    // Load from localStorage on initial render
    const saved = localStorage.getItem('projectionYearlyContributions');
    return saved ? JSON.parse(saved) : {};
  });
  const [assetCAGRs, setAssetCAGRs] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [editValue, setEditValue] = useState('');

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    fetchProjections(years, yearlyContributions);
  }, [years, yearlyContributions]);

  // Load asset CAGRs from projection data when available
  useEffect(() => {
    if (projections?.projections?.[0]?.assetValues) {
      const cagrs = {};
      projections.projections[0].assetValues.forEach(asset => {
        // Find matching asset by symbol to get assetId
        const matchingAsset = assets?.find(a => a.symbol === asset.symbol);
        if (matchingAsset) {
          cagrs[matchingAsset.assetId] = asset.estimatedCAGR;
        }
      });
      setAssetCAGRs(cagrs);
    }
  }, [projections, assets]);

  const handleContributionChange = (calendarYear, value) => {
    const newValue = parseFloat(value) || 0;
    const newContributions = { ...yearlyContributions, [calendarYear]: newValue };
    setYearlyContributions(newContributions);
    // Save to localStorage
    localStorage.setItem('projectionYearlyContributions', JSON.stringify(newContributions));
  };

  const handleCAGRChange = async (assetId, cagr) => {
    const cagrValue = parseFloat(cagr) || 0;
    setAssetCAGRs({ ...assetCAGRs, [assetId]: cagrValue });
    // Save to backend (persists in database)
    await setAssetCAGR(assetId, cagrValue);
    fetchProjections(years, yearlyContributions);
  };

  const startEditingContribution = (calendarYear, currentValue) => {
    setEditingYear(calendarYear);
    setEditValue(currentValue.toString());
  };

  const saveContribution = (calendarYear) => {
    handleContributionChange(calendarYear, editValue);
    setEditingYear(null);
    setEditValue('');
  };

  // Chart data - using actual calendar years
  const chartData = projections?.projections?.map(p => ({
    year: p.calendarYear.toString(),
    endingBalance: p.endingBalance
  })) || [];

  // Asset breakdown for the final year
  const finalYearAssets = projections?.projections?.[years]?.assetValues || [];
  const finalCalendarYear = currentYear + years;

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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <label className="block text-sm font-medium text-midnight-300">Net Monthly Income</label>
              <div className="input-field bg-midnight-700/30 cursor-not-allowed">
                <span className="text-midnight-200">
                  {formatCurrencyFull(projections?.summary?.monthlyNetIncome || 0)}
                </span>
              </div>
              <p className="text-xs text-midnight-400">From income - expenses</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-midnight-300">Monthly Expenses</label>
              <div className="input-field bg-midnight-700/30 cursor-not-allowed">
                <span className="text-midnight-200">
                  {formatCurrencyFull(projections?.summary?.monthlyExpenses || 0)}
                </span>
              </div>
              <p className="text-xs text-midnight-400">12-month average</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-midnight-300">Average CAGR</label>
              <div className="input-field bg-midnight-700/30 cursor-not-allowed">
                <span className="text-midnight-200 font-mono">
                  {(projections?.summary?.averageCAGR || 7).toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-midnight-400">Used for portfolio growth</p>
            </div>
          </div>

          {/* Asset CAGR Settings */}
          {assets && assets.length > 0 && (
            <div className="mt-6 pt-6 border-t border-midnight-700/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-midnight-300">Asset CAGR Estimates</h4>
                <span className="text-xs text-midnight-500">Changes saved automatically</span>
              </div>
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
            <span className="text-sm">Current Value ({currentYear})</span>
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
            <span className="text-sm">Projected Value ({finalCalendarYear})</span>
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
                <linearGradient id="colorEnding" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                labelFormatter={(label) => `Year ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="endingBalance"
                name="Ending Balance"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorEnding)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Yearly Breakdown with Editable Contributions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-midnight-800/50">
          <h3 className="text-lg font-display font-semibold text-white">Yearly Breakdown</h3>
          <p className="text-sm text-midnight-400 mt-1">Click the edit icon to set monthly contributions for each year</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-midnight-800/50">
                <th className="table-header px-6 py-4">Year</th>
                <th className="table-header px-6 py-4 text-right">Starting Balance</th>
                <th className="table-header px-6 py-4 text-right">Monthly Contribution</th>
                <th className="table-header px-6 py-4 text-right">
                  <span title="Monthly contributions compounded monthly throughout the year">Contributions (Compounded)</span>
                </th>
                <th className="table-header px-6 py-4 text-right">Remaining Income</th>
                <th className="table-header px-6 py-4 text-right">Ending Balance</th>
              </tr>
            </thead>
            <tbody>
              {projections?.projections?.map((p, index) => (
                <tr 
                  key={p.calendarYear} 
                  className={`hover:bg-midnight-800/30 transition-colors ${p.yearOffset === years ? 'bg-accent-500/5' : ''}`}
                >
                  <td className="table-cell px-6 font-medium text-white">
                    {p.calendarYear}
                    {p.yearOffset === 0 && <span className="text-xs text-midnight-400 ml-2">(Current)</span>}
                  </td>
                  <td className="table-cell px-6 text-right font-mono text-midnight-200">
                    {formatCurrencyFull(p.startingBalance)}
                  </td>
                  <td className="table-cell px-6 text-right">
                    {p.yearOffset === 0 ? (
                      <span className="text-midnight-500">—</span>
                    ) : editingYear === p.calendarYear ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-midnight-400">$</span>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveContribution(p.calendarYear)}
                          className="input-field w-24 text-right py-1 px-2"
                          autoFocus
                        />
                        <button
                          onClick={() => saveContribution(p.calendarYear)}
                          className="p-1 rounded hover:bg-accent-500/20 text-accent-400"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono text-accent-400">
                          {p.monthlyContribution > 0 ? `$${p.monthlyContribution.toLocaleString()}/mo` : '—'}
                        </span>
                        <button
                          onClick={() => startEditingContribution(p.calendarYear, p.monthlyContribution)}
                          className="p-1 rounded hover:bg-midnight-700/50 text-midnight-400 hover:text-midnight-200"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="table-cell px-6 text-right">
                    {p.yearOffset === 0 || p.monthlyContribution === 0 ? (
                      <span className="text-midnight-500">—</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-accent-400">
                          {formatCurrencyFull(p.yearlyContributions)}
                        </span>
                        {p.contributionGrowth > 0 && (
                          <span className="text-xs text-midnight-400">
                            ({formatCurrencyFull(p.rawContributions)} + {formatCurrencyFull(p.contributionGrowth)} growth)
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="table-cell px-6 text-right font-mono text-accent-400">
                    {p.yearlyRemainingIncome > 0 ? `+${formatCurrencyFull(p.yearlyRemainingIncome)}` : '—'}
                  </td>
                  <td className="table-cell px-6 text-right font-mono font-medium text-gain">
                    {formatCurrencyFull(p.endingBalance)}
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
            Projected Asset Values ({finalCalendarYear})
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
          <strong>Monthly Compounding:</strong> Your monthly contributions compound monthly using the average CAGR. 
          Each monthly contribution grows for its remaining months in the year (Month 1 grows 11 months, Month 2 grows 10 months, etc.).
          <br /><br />
          <strong>Income:</strong> Calculated from your income records—add future income sources with start dates to model promotions. 
          Remaining Income = Yearly Income - Expenses - Contributions.
          <br /><br />
          Projections assume consistent growth and don't account for market volatility, inflation, or taxes.
        </p>
      </div>
    </div>
  );
}
