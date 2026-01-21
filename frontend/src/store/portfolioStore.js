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
  retirementAccounts: [],
  retirementSummary: null,
  
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

  // Refresh all asset prices (triggers API calls to get latest data)
  refreshPrices: async () => {
    set({ isLoading: true });
    try {
      // First trigger the refresh endpoint to fetch fresh prices from API
      await api.post('/portfolio/refresh');
      
      // Then fetch the updated overview with the new prices
      const response = await api.get('/portfolio/overview?refresh=true');
      set({ 
        overview: response.data.overview, 
        assets: response.data.assets,
        isLoading: false 
      });
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to refresh prices', isLoading: false });
      return { success: false, error: error.response?.data?.error };
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
  // yearlyContributions: object mapping calendar year to monthly contribution
  // e.g., { 2026: 500, 2027: 750 }
  fetchProjections: async (years = 10, yearlyContributions = {}) => {
    try {
      const contributionsParam = encodeURIComponent(JSON.stringify(yearlyContributions));
      const response = await api.get(`/portfolio/projections?years=${years}&yearlyContributions=${contributionsParam}`);
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

  // Retirement Accounts
  fetchRetirementAccounts: async () => {
    try {
      const response = await api.get('/retirement');
      set({ 
        retirementAccounts: response.data.accounts,
        retirementSummary: response.data.summary
      });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch retirement accounts' });
    }
  },

  createRetirementAccount: async (accountData) => {
    try {
      const response = await api.post('/retirement', accountData);
      await get().fetchRetirementAccounts();
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to create account' };
    }
  },

  updateRetirementAccount: async (id, accountData) => {
    try {
      const response = await api.put(`/retirement/${id}`, accountData);
      await get().fetchRetirementAccounts();
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to update account' };
    }
  },

  deleteRetirementAccount: async (id) => {
    try {
      await api.delete(`/retirement/${id}`);
      await get().fetchRetirementAccounts();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to delete account' };
    }
  },

  addRetirementContribution: async (accountId, contributionData) => {
    try {
      const response = await api.post(`/retirement/${accountId}/contributions`, contributionData);
      await get().fetchRetirementAccounts();
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to add contribution' };
    }
  },

  updateRetirementContribution: async (contributionId, contributionData) => {
    try {
      const response = await api.put(`/retirement/contributions/${contributionId}`, contributionData);
      await get().fetchRetirementAccounts();
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to update contribution' };
    }
  },

  deleteRetirementContribution: async (contributionId) => {
    try {
      await api.delete(`/retirement/contributions/${contributionId}`);
      await get().fetchRetirementAccounts();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to delete contribution' };
    }
  },

  fetchRetirementProjections: async (years = 30) => {
    try {
      const response = await api.get(`/retirement/projections?years=${years}`);
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch retirement projections' });
    }
  },

  clearError: () => set({ error: null })
}));

export default usePortfolioStore;
