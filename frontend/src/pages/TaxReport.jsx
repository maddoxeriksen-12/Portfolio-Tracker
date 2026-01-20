import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, TrendingDown, FileText, Download, ChevronDown } from 'lucide-react';
import usePortfolioStore from '../store/portfolioStore';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
};

export default function TaxReport() {
  const { taxSummary, costBasis, fetchTaxSummary, fetchCostBasis, isLoading } = usePortfolioStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('summary');

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    fetchTaxSummary(selectedYear);
    fetchCostBasis();
  }, [selectedYear]);

  const tabs = [
    { id: 'summary', label: 'Tax Summary' },
    { id: 'costBasis', label: 'Cost Basis' },
    { id: 'byAsset', label: 'By Asset' }
  ];

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Tax Report</h1>
          <p className="text-midnight-400 mt-1">Capital gains and cost basis tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="input-field pl-12 pr-10 w-auto appearance-none"
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Short-Term Gains</span>
          </div>
          <p className={`text-2xl font-display font-bold ${
            (taxSummary?.netShortTerm || 0) >= 0 ? 'text-gain' : 'text-loss'
          }`}>
            {formatCurrency(taxSummary?.netShortTerm || 0)}
          </p>
          <p className="text-xs text-midnight-400 mt-1">Held &lt; 1 year</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Long-Term Gains</span>
          </div>
          <p className={`text-2xl font-display font-bold ${
            (taxSummary?.netLongTerm || 0) >= 0 ? 'text-gain' : 'text-loss'
          }`}>
            {formatCurrency(taxSummary?.netLongTerm || 0)}
          </p>
          <p className="text-xs text-midnight-400 mt-1">Held ≥ 1 year</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <FileText className="w-4 h-4" />
            <span className="text-sm">Total Net Gain</span>
          </div>
          <p className={`text-2xl font-display font-bold ${
            (taxSummary?.totalNetGain || 0) >= 0 ? 'text-gain' : 'text-loss'
          }`}>
            {formatCurrency(taxSummary?.totalNetGain || 0)}
          </p>
          <p className="text-xs text-midnight-400 mt-1">For tax year {selectedYear}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm">Total Cost Basis</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">
            {formatCurrency((costBasis?.totalStockCostBasis || 0) + (costBasis?.totalCryptoCostBasis || 0))}
          </p>
          <p className="text-xs text-midnight-400 mt-1">Current holdings</p>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-midnight-800/50 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-accent-500 text-white'
                : 'text-midnight-400 hover:text-midnight-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Short-Term Breakdown */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-display font-semibold text-white mb-4">Short-Term Capital Gains</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-midnight-700/50">
                <span className="text-midnight-300">Total Gains</span>
                <span className="font-mono text-gain">{formatCurrency(taxSummary?.shortTermGains || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-midnight-700/50">
                <span className="text-midnight-300">Total Losses</span>
                <span className="font-mono text-loss">-{formatCurrency(taxSummary?.shortTermLosses || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-white font-medium">Net Short-Term</span>
                <span className={`font-mono font-bold text-lg ${
                  (taxSummary?.netShortTerm || 0) >= 0 ? 'text-gain' : 'text-loss'
                }`}>
                  {formatCurrency(taxSummary?.netShortTerm || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Long-Term Breakdown */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-display font-semibold text-white mb-4">Long-Term Capital Gains</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-midnight-700/50">
                <span className="text-midnight-300">Total Gains</span>
                <span className="font-mono text-gain">{formatCurrency(taxSummary?.longTermGains || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-midnight-700/50">
                <span className="text-midnight-300">Total Losses</span>
                <span className="font-mono text-loss">-{formatCurrency(taxSummary?.longTermLosses || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-white font-medium">Net Long-Term</span>
                <span className={`font-mono font-bold text-lg ${
                  (taxSummary?.netLongTerm || 0) >= 0 ? 'text-gain' : 'text-loss'
                }`}>
                  {formatCurrency(taxSummary?.netLongTerm || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* By Asset Type */}
          <div className="glass-card p-6 lg:col-span-2">
            <h3 className="text-lg font-display font-semibold text-white mb-4">By Asset Type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-midnight-400 mb-3">Stocks</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-midnight-300">Short-Term</span>
                    <span className="font-mono text-midnight-200">
                      {formatCurrency(taxSummary?.byType?.STOCK?.shortTerm || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-midnight-300">Long-Term</span>
                    <span className="font-mono text-midnight-200">
                      {formatCurrency(taxSummary?.byType?.STOCK?.longTerm || 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-midnight-400 mb-3">Crypto</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-midnight-300">Short-Term</span>
                    <span className="font-mono text-midnight-200">
                      {formatCurrency(taxSummary?.byType?.CRYPTO?.shortTerm || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-midnight-300">Long-Term</span>
                    <span className="font-mono text-midnight-200">
                      {formatCurrency(taxSummary?.byType?.CRYPTO?.longTerm || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'costBasis' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Stocks */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-midnight-800/50 flex items-center justify-between">
              <h3 className="text-lg font-display font-semibold text-white">Stock Cost Basis</h3>
              <span className="text-lg font-mono font-bold text-accent-400">
                {formatCurrency(costBasis?.totalStockCostBasis || 0)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-midnight-800/50">
                    <th className="table-header px-6 py-4">Symbol</th>
                    <th className="table-header px-6 py-4">Purchase Date</th>
                    <th className="table-header px-6 py-4 text-right">Original Qty</th>
                    <th className="table-header px-6 py-4 text-right">Remaining</th>
                    <th className="table-header px-6 py-4 text-right">Cost/Unit</th>
                    <th className="table-header px-6 py-4 text-right">Total Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {costBasis?.byStock?.map((lot, i) => (
                    <tr key={i} className="hover:bg-midnight-800/30 transition-colors">
                      <td className="table-cell px-6 font-medium text-white">{lot.symbol}</td>
                      <td className="table-cell px-6 text-midnight-300">
                        {new Date(lot.purchaseDate).toLocaleDateString()}
                      </td>
                      <td className="table-cell px-6 text-right font-mono text-midnight-300">
                        {lot.originalQuantity.toFixed(2)}
                      </td>
                      <td className="table-cell px-6 text-right font-mono text-midnight-200">
                        {lot.remainingQuantity.toFixed(2)}
                      </td>
                      <td className="table-cell px-6 text-right font-mono text-midnight-200">
                        {formatCurrency(lot.costBasisPerUnit)}
                      </td>
                      <td className="table-cell px-6 text-right font-mono font-medium text-white">
                        {formatCurrency(lot.totalCostBasis)}
                      </td>
                    </tr>
                  ))}
                  {(!costBasis?.byStock || costBasis.byStock.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-midnight-400">
                        No stock holdings
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Crypto */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-midnight-800/50 flex items-center justify-between">
              <h3 className="text-lg font-display font-semibold text-white">Crypto Cost Basis</h3>
              <span className="text-lg font-mono font-bold text-warning">
                {formatCurrency(costBasis?.totalCryptoCostBasis || 0)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-midnight-800/50">
                    <th className="table-header px-6 py-4">Symbol</th>
                    <th className="table-header px-6 py-4">Purchase Date</th>
                    <th className="table-header px-6 py-4 text-right">Original Qty</th>
                    <th className="table-header px-6 py-4 text-right">Remaining</th>
                    <th className="table-header px-6 py-4 text-right">Cost/Unit</th>
                    <th className="table-header px-6 py-4 text-right">Total Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {costBasis?.byCrypto?.map((lot, i) => (
                    <tr key={i} className="hover:bg-midnight-800/30 transition-colors">
                      <td className="table-cell px-6 font-medium text-white">{lot.symbol}</td>
                      <td className="table-cell px-6 text-midnight-300">
                        {new Date(lot.purchaseDate).toLocaleDateString()}
                      </td>
                      <td className="table-cell px-6 text-right font-mono text-midnight-300">
                        {lot.originalQuantity.toFixed(6)}
                      </td>
                      <td className="table-cell px-6 text-right font-mono text-midnight-200">
                        {lot.remainingQuantity.toFixed(6)}
                      </td>
                      <td className="table-cell px-6 text-right font-mono text-midnight-200">
                        {formatCurrency(lot.costBasisPerUnit)}
                      </td>
                      <td className="table-cell px-6 text-right font-mono font-medium text-white">
                        {formatCurrency(lot.totalCostBasis)}
                      </td>
                    </tr>
                  ))}
                  {(!costBasis?.byCrypto || costBasis.byCrypto.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-midnight-400">
                        No crypto holdings
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'byAsset' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-midnight-800/50">
                  <th className="table-header px-6 py-4">Asset</th>
                  <th className="table-header px-6 py-4">Type</th>
                  <th className="table-header px-6 py-4">Term</th>
                  <th className="table-header px-6 py-4 text-right">Quantity</th>
                  <th className="table-header px-6 py-4 text-right">Cost Basis</th>
                  <th className="table-header px-6 py-4 text-right">Proceeds</th>
                  <th className="table-header px-6 py-4 text-right">Gain/Loss</th>
                </tr>
              </thead>
              <tbody>
                {taxSummary?.byAsset?.map((item, i) => (
                  <tr key={i} className="hover:bg-midnight-800/30 transition-colors">
                    <td className="table-cell px-6 font-medium text-white">{item.symbol}</td>
                    <td className="table-cell px-6">
                      <span className={`badge ${
                        item.assetType === 'STOCK' ? 'bg-accent-500/10 text-accent-400' : 'bg-warning/10 text-warning'
                      }`}>
                        {item.assetType}
                      </span>
                    </td>
                    <td className="table-cell px-6">
                      <span className={`badge ${
                        item.isLongTerm ? 'bg-gain/10 text-gain' : 'bg-midnight-600 text-midnight-200'
                      }`}>
                        {item.isLongTerm ? 'Long-Term' : 'Short-Term'}
                      </span>
                    </td>
                    <td className="table-cell px-6 text-right font-mono text-midnight-200">
                      {item.totalQuantity.toFixed(item.assetType === 'CRYPTO' ? 6 : 2)}
                    </td>
                    <td className="table-cell px-6 text-right font-mono text-midnight-200">
                      {formatCurrency(item.costBasis)}
                    </td>
                    <td className="table-cell px-6 text-right font-mono text-midnight-200">
                      {formatCurrency(item.proceeds)}
                    </td>
                    <td className="table-cell px-6 text-right">
                      <span className={`font-mono font-medium ${item.gainLoss >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {formatCurrency(item.gainLoss)}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!taxSummary?.byAsset || taxSummary.byAsset.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-midnight-400">
                      No realized gains for {selectedYear}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
