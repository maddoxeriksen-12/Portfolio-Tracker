import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, DollarSign, Calendar, Repeat, Trash2, X, Loader2 } from 'lucide-react';
import usePortfolioStore from '../store/portfolioStore';
import api from '../services/api';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
};

const frequencyLabels = {
  ONE_TIME: 'One-time',
  WEEKLY: 'Weekly',
  BI_WEEKLY: 'Bi-weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUALLY: 'Annually'
};

export default function Income() {
  const { income, fetchIncome, createIncome, deleteIncome } = usePortfolioStore();
  const [showModal, setShowModal] = useState(false);
  const [summary, setSummary] = useState(null);
  const [formData, setFormData] = useState({
    source: '',
    grossAmount: '',
    taxRate: '25',
    frequency: 'MONTHLY',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchIncome();
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const response = await api.get('/income/summary');
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Failed to load income summary');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const result = await createIncome({
      ...formData,
      grossAmount: parseFloat(formData.grossAmount),
      taxRate: parseFloat(formData.taxRate),
      endDate: formData.endDate || null
    });

    setSubmitting(false);

    if (result.success) {
      setShowModal(false);
      setFormData({
        source: '',
        grossAmount: '',
        taxRate: '25',
        frequency: 'MONTHLY',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        notes: ''
      });
      loadSummary();
    } else {
      setFormError(result.error);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this income record?')) {
      await deleteIncome(id);
      loadSummary();
    }
  };

  const calculatedNet = formData.grossAmount 
    ? parseFloat(formData.grossAmount) * (1 - parseFloat(formData.taxRate || 0) / 100)
    : 0;

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Income</h1>
          <p className="text-midnight-400 mt-1">Track your income before and after taxes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Income
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Annual Gross</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">
            {formatCurrency(summary?.annualGrossIncome || 0)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Annual Net</span>
          </div>
          <p className="text-2xl font-display font-bold text-gain">
            {formatCurrency(summary?.annualNetIncome || 0)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Monthly Net</span>
          </div>
          <p className="text-2xl font-display font-bold text-accent-400">
            {formatCurrency(summary?.monthlyNetIncome || 0)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Effective Tax Rate</span>
          </div>
          <p className="text-2xl font-display font-bold text-warning">
            {(summary?.effectiveTaxRate || 0).toFixed(1)}%
          </p>
        </motion.div>
      </div>

      {/* Income Records */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-midnight-800/50">
          <h3 className="text-lg font-display font-semibold text-white">Income Sources</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-midnight-800/50">
                <th className="table-header px-6 py-4">Source</th>
                <th className="table-header px-6 py-4">Frequency</th>
                <th className="table-header px-6 py-4 text-right">Gross</th>
                <th className="table-header px-6 py-4 text-right">Tax Rate</th>
                <th className="table-header px-6 py-4 text-right">Net</th>
                <th className="table-header px-6 py-4">Period</th>
                <th className="table-header px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {income?.map((record, index) => (
                <motion.tr
                  key={record.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-midnight-800/30 transition-colors"
                >
                  <td className="table-cell px-6">
                    <div>
                      <p className="font-medium text-white">{record.source}</p>
                      {record.notes && (
                        <p className="text-xs text-midnight-400 truncate max-w-xs">{record.notes}</p>
                      )}
                    </div>
                  </td>
                  <td className="table-cell px-6">
                    <span className="badge bg-accent-500/10 text-accent-400">
                      <Repeat className="w-3 h-3 mr-1" />
                      {frequencyLabels[record.frequency]}
                    </span>
                  </td>
                  <td className="table-cell px-6 text-right font-mono text-midnight-200">
                    {formatCurrency(record.grossAmount)}
                  </td>
                  <td className="table-cell px-6 text-right font-mono text-warning">
                    {record.taxRate}%
                  </td>
                  <td className="table-cell px-6 text-right font-mono font-medium text-gain">
                    {formatCurrency(record.netAmount)}
                  </td>
                  <td className="table-cell px-6 text-midnight-300 text-sm">
                    {new Date(record.startDate).toLocaleDateString()}
                    {record.endDate && ` - ${new Date(record.endDate).toLocaleDateString()}`}
                  </td>
                  <td className="table-cell px-6 text-right">
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="p-2 rounded-lg text-midnight-400 hover:text-loss hover:bg-loss/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
              {(!income || income.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-midnight-400">
                    No income records yet. Add your first income source to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Income Modal */}
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
                <h2 className="text-xl font-display font-bold text-white">Add Income Source</h2>
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

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-midnight-300">Source Name</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Salary, Freelance, etc."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Gross Amount</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.grossAmount}
                      onChange={(e) => setFormData({ ...formData, grossAmount: e.target.value })}
                      className="input-field"
                      placeholder="5000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.taxRate}
                      onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                      className="input-field"
                      placeholder="25"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-midnight-300">Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="input-field"
                  >
                    {Object.entries(frequencyLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">End Date (optional)</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="input-field"
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

                {/* Net Preview */}
                {formData.grossAmount && (
                  <div className="p-4 bg-midnight-800/50 rounded-xl">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-midnight-400">Gross Amount</span>
                      <span className="font-mono text-white">{formatCurrency(parseFloat(formData.grossAmount))}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-midnight-400">Tax ({formData.taxRate}%)</span>
                      <span className="font-mono text-loss">
                        -{formatCurrency(parseFloat(formData.grossAmount) * parseFloat(formData.taxRate || 0) / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-midnight-700/50">
                      <span className="text-white font-medium">Net Amount</span>
                      <span className="font-mono font-semibold text-gain">{formatCurrency(calculatedNet)}</span>
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
                      Add Income Source
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
