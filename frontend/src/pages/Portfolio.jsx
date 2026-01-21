import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, TrendingDown, Info, Building2, BarChart3, ChevronRight, X, Edit3, Plus, Trash2, DollarSign, Percent } from 'lucide-react';
import usePortfolioStore from '../store/portfolioStore';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
};

const formatPercent = (value) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

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

export default function Portfolio() {
  const { 
    assets, 
    fetchOverview, 
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
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [sortBy, setSortBy] = useState('value');
  const [sortOrder, setSortOrder] = useState('desc');
  const [activeTab, setActiveTab] = useState('brokerage'); // 'brokerage' or 'retirement'
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
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

  useEffect(() => {
    fetchOverview();
    fetchRetirementAccounts();
  }, []);

  const filteredAssets = assets
    ?.filter(asset => {
      const matchesSearch = asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           asset.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'ALL' || asset.assetType === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'symbol':
          aVal = a.symbol;
          bVal = b.symbol;
          return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'value':
          aVal = a.currentValue;
          bVal = b.currentValue;
          break;
        case 'return':
          aVal = a.gainLossPercent;
          bVal = b.gainLossPercent;
          break;
        case 'allocation':
          aVal = a.allocation;
          bVal = b.allocation;
          break;
        default:
          return 0;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }) || [];

  // Filter retirement accounts by search
  const filteredRetirementAccounts = retirementAccounts?.filter(account => {
    const name = account.accountName || account.account_name || '';
    const employer = account.employerName || account.employer_name || '';
    const type = account.accountTypeLabel || account.account_type || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           employer.toLowerCase().includes(searchQuery.toLowerCase()) ||
           type.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  const totalValue = assets?.reduce((sum, a) => sum + a.currentValue, 0) || 0;
  const totalCost = assets?.reduce((sum, a) => sum + a.costBasis, 0) || 0;
  const totalReturn = totalValue - totalCost;
  const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  // Combined totals
  const retirementTotal = retirementSummary?.totalValue || 0;
  const combinedNetWorth = totalValue + retirementTotal;

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
      setShowAccountModal(false);
      resetAccountForm();
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
      setShowAccountModal(false);
      resetAccountForm();
    }
  };

  const handleDeleteAccount = async (id) => {
    if (confirm('Are you sure you want to delete this retirement account?')) {
      await deleteRetirementAccount(id);
      setSelectedAccount(null);
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
      resetContributionForm();
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
      currentValue: (account.currentValue || account.current_value || 0).toString(),
      estimatedCagr: (account.estimatedCagr || account.estimated_cagr || 7).toString(),
      employerName: account.employerName || account.employer_name || '',
      notes: account.notes || ''
    });
    setShowAccountModal(true);
  };

  const resetAccountForm = () => {
    setAccountForm({
      accountName: '',
      accountType: '401K',
      currentValue: '',
      estimatedCagr: '7',
      employerName: '',
      notes: ''
    });
  };

  const resetContributionForm = () => {
    setContributionForm({
      contributionType: 'PERSONAL',
      amount: '',
      frequency: 'MONTHLY',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      notes: ''
    });
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Portfolio</h1>
        <p className="text-midnight-400 mt-1">Detailed view of your holdings</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-midnight-400 mb-1">Net Worth</p>
          <p className="text-2xl font-display font-bold text-white">{formatCurrency(combinedNetWorth)}</p>
          <p className="text-xs text-midnight-500">All accounts</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-midnight-400 mb-1">Brokerage Value</p>
          <p className="text-2xl font-display font-bold text-white">{formatCurrency(totalValue)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-midnight-400 mb-1">Retirement Value</p>
          <p className="text-2xl font-display font-bold text-violet-400">{formatCurrency(retirementTotal)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-midnight-400 mb-1">Brokerage Return</p>
          <p className={`text-2xl font-display font-bold ${totalReturn >= 0 ? 'text-gain' : 'text-loss'}`}>
            {formatCurrency(totalReturn)}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-midnight-400 mb-1">Return %</p>
          <p className={`text-2xl font-display font-bold ${totalReturnPercent >= 0 ? 'text-gain' : 'text-loss'}`}>
            {formatPercent(totalReturnPercent)}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-midnight-700/50">
        <button
          onClick={() => setActiveTab('brokerage')}
          className={`px-4 py-3 font-medium transition-colors relative ${
            activeTab === 'brokerage' 
              ? 'text-white' 
              : 'text-midnight-400 hover:text-midnight-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Brokerage
          </div>
          {activeTab === 'brokerage' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('retirement')}
          className={`px-4 py-3 font-medium transition-colors relative ${
            activeTab === 'retirement' 
              ? 'text-white' 
              : 'text-midnight-400 hover:text-midnight-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Retirement
            <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">
              {retirementAccounts?.length || 0}
            </span>
          </div>
          {activeTab === 'retirement' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
            />
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'brokerage' ? 'Search assets...' : 'Search retirement accounts...'}
            className="input-field pl-12"
          />
        </div>
        {activeTab === 'brokerage' && (
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-field w-auto"
            >
              <option value="ALL">All Types</option>
              <option value="STOCK">Stocks</option>
              <option value="CRYPTO">Crypto</option>
            </select>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-');
                setSortBy(by);
                setSortOrder(order);
              }}
              className="input-field w-auto"
            >
              <option value="value-desc">Value (High to Low)</option>
              <option value="value-asc">Value (Low to High)</option>
              <option value="return-desc">Return (Best)</option>
              <option value="return-asc">Return (Worst)</option>
              <option value="symbol-asc">Symbol (A-Z)</option>
              <option value="symbol-desc">Symbol (Z-A)</option>
            </select>
          </div>
        )}
        {activeTab === 'retirement' && (
          <button
            onClick={() => {
              setEditingAccount(null);
              resetAccountForm();
              setShowAccountModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        )}
      </div>

      {/* Content based on active tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'brokerage' ? (
          <motion.div
            key="brokerage"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {filteredAssets.map((asset, index) => {
              const isPositive = asset.gainLoss >= 0;
              return (
                <motion.div
                  key={asset.assetId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-card p-5 hover:border-accent-500/30 transition-colors glow-border"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-500/20 to-accent-600/20 flex items-center justify-center">
                        <span className="text-lg font-bold text-accent-400">
                          {asset.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{asset.symbol}</h3>
                        <p className="text-xs text-midnight-400">{asset.name || asset.assetType}</p>
                      </div>
                    </div>
                    <span className={`badge ${asset.assetType === 'STOCK' ? 'bg-accent-500/10 text-accent-400' : 'bg-warning/10 text-warning'}`}>
                      {asset.assetType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-midnight-400 mb-1">Current Price</p>
                      <p className="font-mono text-midnight-200">{formatCurrency(asset.currentPrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-midnight-400 mb-1">Quantity</p>
                      <p className="font-mono text-midnight-200">
                        {asset.quantity.toFixed(asset.assetType === 'CRYPTO' ? 6 : 2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-midnight-400 mb-1">Avg Cost</p>
                      <p className="font-mono text-midnight-200">
                        {formatCurrency(asset.costBasis / asset.quantity)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-midnight-400 mb-1">Allocation</p>
                      <p className="font-mono text-midnight-200">{asset.allocation.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-midnight-700/50 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-midnight-400 mb-1">Current Value</p>
                      <p className="text-lg font-semibold text-white">{formatCurrency(asset.currentValue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-midnight-400 mb-1">Return</p>
                      <div className={`flex items-center gap-1 ${isPositive ? 'text-gain' : 'text-loss'}`}>
                        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span className="font-mono font-semibold">{formatPercent(asset.gainLossPercent)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {filteredAssets.length === 0 && (
              <div className="col-span-full glass-card p-12 text-center">
                <Info className="w-12 h-12 text-midnight-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No assets found</h3>
                <p className="text-midnight-400">
                  {searchQuery || filterType !== 'ALL'
                    ? 'Try adjusting your filters'
                    : 'Add your first transaction to see your portfolio'}
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="retirement"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {filteredRetirementAccounts.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Account List */}
                <div className="lg:col-span-1 space-y-3">
                  {filteredRetirementAccounts.map((account, index) => (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedAccount(account)}
                      className={`glass-card p-4 cursor-pointer transition-all ${
                        selectedAccount?.id === account.id 
                          ? 'border-violet-500/50 bg-violet-500/5' 
                          : 'hover:border-midnight-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-violet-400">
                              {(account.accountTypeLabel || account.account_type)?.slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-medium text-white text-sm">{account.accountName || account.account_name}</h4>
                            <p className="text-xs text-midnight-400">{account.accountTypeLabel || account.account_type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-white">{formatCurrency(account.currentValue || account.current_value || 0)}</p>
                          <ChevronRight className="w-4 h-4 text-midnight-400 ml-auto" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Account Details */}
                <div className="lg:col-span-2">
                  {selectedAccount ? (
                    <motion.div
                      key={selectedAccount.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="glass-card p-6"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center">
                            <Building2 className="w-7 h-7 text-violet-400" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-white">{selectedAccount.accountName || selectedAccount.account_name}</h3>
                            <p className="text-midnight-400">
                              {selectedAccount.accountTypeLabel || selectedAccount.account_type}
                              {(selectedAccount.employerName || selectedAccount.employer_name) && ` · ${selectedAccount.employerName || selectedAccount.employer_name}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditAccount(selectedAccount)}
                            className="btn-secondary p-2"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(selectedAccount.id)}
                            className="p-2 rounded-lg border border-loss/30 text-loss hover:bg-loss/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Account Stats */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 bg-midnight-800/50 rounded-xl">
                          <p className="text-xs text-midnight-400 mb-1">Current Value</p>
                          <p className="text-xl font-semibold text-white">{formatCurrency(selectedAccount.currentValue || selectedAccount.current_value || 0)}</p>
                        </div>
                        <div className="p-4 bg-midnight-800/50 rounded-xl">
                          <p className="text-xs text-midnight-400 mb-1">Estimated CAGR</p>
                          <p className="text-xl font-semibold text-accent-400">{selectedAccount.estimatedCagr || selectedAccount.estimated_cagr || 7}%</p>
                        </div>
                        <div className="p-4 bg-midnight-800/50 rounded-xl">
                          <p className="text-xs text-midnight-400 mb-1">Monthly Contribution</p>
                          <p className="text-xl font-semibold text-gain">{formatCurrency(selectedAccount.monthlyContribution || 0)}</p>
                        </div>
                        <div className="p-4 bg-midnight-800/50 rounded-xl">
                          <p className="text-xs text-midnight-400 mb-1">Yearly Contribution</p>
                          <p className="text-xl font-semibold text-gain">{formatCurrency(selectedAccount.yearlyContribution || 0)}</p>
                        </div>
                      </div>

                      {/* Projections */}
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-midnight-300 mb-3">Projected Growth</h4>
                        <div className="grid grid-cols-3 gap-4">
                          {[5, 10, 20].map(years => {
                            const cagr = (selectedAccount.estimatedCagr || selectedAccount.estimated_cagr || 7) / 100;
                            const currentVal = selectedAccount.currentValue || selectedAccount.current_value || 0;
                            const yearlyContrib = selectedAccount.yearlyContribution || 0;
                            const futureValue = currentVal * Math.pow(1 + cagr, years) + 
                              (yearlyContrib > 0 ? yearlyContrib * ((Math.pow(1 + cagr, years) - 1) / cagr) : 0);
                            return (
                              <div key={years} className="p-4 bg-gradient-to-br from-violet-500/10 to-purple-600/10 rounded-xl border border-violet-500/20">
                                <p className="text-xs text-midnight-400 mb-1">{years} Years</p>
                                <p className="text-lg font-semibold text-violet-400">{formatCurrency(futureValue)}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Contributions */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-midnight-300">Contributions</h4>
                          <button
                            onClick={() => setShowContributionModal(selectedAccount.id)}
                            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Contribution
                          </button>
                        </div>
                        {selectedAccount.contributions && selectedAccount.contributions.length > 0 ? (
                          <div className="space-y-2">
                            {selectedAccount.contributions.map((contrib) => (
                              <div 
                                key={contrib.id}
                                className="flex items-center justify-between p-4 bg-midnight-800/30 rounded-xl"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    (contrib.contributionType || contrib.contribution_type) === 'PERSONAL' 
                                      ? 'bg-accent-500/10' 
                                      : 'bg-gain/10'
                                  }`}>
                                    <DollarSign className={`w-5 h-5 ${
                                      (contrib.contributionType || contrib.contribution_type) === 'PERSONAL' 
                                        ? 'text-accent-400' 
                                        : 'text-gain'
                                    }`} />
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">
                                      {formatCurrency(contrib.amount)} / {(contrib.frequency || '').toLowerCase().replace('_', '-')}
                                    </p>
                                    <p className="text-xs text-midnight-400">
                                      {(contrib.contributionType || contrib.contribution_type) === 'PERSONAL' ? 'Personal Contribution' : 
                                       (contrib.contributionType || contrib.contribution_type) === 'EMPLOYER_MATCH' ? 'Employer Match' : 'Employer Contribution'}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteContribution(contrib.id)}
                                  className="p-2 rounded-lg hover:bg-loss/10 text-midnight-400 hover:text-loss transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-midnight-800/30 rounded-xl">
                            <p className="text-midnight-500">No contributions set up yet</p>
                            <button
                              onClick={() => setShowContributionModal(selectedAccount.id)}
                              className="text-sm text-violet-400 hover:text-violet-300 mt-2"
                            >
                              Add your first contribution
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="glass-card p-12 text-center h-full flex flex-col items-center justify-center">
                      <Building2 className="w-16 h-16 text-midnight-600 mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">Select an account</h3>
                      <p className="text-midnight-400">Click on an account to view details and manage contributions</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-card p-12 text-center">
                <Building2 className="w-16 h-16 text-midnight-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No retirement accounts</h3>
                <p className="text-midnight-400 mb-4">
                  {searchQuery ? 'No accounts match your search' : 'Add your first retirement account to start tracking'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => {
                      setEditingAccount(null);
                      resetAccountForm();
                      setShowAccountModal(true);
                    }}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Retirement Account
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account Modal */}
      <AnimatePresence>
        {showAccountModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAccountModal(false)}
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
                  onClick={() => setShowAccountModal(false)}
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
                    onClick={() => setShowAccountModal(false)}
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
    </div>
  );
}
