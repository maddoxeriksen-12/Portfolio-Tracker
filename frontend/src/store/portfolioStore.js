import { create } from 'zustand';
import api from '../services/api';

const usePortfolioStore = create((set, get) => ({
  // Portfolio data
  overview: null,
  assets: [],
  transactions: [],
  taxSummary: null,
  costBasis: null,
  income: [],
  expenses: [],
  projections: null,
  
  // UI state
  isLoading: false,
  error: null,

  // Fetch portfolio overview
  fetchOverview: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/portfolio/overview');
      set({ 
        overview: response.data.overview, 
        assets: response.data.assets,
        isLoading: false 
      });
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch portfolio', isLoading: false });
    }
  },

  // Fetch transactions
  fetchTransactions: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/transactions?${params}`);
      set({ transactions: response.data.transactions, isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch transactions', isLoading: false });
    }
  },

  // Create transaction
  createTransaction: async (transaction) => {
    try {
      const response = await api.post('/transactions', transaction);
      await get().fetchOverview();
      await get().fetchTransactions();
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Transaction failed' };
    }
  },

  // Delete transaction
  deleteTransaction: async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      await get().fetchOverview();
      await get().fetchTransactions();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Delete failed' };
    }
  },

  // Fetch tax summary
  fetchTaxSummary: async (year) => {
    set({ isLoading: true });
    try {
      const response = await api.get(`/tax/summary/${year || ''}`);
      set({ taxSummary: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch tax summary', isLoading: false });
    }
  },

  // Fetch cost basis
  fetchCostBasis: async () => {
    try {
      const response = await api.get('/tax/cost-basis');
      set({ costBasis: response.data });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch cost basis' });
    }
  },

  // Fetch income records
  fetchIncome: async () => {
    try {
      const response = await api.get('/income');
      set({ income: response.data.incomeRecords });
      return response.data.incomeRecords;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch income' });
    }
  },

  // Create income record
  createIncome: async (incomeData) => {
    try {
      const response = await api.post('/income', incomeData);
      await get().fetchIncome();
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to create income' };
    }
  },

  // Delete income record
  deleteIncome: async (id) => {
    try {
      await api.delete(`/income/${id}`);
      await get().fetchIncome();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to delete income' };
    }
  },

  // Fetch expenses
  fetchExpenses: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/expenses?${params}`);
      set({ expenses: response.data.expenses });
      return response.data.expenses;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch expenses' });
    }
  },

  // Create expense
  createExpense: async (expenseData) => {
    try {
      const response = await api.post('/expenses', expenseData);
      await get().fetchExpenses();
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to create expense' };
    }
  },

  // Delete expense
  deleteExpense: async (id) => {
    try {
      await api.delete(`/expenses/${id}`);
      await get().fetchExpenses();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to delete expense' };
    }
  },

  // Fetch projections
  fetchProjections: async (years = 10, monthlyContribution = 0) => {
    try {
      const response = await api.get(`/portfolio/projections?years=${years}&monthlyContribution=${monthlyContribution}`);
      set({ projections: response.data });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch projections' });
    }
  },

  // Set asset CAGR
  setAssetCAGR: async (assetId, estimatedCAGR, notes) => {
    try {
      await api.post(`/portfolio/projections/cagr/${assetId}`, { estimatedCAGR, notes });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to set CAGR' };
    }
  },

  // Get returns
  fetchReturns: async (timeframe = '1Y') => {
    try {
      const response = await api.get(`/portfolio/returns?timeframe=${timeframe}`);
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch returns' });
    }
  },

  clearError: () => set({ error: null })
}));

export default usePortfolioStore;
