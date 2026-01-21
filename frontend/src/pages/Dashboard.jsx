import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Building2,
  Plus,
  X,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Calendar,
  Percent
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

const ACCOUNT_TYPES = [
  { value: 'ROTH_IRA', label: 'Roth IRA' },
  { value: '401K', label: '401(k)' },
  { value: 'TRADITIONAL_IRA', label: 'Traditional IRA' },
  { value: '403B', label: '403(b)' },
  { value: '457B', label: '457(b)' },
  { value: 'SEP_IRA', label: 'SEP IRA' },
  { value: 'SIMPLE_IRA', label: 'SIMPLE IRA' },
  { value: 'PENSION', label: 'Pension' },
  { value: 'HSA', label: 'HSA' },
  { value: 'OTHER', label: 'Other' }
];

const CONTRIBUTION_FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi-Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUALLY', label: 'Annually' },
  { value: 'ONE_TIME', label: 'One-Time' }
];

const CONTRIBUTION_TYPES = [
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'EMPLOYER_MATCH', label: 'Employer Match' },
  { value: 'EMPLOYER_CONTRIBUTION', label: 'Employer Contribution' }
];

export default function Dashboard() {
  const { 
    overview, 
    assets, 
    fetchOverview, 
    refreshPrices,
    fetchReturns, 
    isLoading,
    retirementAccounts,
    retirementSummary,
    fetchRetirementAccounts,
    createRetirementAccount,
    updateRetirementAccount,
    deleteRetirementAccount,
    addRetirementContribution,
    deleteRetirementContribution
  } = usePortfolioStore();
  
  const [returns, setReturns] = useState(null);
  const [todayReturn, setTodayReturn] = useState(null);
  const [timeframe, setTimeframe] = useState('1Y');
  const [showRetirementModal, setShowRetirementModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [expandedAccount, setExpandedAccount] = useState(null);
  const [showContributionModal, setShowContributionModal] = useState(null);
  const [accountForm, setAccountForm] = useState({
    accountName: '',
    accountType: '401K',
    currentValue: '',
    estimatedCagr: '7',
    employerName: '',
    notes: ''
  });
  const [contributionForm, setContributionForm] = useState({
    contributionType: 'PERSONAL',
    amount: '',
    frequency: 'MONTHLY',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    notes: ''
  });
  const [showTodayReturnModal, setShowTodayReturnModal] = useState(false);

  useEffect(() => {
    fetchOverview();
    fetchRetirementAccounts();
    loadReturns('1Y');
  }, []);

  // Recalculate today's return when overview and retirement data are available
  useEffect(() => {
    if (overview && retirementSummary !== undefined) {
      calculateTodayReturn();
    }
  }, [overview, retirementSummary, assets]);

  const loadReturns = async (tf) => {
    setTimeframe(tf);
    const data = await fetchReturns(tf);
    setReturns(data);
  };

  // Calculate today's return using actual price change data from assets
  const calculateTodayReturn = () => {
    // Use actual daily change data from assets (populated by backend from market data)
    const stocksDailyReturn = overview?.stocksDailyChange || 0;
    const cryptoDailyReturn = overview?.cryptoDailyChange || 0;
    
    // Retirement accounts: keep using projected daily growth based on CAGR
    // This represents expected growth, not market fluctuations
    const retirementCagr = retirementSummary?.avgCagr || 7;
    const dailyRetirementRate = Math.pow(1 + (retirementCagr / 100), 1/365) - 1;
    const retirementReturn = (retirementSummary?.totalValue || 0) * dailyRetirementRate;
    
    const totalReturn = stocksDailyReturn + cryptoDailyReturn + retirementReturn;
    const totalNetWorth = (overview?.totalCurrentValue || 0) + (retirementSummary?.totalValue || 0);
    const previousNetWorth = totalNetWorth - totalReturn;
    const totalPercent = previousNetWorth > 0 ? (totalReturn / previousNetWorth) * 100 : 0;
    
    // Calculate individual percentages based on previous day values
    const previousStocksValue = (overview?.stocksValue || 0) - stocksDailyReturn;
    const previousCryptoValue = (overview?.cryptoValue || 0) - cryptoDailyReturn;
    const previousRetirementValue = (retirementSummary?.totalValue || 0) - retirementReturn;
    
    setTodayReturn({
      value: totalReturn,
      percent: totalPercent,
      breakdown: {
        stocks: {
          value: stocksDailyReturn,
          percent: previousStocksValue > 0 ? (stocksDailyReturn / previousStocksValue) * 100 : 0
        },
        crypto: {
          value: cryptoDailyReturn,
          percent: previousCryptoValue > 0 ? (cryptoDailyReturn / previousCryptoValue) * 100 : 0
        },
        retirement: {
          value: retirementReturn,
          percent: previousRetirementValue > 0 ? (retirementReturn / previousRetirementValue) * 100 : 0
        }
      },
      // Include per-asset breakdown for detailed view
      assetBreakdown: assets?.map(asset => ({
        symbol: asset.symbol,
        assetType: asset.assetType,
        dailyChange: asset.todayDollarChange || 0,
        dailyChangePercent: asset.dailyChangePercent || 0,
        currentValue: asset.currentValue
      })) || []
    });
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
  const todayIsPositive = (todayReturn?.value || 0) >= 0;

  const handleCreateAccount = async () => {
    const result = await createRetirementAccount({
      accountName: accountForm.accountName,
      accountType: accountForm.accountType,
      currentValue: parseFloat(accountForm.currentValue) || 0,
      estimatedCagr: parseFloat(accountForm.estimatedCagr) || 7,
      employerName: accountForm.employerName,
      notes: accountForm.notes
    });

    if (result.success) {
      setShowRetirementModal(false);
      setAccountForm({
        accountName: '',
        accountType: '401K',
        currentValue: '',
        estimatedCagr: '7',
        employerName: '',
        notes: ''
      });
    }
  };

  const handleUpdateAccount = async () => {
    const result = await updateRetirementAccount(editingAccount.id, {
      accountName: accountForm.accountName,
      accountType: accountForm.accountType,
      currentValue: parseFloat(accountForm.currentValue) || 0,
      estimatedCagr: parseFloat(accountForm.estimatedCagr) || 7,
      employerName: accountForm.employerName,
      notes: accountForm.notes
    });

    if (result.success) {
      setEditingAccount(null);
      setShowRetirementModal(false);
      setAccountForm({
        accountName: '',
        accountType: '401K',
        currentValue: '',
        estimatedCagr: '7',
        employerName: '',
        notes: ''
      });
    }
  };

  const handleDeleteAccount = async (id) => {
    if (confirm('Are you sure you want to delete this retirement account?')) {
      await deleteRetirementAccount(id);
    }
  };

  const handleAddContribution = async (accountId) => {
    const result = await addRetirementContribution(accountId, {
      contributionType: contributionForm.contributionType,
      amount: parseFloat(contributionForm.amount) || 0,
      frequency: contributionForm.frequency,
      startDate: contributionForm.startDate,
      endDate: contributionForm.endDate || null,
      notes: contributionForm.notes
    });

    if (result.success) {
      setShowContributionModal(null);
      setContributionForm({
        contributionType: 'PERSONAL',
        amount: '',
        frequency: 'MONTHLY',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        notes: ''
      });
    }
  };

  const handleDeleteContribution = async (contributionId) => {
    if (confirm('Delete this contribution?')) {
      await deleteRetirementContribution(contributionId);
    }
  };

  const openEditAccount = (account) => {
    setEditingAccount(account);
    setAccountForm({
      accountName: account.accountName || account.account_name,
      accountType: account.accountType || account.account_type,
      currentValue: account.currentValue?.toString() || '',
      estimatedCagr: account.estimatedCagr?.toString() || '7',
      employerName: account.employerName || account.employer_name || '',
      notes: account.notes || ''
    });
    setShowRetirementModal(true);
  };

  // Calculate combined net worth
  const totalNetWorth = (overview?.totalCurrentValue || 0) + (retirementSummary?.totalValue || 0);

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Dashboard</h1>
          <p className="text-midnight-400 mt-1">Your portfolio at a glance</p>
        </div>
        <button
          onClick={() => { refreshPrices(); fetchRetirementAccounts(); }}
          disabled={isLoading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards - Now with 5 cards including Today's Return */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Net Worth */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stat-card lg:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="stat-label">Net Worth</span>
            <div className="p-2 rounded-lg bg-accent-500/10">
              <Wallet className="w-5 h-5 text-accent-400" />
            </div>
          </div>
          <p className="stat-value text-white">
            {formatCurrency(totalNetWorth)}
          </p>
          <p className="text-xs text-midnight-400">Portfolio + Retirement</p>
        </motion.div>

        {/* Today's Return - Clickable */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="stat-card cursor-pointer hover:border-accent-500/50 transition-colors"
          onClick={() => setShowTodayReturnModal(true)}
        >
          <div className="flex items-center justify-between">
            <span className="stat-label">Today's Return</span>
            <div className={`p-2 rounded-lg ${todayIsPositive ? 'bg-gain/10' : 'bg-loss/10'}`}>
              {todayIsPositive ? (
                <TrendingUp className="w-5 h-5 text-gain" />
              ) : (
                <TrendingDown className="w-5 h-5 text-loss" />
              )}
            </div>
          </div>
          <p className={`stat-value ${todayIsPositive ? 'text-gain' : 'text-loss'}`}>
            {formatCurrency(todayReturn?.value || 0)}
          </p>
          <p className={`text-sm ${todayIsPositive ? 'text-gain' : 'text-loss'}`}>
            {formatPercent(todayReturn?.percent || 0)}
          </p>
          <p className="text-xs text-midnight-500 mt-1">Click for breakdown</p>
        </motion.div>

        {/* Total Return */}
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

        {/* Stocks */}
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

        {/* Crypto */}
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

      {/* Retirement Accounts Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Building2 className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-display font-semibold text-white">Retirement Accounts</h3>
              <p className="text-sm text-midnight-400">
                {retirementAccounts?.length || 0} account{retirementAccounts?.length !== 1 ? 's' : ''} · {formatCurrency(retirementSummary?.totalValue || 0)} total
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingAccount(null);
              setAccountForm({
                accountName: '',
                accountType: '401K',
                currentValue: '',
                estimatedCagr: '7',
                employerName: '',
                notes: ''
              });
              setShowRetirementModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>

        {retirementAccounts && retirementAccounts.length > 0 ? (
          <div className="space-y-3">
            {retirementAccounts.map((account, index) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-midnight-800/50 rounded-xl border border-midnight-700/50 overflow-hidden"
              >
                <div 
                  className="p-4 cursor-pointer hover:bg-midnight-800/80 transition-colors"
                  onClick={() => setExpandedAccount(expandedAccount === account.id ? null : account.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center">
                        <span className="text-lg font-bold text-violet-400">
                          {(account.accountTypeLabel || account.account_type)?.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{account.accountName || account.account_name}</h4>
                        <p className="text-xs text-midnight-400">
                          {account.accountTypeLabel || account.account_type}
                          {(account.employerName || account.employer_name) && ` · ${account.employerName || account.employer_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-white">{formatCurrency(account.currentValue || account.current_value || 0)}</p>
                        <p className="text-xs text-accent-400">
                          +{formatCurrency(account.monthlyContribution || 0)}/mo
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditAccount(account); }}
                          className="p-2 rounded-lg hover:bg-midnight-700/50 text-midnight-400 hover:text-white transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteAccount(account.id); }}
                          className="p-2 rounded-lg hover:bg-loss/10 text-midnight-400 hover:text-loss transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {expandedAccount === account.id ? (
                          <ChevronUp className="w-5 h-5 text-midnight-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-midnight-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedAccount === account.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-midnight-700/50"
                    >
                      <div className="p-4 space-y-4">
                        {/* Account Details */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-3 bg-midnight-900/50 rounded-lg">
                            <p className="text-xs text-midnight-400 mb-1">Estimated CAGR</p>
                            <p className="font-mono text-white">{account.estimatedCagr || account.estimated_cagr || 7}%</p>
                          </div>
                          <div className="p-3 bg-midnight-900/50 rounded-lg">
                            <p className="text-xs text-midnight-400 mb-1">Yearly Contribution</p>
                            <p className="font-mono text-accent-400">{formatCurrency(account.yearlyContribution || 0)}</p>
                          </div>
                          <div className="p-3 bg-midnight-900/50 rounded-lg">
                            <p className="text-xs text-midnight-400 mb-1">10Y Projection</p>
                            <p className="font-mono text-gain">
                              {formatCurrency(
                                (account.currentValue || 0) * Math.pow(1 + (account.estimatedCagr || 7) / 100, 10) +
                                (account.yearlyContribution || 0) * ((Math.pow(1 + (account.estimatedCagr || 7) / 100, 10) - 1) / ((account.estimatedCagr || 7) / 100))
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Contributions */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-sm font-medium text-midnight-300">Contributions</h5>
                            <button
                              onClick={() => setShowContributionModal(account.id)}
                              className="text-xs text-accent-400 hover:text-accent-300 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Contribution
                            </button>
                          </div>
                          {account.contributions && account.contributions.length > 0 ? (
                            <div className="space-y-2">
                              {account.contributions.map((contrib) => (
                                <div 
                                  key={contrib.id}
                                  className="flex items-center justify-between p-3 bg-midnight-900/30 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${
                                      contrib.contributionType === 'PERSONAL' || contrib.contribution_type === 'PERSONAL' ? 'bg-accent-400' :
                                      'bg-gain'
                                    }`} />
                                    <div>
                                      <p className="text-sm text-white">
                                        {formatCurrency(contrib.amount)} / {contrib.frequency?.toLowerCase().replace('_', '-')}
                                      </p>
                                      <p className="text-xs text-midnight-400">
                                        {contrib.contributionType === 'PERSONAL' || contrib.contribution_type === 'PERSONAL' ? 'Personal' : 'Employer'}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteContribution(contrib.id)}
                                    className="p-1 rounded hover:bg-loss/10 text-midnight-400 hover:text-loss"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-midnight-500 text-center py-4">
                              No contributions set up yet
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-midnight-600 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-white mb-2">No retirement accounts yet</h4>
            <p className="text-midnight-400 mb-4">Add your 401(k), IRA, or other retirement accounts to track your progress</p>
          </div>
        )}
      </motion.div>

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

      {/* Retirement Account Modal */}
      <AnimatePresence>
        {showRetirementModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRetirementModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-lg p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-display font-semibold text-white">
                  {editingAccount ? 'Edit Retirement Account' : 'Add Retirement Account'}
                </h3>
                <button
                  onClick={() => setShowRetirementModal(false)}
                  className="p-2 rounded-lg hover:bg-midnight-700/50 text-midnight-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-midnight-300 mb-2">Account Name</label>
                  <input
                    type="text"
                    value={accountForm.accountName}
                    onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                    placeholder="e.g., Fidelity 401(k)"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-midnight-300 mb-2">Account Type</label>
                    <select
                      value={accountForm.accountType}
                      onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value })}
                      className="input-field"
                    >
                      {ACCOUNT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-midnight-300 mb-2">Current Value</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
                      <input
                        type="number"
                        value={accountForm.currentValue}
                        onChange={(e) => setAccountForm({ ...accountForm, currentValue: e.target.value })}
                        placeholder="0.00"
                        className="input-field pl-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-midnight-300 mb-2">Estimated CAGR</label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
                      <input
                        type="number"
                        step="0.1"
                        value={accountForm.estimatedCagr}
                        onChange={(e) => setAccountForm({ ...accountForm, estimatedCagr: e.target.value })}
                        placeholder="7"
                        className="input-field pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-midnight-300 mb-2">Employer (Optional)</label>
                    <input
                      type="text"
                      value={accountForm.employerName}
                      onChange={(e) => setAccountForm({ ...accountForm, employerName: e.target.value })}
                      placeholder="e.g., Google"
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-midnight-300 mb-2">Notes (Optional)</label>
                  <textarea
                    value={accountForm.notes}
                    onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
                    placeholder="Any additional notes..."
                    className="input-field resize-none h-20"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowRetirementModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingAccount ? handleUpdateAccount : handleCreateAccount}
                    className="btn-primary flex-1"
                  >
                    {editingAccount ? 'Save Changes' : 'Add Account'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contribution Modal */}
      <AnimatePresence>
        {showContributionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowContributionModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-display font-semibold text-white">Add Contribution</h3>
                <button
                  onClick={() => setShowContributionModal(null)}
                  className="p-2 rounded-lg hover:bg-midnight-700/50 text-midnight-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-midnight-300 mb-2">Type</label>
                    <select
                      value={contributionForm.contributionType}
                      onChange={(e) => setContributionForm({ ...contributionForm, contributionType: e.target.value })}
                      className="input-field"
                    >
                      {CONTRIBUTION_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-midnight-300 mb-2">Amount</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
                      <input
                        type="number"
                        value={contributionForm.amount}
                        onChange={(e) => setContributionForm({ ...contributionForm, amount: e.target.value })}
                        placeholder="0.00"
                        className="input-field pl-9"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-midnight-300 mb-2">Frequency</label>
                  <select
                    value={contributionForm.frequency}
                    onChange={(e) => setContributionForm({ ...contributionForm, frequency: e.target.value })}
                    className="input-field"
                  >
                    {CONTRIBUTION_FREQUENCIES.map(freq => (
                      <option key={freq.value} value={freq.value}>{freq.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-midnight-300 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={contributionForm.startDate}
                      onChange={(e) => setContributionForm({ ...contributionForm, startDate: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-midnight-300 mb-2">End Date (Optional)</label>
                    <input
                      type="date"
                      value={contributionForm.endDate}
                      onChange={(e) => setContributionForm({ ...contributionForm, endDate: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowContributionModal(null)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddContribution(showContributionModal)}
                    className="btn-primary flex-1"
                  >
                    Add Contribution
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today's Return Breakdown Modal */}
      <AnimatePresence>
        {showTodayReturnModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTodayReturnModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-display font-semibold text-white">Today's Return Breakdown</h3>
                <button
                  onClick={() => setShowTodayReturnModal(false)}
                  className="p-2 rounded-lg hover:bg-midnight-700/50 text-midnight-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Total Return Summary */}
              <div className={`p-4 rounded-xl mb-6 ${todayIsPositive ? 'bg-gain/10 border border-gain/20' : 'bg-loss/10 border border-loss/20'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-midnight-400">Total Daily Return</p>
                    <p className={`text-2xl font-display font-bold ${todayIsPositive ? 'text-gain' : 'text-loss'}`}>
                      {formatCurrency(todayReturn?.value || 0)}
                    </p>
                  </div>
                  <div className={`text-right`}>
                    <div className={`flex items-center gap-1 ${todayIsPositive ? 'text-gain' : 'text-loss'}`}>
                      {todayIsPositive ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : (
                        <TrendingDown className="w-5 h-5" />
                      )}
                      <span className="text-xl font-bold">{formatPercent(todayReturn?.percent || 0)}</span>
                    </div>
                    <p className="text-xs text-midnight-500">of net worth</p>
                  </div>
                </div>
              </div>

              {/* Breakdown by Category */}
              <div className="space-y-3">
                {/* Stocks */}
                <div className="p-4 bg-midnight-800/50 rounded-xl border border-midnight-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-accent-500/10">
                        <BarChart3 className="w-5 h-5 text-accent-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">Stocks</p>
                        <p className="text-xs text-midnight-400">
                          {formatCurrency(overview?.stocksValue || 0)} total
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-semibold ${(todayReturn?.breakdown?.stocks?.value || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {(todayReturn?.breakdown?.stocks?.value || 0) >= 0 ? '+' : ''}{formatCurrency(todayReturn?.breakdown?.stocks?.value || 0)}
                      </p>
                      <p className={`text-sm ${(todayReturn?.breakdown?.stocks?.percent || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {formatPercent(todayReturn?.breakdown?.stocks?.percent || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Crypto */}
                <div className="p-4 bg-midnight-800/50 rounded-xl border border-midnight-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-warning/10">
                        <PieChart className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <p className="font-medium text-white">Crypto</p>
                        <p className="text-xs text-midnight-400">
                          {formatCurrency(overview?.cryptoValue || 0)} total
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-semibold ${(todayReturn?.breakdown?.crypto?.value || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {(todayReturn?.breakdown?.crypto?.value || 0) >= 0 ? '+' : ''}{formatCurrency(todayReturn?.breakdown?.crypto?.value || 0)}
                      </p>
                      <p className={`text-sm ${(todayReturn?.breakdown?.crypto?.percent || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {formatPercent(todayReturn?.breakdown?.crypto?.percent || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Retirement (Projected) */}
                <div className="p-4 bg-midnight-800/50 rounded-xl border border-violet-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-violet-500/10">
                        <Building2 className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">Retirement <span className="text-xs text-violet-400">(projected)</span></p>
                        <p className="text-xs text-midnight-400">
                          {formatCurrency(retirementSummary?.totalValue || 0)} total
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-semibold ${(todayReturn?.breakdown?.retirement?.value || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {(todayReturn?.breakdown?.retirement?.value || 0) >= 0 ? '+' : ''}{formatCurrency(todayReturn?.breakdown?.retirement?.value || 0)}
                      </p>
                      <p className={`text-sm ${(todayReturn?.breakdown?.retirement?.percent || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {formatPercent(todayReturn?.breakdown?.retirement?.percent || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Asset Breakdown */}
              {todayReturn?.assetBreakdown && todayReturn.assetBreakdown.length > 0 && (
                <div className="mt-4 pt-4 border-t border-midnight-700/50">
                  <h4 className="text-sm font-medium text-midnight-300 mb-3">Per-Asset Breakdown</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {todayReturn.assetBreakdown.map((asset, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-midnight-900/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{asset.symbol}</span>
                          <span className="text-xs text-midnight-500">{asset.assetType}</span>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-mono ${(asset.dailyChange || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {(asset.dailyChange || 0) >= 0 ? '+' : ''}{formatCurrency(asset.dailyChange || 0)}
                          </p>
                          <p className={`text-xs ${(asset.dailyChangePercent || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {formatPercent(asset.dailyChangePercent || 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info note */}
              <p className="text-xs text-midnight-500 mt-4 text-center">
                Stock & crypto returns reflect actual market price changes. Retirement returns are projected based on CAGR. Click "Refresh" to fetch latest prices.
              </p>

              <button
                onClick={() => setShowTodayReturnModal(false)}
                className="btn-secondary w-full mt-4"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
