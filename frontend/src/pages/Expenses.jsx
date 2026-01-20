import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CreditCard, Calendar, Trash2, X, Loader2, ChevronDown, PieChart } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import usePortfolioStore from '../store/portfolioStore';
import api from '../services/api';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Expenses() {
  const { expenses, fetchExpenses, createExpense, deleteExpense } = usePortfolioStore();
  const [showModal, setShowModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeView, setActiveView] = useState('list');
  const [formData, setFormData] = useState({
    categoryId: '',
    description: '',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    isRecurring: false,
    recurringFrequency: 'MONTHLY',
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCategories();
    loadMonthlyBreakdown();
  }, [selectedYear]);

  useEffect(() => {
    fetchExpenses({ month: selectedMonth, year: selectedYear });
  }, [selectedMonth, selectedYear]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/expenses/categories');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Failed to load categories');
    }
  };

  const loadMonthlyBreakdown = async () => {
    try {
      const response = await api.get(`/expenses/monthly?year=${selectedYear}`);
      setMonthlyData(response.data.breakdown);
    } catch (error) {
      console.error('Failed to load monthly breakdown');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const result = await createExpense({
      ...formData,
      amount: parseFloat(formData.amount),
      categoryId: formData.categoryId || null
    });

    setSubmitting(false);

    if (result.success) {
      setShowModal(false);
      setFormData({
        categoryId: '',
        description: '',
        amount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        isRecurring: false,
        recurringFrequency: 'MONTHLY',
        notes: ''
      });
      loadMonthlyBreakdown();
    } else {
      setFormError(result.error);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      await deleteExpense(id);
      loadMonthlyBreakdown();
    }
  };

  const currentMonthData = monthlyData.find(m => m.month === selectedMonth) || { categories: [], total: 0 };
  const yearTotal = monthlyData.reduce((sum, m) => sum + m.total, 0);

  // Chart data
  const barData = monthlyData.map(m => ({
    month: months[m.month - 1],
    total: m.total
  }));

  const pieData = currentMonthData.categories.map(c => ({
    name: c.name,
    value: c.amount,
    color: c.color
  }));

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Expenses</h1>
          <p className="text-midnight-400 mt-1">Track your spending month by month</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {/* Date Selector */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="input-field pl-12 pr-10 w-auto appearance-none"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400 pointer-events-none" />
        </div>
        <div className="flex gap-1 p-1 bg-midnight-800/50 rounded-xl overflow-x-auto">
          {months.map((month, index) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(index + 1)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                selectedMonth === index + 1
                  ? 'bg-accent-500 text-white'
                  : 'text-midnight-400 hover:text-midnight-200'
              }`}
            >
              {month}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <CreditCard className="w-4 h-4" />
            <span className="text-sm">{months[selectedMonth - 1]} Expenses</span>
          </div>
          <p className="text-2xl font-display font-bold text-loss">
            {formatCurrency(currentMonthData.total)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{selectedYear} Total</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">
            {formatCurrency(yearTotal)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 text-midnight-400 mb-2">
            <PieChart className="w-4 h-4" />
            <span className="text-sm">Monthly Average</span>
          </div>
          <p className="text-2xl font-display font-bold text-accent-400">
            {formatCurrency(yearTotal / 12)}
          </p>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-display font-semibold text-white mb-4">Monthly Spending</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis 
                  dataKey="month" 
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
                  formatter={(value) => [formatCurrency(value), 'Expenses']}
                />
                <Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Category Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-display font-semibold text-white mb-4">
            {months[selectedMonth - 1]} Breakdown
          </h3>
          {pieData.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
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
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-midnight-300">{item.name}</span>
                    </div>
                    <span className="text-sm font-mono text-midnight-200">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-midnight-400">
              No expenses this month
            </div>
          )}
        </motion.div>
      </div>

      {/* Expenses Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-midnight-800/50">
          <h3 className="text-lg font-display font-semibold text-white">
            {months[selectedMonth - 1]} {selectedYear} Expenses
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-midnight-800/50">
                <th className="table-header px-6 py-4">Date</th>
                <th className="table-header px-6 py-4">Description</th>
                <th className="table-header px-6 py-4">Category</th>
                <th className="table-header px-6 py-4 text-right">Amount</th>
                <th className="table-header px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses?.map((expense, index) => (
                <motion.tr
                  key={expense.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-midnight-800/30 transition-colors"
                >
                  <td className="table-cell px-6 text-midnight-300">
                    {new Date(expense.expenseDate).toLocaleDateString()}
                  </td>
                  <td className="table-cell px-6">
                    <div>
                      <p className="font-medium text-white">{expense.description}</p>
                      {expense.notes && (
                        <p className="text-xs text-midnight-400 truncate max-w-xs">{expense.notes}</p>
                      )}
                    </div>
                  </td>
                  <td className="table-cell px-6">
                    <span 
                      className="badge"
                      style={{ 
                        backgroundColor: `${expense.categoryColor}20`, 
                        color: expense.categoryColor 
                      }}
                    >
                      {expense.categoryName}
                    </span>
                  </td>
                  <td className="table-cell px-6 text-right font-mono font-medium text-loss">
                    -{formatCurrency(expense.amount)}
                  </td>
                  <td className="table-cell px-6 text-right">
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="p-2 rounded-lg text-midnight-400 hover:text-loss hover:bg-loss/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
              {(!expenses || expenses.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-midnight-400">
                    No expenses for {months[selectedMonth - 1]} {selectedYear}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg glass-card-elevated z-50 overflow-auto max-h-[90vh]"
            >
              <div className="p-6 border-b border-midnight-700/50 flex items-center justify-between">
                <h2 className="text-xl font-display font-bold text-white">Add Expense</h2>
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
                  <label className="block text-sm font-medium text-midnight-300">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Grocery shopping"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Amount</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="input-field"
                      placeholder="50.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-midnight-300">Date</label>
                    <input
                      type="date"
                      value={formData.expenseDate}
                      onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-midnight-300">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
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
                      Add Expense
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
