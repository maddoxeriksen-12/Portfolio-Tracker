import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  X,
  Loader2,
  Calendar
} from 'lucide-react';
import usePortfolioStore from '../store/portfolioStore';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
};

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export default function Transactions() {
  const { transactions, fetchTransactions, createTransaction, deleteTransaction, isLoading } = usePortfolioStore();
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAssetType, setFilterAssetType] = useState('');
  const [formData, setFormData] = useState({
    symbol: '',
    assetType: 'STOCK',
    transactionType: 'BUY',
    quantity: '',
    pricePerUnit: '',
    fees: '0',
    transactionDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const result = await createTransaction({
      ...formData,
      quantity: parseFloat(formData.quantity),
      pricePerUnit: parseFloat(formData.pricePerUnit),
      fees: parseFloat(formData.fees || 0)
    });

    setSubmitting(false);

    if (result.success) {
      setShowModal(false);
      setFormData({
        symbol: '',
        assetType: 'STOCK',
        transactionType: 'BUY',
        quantity: '',
        pricePerUnit: '',
        fees: '0',
        transactionDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } else {
      setFormError(result.error);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      await deleteTransaction(id);
    }
  };

  const filteredTransactions = transactions?.filter(tx => {
    const matchesSearch = tx.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || tx.transactionType === filterType;
    const matchesAssetType = !filterAssetType || tx.assetType === filterAssetType;
    return matchesSearch && matchesType && matchesAssetType;
  }) || [];

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Transactions</h1>
          <p className="text-midnight-400 mt-1">Record and track your buys and sells</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Transaction
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
            placeholder="Search by symbol..."
            className="input-field pl-12"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Types</option>
          <option value="BUY">Buys</option>
          <option value="SELL">Sells</option>
        </select>
        <select
          value={filterAssetType}
          onChange={(e) => setFilterAssetType(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Assets</option>
          <option value="STOCK">Stocks</option>
          <option value="CRYPTO">Crypto</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-midnight-800/50">
                <th className="table-header px-6 py-4">Date</th>
                <th className="table-header px-6 py-4">Type</th>
                <th className="table-header px-6 py-4">Asset</th>
                <th className="table-header px-6 py-4 text-right">Quantity</th>
                <th className="table-header px-6 py-4 text-right">Price</th>
                <th className="table-header px-6 py-4 text-right">Total</th>
                <th className="table-header px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx, index) => (
                <motion.tr
                  key={tx.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-midnight-800/30 transition-colors"
                >
                  <td className="table-cell px-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-midnight-400" />
                      <span className="text-midnight-200">{formatDate(tx.transactionDate)}</span>
                    </div>
                  </td>
                  <td className="table-cell px-6">
                    <div className={`flex items-center gap-2 ${tx.transactionType === 'BUY' ? 'text-gain' : 'text-loss'}`}>
                      {tx.transactionType === 'BUY' ? (
                        <ArrowDownCircle className="w-5 h-5" />
                      ) : (
                        <ArrowUpCircle className="w-5 h-5" />
                      )}
                      <span className="font-medium">{tx.transactionType}</span>
                    </div>
                  </td>
                  <td className="table-cell px-6">
                    <div>
                      <p className="font-medium text-white">{tx.symbol}</p>
                      <p className="text-xs text-midnight-400">{tx.assetType}</p>
                    </div>
                  </td>
                  <td className="table-cell px-6 text-right font-mono text-midnight-200">
                    {tx.quantity.toFixed(tx.assetType === 'CRYPTO' ? 6 : 2)}
                  </td>
                  <td className="table-cell px-6 text-right font-mono text-midnight-200">
                    {formatCurrency(tx.pricePerUnit)}
                  </td>
                  <td className="table-cell px-6 text-right font-mono font-medium text-white">
                    {formatCurrency(tx.totalAmount)}
                  </td>
                  <td className="table-cell px-6 text-right">
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-2 rounded-lg text-midnight-400 hover:text-loss hover:bg-loss/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-midnight-400">
                    {isLoading ? 'Loading...' : 'No transactions found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-card-elevated overflow-auto max-h-[90vh]"
            >
              <div className="p-6 border-b border-midnight-700/50 flex items-center justify-between">
                <h2 className="text-xl font-display font-bold text-white">Add Transaction</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-midnight-700/50 transition-colors"
                >
                  <X className="w-5 h-5 text-midnight-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {formError && (
                  <div className="p-4 bg-loss/10 border border-loss/20 rounded-xl text-loss text-sm">
                    {formError}
                  </div>
                )}

                {/* Transaction Type Toggle */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-midnight-800/50 rounded-xl">
                  {['BUY', 'SELL'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, transactionType: type })}
                      className={`py-3 rounded-lg font-medium transition-all ${
                        formData.transactionType === type
                          ? type === 'BUY'
                            ? 'bg-gain text-white'
                            : 'bg-loss text-white'
                          : 'text-midnight-400 hover:text-midnight-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Symbol</label>
                    <input
                      type="text"
                      value={formData.symbol}
                      onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                      className="input-field"
                      placeholder="AAPL"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Asset Type</label>
                    <select
                      value={formData.assetType}
                      onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                      className="input-field"
                    >
                      <option value="STOCK">Stock</option>
                      <option value="CRYPTO">Crypto</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Quantity</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="input-field"
                      placeholder="10"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Price per unit</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.pricePerUnit}
                      onChange={(e) => setFormData({ ...formData, pricePerUnit: e.target.value })}
                      className="input-field"
                      placeholder="150.00"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Date</label>
                    <input
                      type="date"
                      value={formData.transactionDate}
                      onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Fees</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.fees}
                      onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                      className="input-field"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-midnight-300">Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input-field resize-none"
                    rows={2}
                    placeholder="Add any notes..."
                  />
                </div>

                {/* Total Preview */}
                {formData.quantity && formData.pricePerUnit && (
                  <div className="p-4 bg-midnight-800/50 rounded-xl">
                    <div className="flex justify-between text-sm">
                      <span className="text-midnight-400">Total Amount</span>
                      <span className="font-mono font-semibold text-white">
                        {formatCurrency(
                          parseFloat(formData.quantity) * parseFloat(formData.pricePerUnit) +
                          parseFloat(formData.fees || 0)
                        )}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add {formData.transactionType === 'BUY' ? 'Buy' : 'Sell'} Transaction
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
