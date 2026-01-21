import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Calculator, Calendar, DollarSign, Settings2, Edit3, Check, Building2, BarChart3, PieChart } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ComposedChart, Bar } from 'recharts';
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
  const { 
    projections, 
    assets, 
    fetchProjections, 
    fetchOverview, 
    setAssetCAGR,
    retirementAccounts,
    retirementSummary,
    fetchRetirementAccounts,
    fetchRetirementProjections
  } = usePortfolioStore();
  
  const [years, setYears] = useState(10);
  const [yearlyContributions, setYearlyContributions] = useState(() => {
    const saved = localStorage.getItem('projectionYearlyContributions');
    return saved ? JSON.parse(saved) : {};
  });
  const [assetCAGRs, setAssetCAGRs] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [retirementProjections, setRetirementProjections] = useState(null);
  const [activeView, setActiveView] = useState('combined'); // 'combined', 'brokerage', 'retirement'

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchOverview();
    fetchRetirementAccounts();
  }, []);

  useEffect(() => {
    fetchProjections(years, yearlyContributions);
    loadRetirementProjections();
  }, [years, yearlyContributions]);

  const loadRetirementProjections = async () => {
    const data = await fetchRetirementProjections(years);
    setRetirementProjections(data);
  };

  // Load asset CAGRs from projection data when available
  useEffect(() => {
    if (projections?.projections?.[0]?.assetValues) {
      const cagrs = {};
      projections.projections[0].assetValues.forEach(asset => {
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
    localStorage.setItem('projectionYearlyContributions', JSON.stringify(newContributions));
  };

  const handleCAGRChange = async (assetId, cagr) => {
    const cagrValue = parseFloat(cagr) || 0;
    setAssetCAGRs({ ...assetCAGRs, [assetId]: cagrValue });
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

  // Combined chart data
  const chartData = projections?.projections?.map((p, index) => {
    const retirementValue = retirementProjections?.projections?.[index]?.totalValue || 0;
    return {
      year: p.calendarYear.toString(),
      brokerage: p.endingBalance,
      retirement: retirementValue,
      combined: p.endingBalance + retirementValue
    };
  }) || [];

  // Asset breakdown for the final year
  const finalYearAssets = projections?.projections?.[years]?.assetValues || [];
  const finalCalendarYear = currentYear + years;

  // Calculate combined summary
  const brokerageCurrentValue = projections?.summary?.currentValue || 0;
  const brokerageProjectedValue = projections?.summary?.projectedValue || 0;
  const retirementCurrentValue = retirementSummary?.totalValue || 0;
  const retirementProjectedValue = retirementProjections?.summary?.projectedValue || retirementCurrentValue;
  const combinedCurrentValue = brokerageCurrentValue + retirementCurrentValue;
  const combinedProjectedValue = brokerageProjectedValue + retirementProjectedValue;
  const totalGrowth = combinedProjectedValue - combinedCurrentValue;
  const growthMultiple = combinedCurrentValue > 0 ? (combinedProjectedValue / combinedCurrentValue).toFixed(1) : 'N/A';

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Current Net Worth</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">
            {formatCurrencyFull(combinedCurrentValue)}
          </p>
          <p className="text-xs text-midnight-500 mt-1">
            Brokerage: {formatCurrency(brokerageCurrentValue)} · Retirement: {formatCurrency(retirementCurrentValue)}
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
            {formatCurrencyFull(combinedProjectedValue)}
          </p>
          <p className="text-xs text-midnight-500 mt-1">
            Brokerage: {formatCurrency(brokerageProjectedValue)} · Retirement: {formatCurrency(retirementProjectedValue)}
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
            {formatCurrencyFull(totalGrowth)}
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
            {growthMultiple}x
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <Building2 className="w-4 h-4" />
            <span className="text-sm">Retirement Monthly</span>
          </div>
          <p className="text-2xl font-display font-bold text-violet-400">
            {formatCurrencyFull(retirementSummary?.totalMonthlyContribution || 0)}
          </p>
          <p className="text-xs text-midnight-500 mt-1">
            {retirementAccounts?.length || 0} accounts
          </p>
        </motion.div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveView('combined')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeView === 'combined' ? 'bg-accent-500 text-white' : 'text-midnight-400 hover:text-white hover:bg-midnight-800/50'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Combined
        </button>
        <button
          onClick={() => setActiveView('brokerage')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeView === 'brokerage' ? 'bg-accent-500 text-white' : 'text-midnight-400 hover:text-white hover:bg-midnight-800/50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Brokerage
        </button>
        <button
          onClick={() => setActiveView('retirement')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeView === 'retirement' ? 'bg-violet-500 text-white' : 'text-midnight-400 hover:text-white hover:bg-midnight-800/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Retirement
        </button>
      </div>

      {/* Main Projection Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-display font-semibold text-white mb-6">
          {activeView === 'combined' ? 'Combined Net Worth Projection' :
           activeView === 'brokerage' ? 'Brokerage Portfolio Projection' :
           'Retirement Accounts Projection'}
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {activeView === 'combined' ? (
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="colorBrokerage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2a97ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2a97ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRetirement" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                  formatter={(value, name) => [formatCurrencyFull(value), name === 'brokerage' ? 'Brokerage' : name === 'retirement' ? 'Retirement' : 'Combined']}
                  labelFormatter={(label) => `Year ${label}`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="brokerage"
                  name="Brokerage"
                  stroke="#2a97ff"
                  strokeWidth={2}
                  fill="url(#colorBrokerage)"
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="retirement"
                  name="Retirement"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorRetirement)"
                  stackId="1"
                />
              </ComposedChart>
            ) : activeView === 'brokerage' ? (
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
                  dataKey="brokerage"
                  name="Ending Balance"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorEnding)"
                />
              </AreaChart>
            ) : (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRetirementFull" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                  dataKey="retirement"
                  name="Retirement Value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorRetirementFull)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Retirement Accounts Summary */}
      {retirementAccounts && retirementAccounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-display font-semibold text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-violet-400" />
            Retirement Account Projections ({finalCalendarYear})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {retirementAccounts.map((account, index) => {
              const cagr = (account.estimatedCagr || account.estimated_cagr || 7) / 100;
              const currentVal = account.currentValue || account.current_value || 0;
              const yearlyContrib = account.yearlyContribution || 0;
              
              // Calculate projected value with compound growth + contributions
              const projectedValue = currentVal * Math.pow(1 + cagr, years) + 
                (yearlyContrib > 0 ? yearlyContrib * ((Math.pow(1 + cagr, years) - 1) / cagr) : 0);
              
              const growth = projectedValue - currentVal;
              const totalContributions = yearlyContrib * years;
              const investmentGrowth = growth - totalContributions;
              
              return (
                <div 
                  key={account.id}
                  className="p-4 bg-gradient-to-br from-violet-500/10 to-purple-600/10 rounded-xl border border-violet-500/20"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-medium text-white">{account.accountName || account.account_name}</span>
                      <p className="text-xs text-midnight-400">{account.accountTypeLabel || account.account_type}</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-violet-500/20 text-violet-300 rounded-full">
                      {account.estimatedCagr || account.estimated_cagr || 7}% CAGR
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-midnight-400">Current</span>
                      <span className="font-mono text-midnight-200">{formatCurrencyFull(currentVal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-midnight-400">Projected ({years}Y)</span>
                      <span className="font-mono text-violet-400">{formatCurrencyFull(projectedValue)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-midnight-700/50">
                      <span className="text-midnight-400">Total Contributions</span>
                      <span className="font-mono text-accent-400">+{formatCurrencyFull(totalContributions)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-midnight-400">Investment Growth</span>
                      <span className="font-mono text-gain">+{formatCurrencyFull(investmentGrowth)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Yearly Breakdown with Editable Contributions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-midnight-800/50">
          <h3 className="text-lg font-display font-semibold text-white">Brokerage Yearly Breakdown</h3>
          <p className="text-sm text-midnight-400 mt-1">Click the edit icon to set monthly contributions for each year</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-midnight-800/50">
                <th className="table-header px-6 py-4">Year</th>
                <th className="table-header px-6 py-4 text-right">Starting Balance</th>
                <th className="table-header px-6 py-4 text-right">
                  <span title="Growth on starting balance compounded monthly">Portfolio Growth</span>
                </th>
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
                  <td className="table-cell px-6 text-right font-mono text-gain">
                    {p.portfolioGrowth > 0 ? `+${formatCurrencyFull(p.portfolioGrowth)}` : '—'}
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
          transition={{ delay: 0.7 }}
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
          <strong>Monthly Compounding:</strong> Both your portfolio and contributions compound monthly using the average CAGR. 
          Each monthly contribution grows for its remaining months in the year (Month 1 grows 11 months, Month 2 grows 10 months, etc.).
          <br /><br />
          <strong>Retirement Accounts:</strong> Included separately with their own CAGR estimates and contribution schedules. 
          Combined projections show your total net worth trajectory.
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
