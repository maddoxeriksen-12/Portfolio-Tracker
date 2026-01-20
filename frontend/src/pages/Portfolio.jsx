import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, TrendingUp, TrendingDown, Info } from 'lucide-react';
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

export default function Portfolio() {
  const { assets, fetchOverview, isLoading } = usePortfolioStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [sortBy, setSortBy] = useState('value');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchOverview();
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

  const totalValue = assets?.reduce((sum, a) => sum + a.currentValue, 0) || 0;
  const totalCost = assets?.reduce((sum, a) => sum + a.costBasis, 0) || 0;
  const totalReturn = totalValue - totalCost;
  const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Portfolio</h1>
        <p className="text-midnight-400 mt-1">Detailed view of your holdings</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-midnight-400 mb-1">Total Value</p>
          <p className="text-2xl font-display font-bold text-white">{formatCurrency(totalValue)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-midnight-400 mb-1">Cost Basis</p>
          <p className="text-2xl font-display font-bold text-white">{formatCurrency(totalCost)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-midnight-400 mb-1">Total Return</p>
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className="input-field pl-12"
          />
        </div>
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
      </div>

      {/* Asset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
      </div>

      {filteredAssets.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Info className="w-12 h-12 text-midnight-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No assets found</h3>
          <p className="text-midnight-400">
            {searchQuery || filterType !== 'ALL'
              ? 'Try adjusting your filters'
              : 'Add your first transaction to see your portfolio'}
          </p>
        </div>
      )}
    </div>
  );
}
