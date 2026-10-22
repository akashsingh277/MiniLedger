
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = 'miniledger_token';

type Loan = {
  id: number | string;
  friendName: string;
  amount: number;
  dueDate: string;
  isRepaid: boolean;
};

type Summary = {
  totalLent: number;
  totalRepaid: number;
  overdueAmount: number;
};

const emptySummary: Summary = {
  totalLent: 0,
  totalRepaid: 0,
  overdueAmount: 0,
};

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

function isOverdue(loan: Loan) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !loan.isRepaid && new Date(`${loan.dueDate.slice(0, 10)}T00:00:00`) < today;
}

export default function App() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);

  const [showForm, setShowForm] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const apiRequest = async (path: string, options: RequestInit = {}) => {
    if (!API_URL) {
      throw new Error('API URL is missing. Check mobile/.env and restart Expo.');
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  };

  const loadDashboard = useCallback(async (showSpinner = true) => {
    if (!token) return;

    if (showSpinner) setRefreshing(true);

    try {
      const [loanData, summaryData] = await Promise.all([
        apiRequest('/loans'),
        apiRequest('/loans/summary'),
      ]);

      setLoans(Array.isArray(loanData) ? loanData : loanData.loans || []);
      setSummary({
        totalLent: Number(summaryData.totalLent || 0),
        totalRepaid: Number(summaryData.totalRepaid || 0),
        overdueAmount: Number(summaryData.overdueAmount || 0),
      });
    } catch (error) {
      Alert.alert(
        'Could not load dashboard',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY)
      .then(savedToken => {
        if (savedToken) setToken(savedToken);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (token) loadDashboard(false);
  }, [token, loadDashboard]);

  async function sendOtp() {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      Alert.alert('Invalid phone', 'Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });

      setOtpSent(true);
      Alert.alert('OTP generated', 'Check the backend terminal for the mock OTP.');
    } catch (error) {
      Alert.alert('Connection error', error instanceof Error ? error.message : 'Could not reach server.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Invalid OTP', 'Enter the six-digit OTP from your server terminal.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      });

      if (!data.token) throw new Error('The server did not return an authentication token.');

      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
    } catch (error) {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Could not verify OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function addLoan() {
    const cleanName = friendName.trim();
    const numericAmount = Number(amount);

    if (!cleanName) {
      Alert.alert('Missing name', "Enter your friend's name.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than zero.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD, for example 2026-10-30.');
      return;
    }

   const [year, month, day] = dueDate.split('-').map(Number);

const validDate =
  /^\d{4}-\d{2}-\d{2}$/.test(dueDate) &&
  year >= 1000 &&
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= new Date(Date.UTC(year, month, 0)).getUTCDate();

if (!validDate) {
  Alert.alert('Invalid date', 'Enter a real date in YYYY-MM-DD format, such as 2026-10-30.');
  return;
}

    setLoading(true);
    try {
      await apiRequest('/loans', {
        method: 'POST',
        body: JSON.stringify({
          friendName: cleanName,
          amount: numericAmount,
          dueDate,
        }),
      });

      setFriendName('');
      setAmount('');
      setDueDate('');
      setShowForm(false);
      await loadDashboard(false);
      Alert.alert('Success', 'Loan added successfully.');
    } catch (error) {
      Alert.alert('Could not add loan', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function confirmRepayment(loan: Loan) {
    Alert.alert(
      'Mark as repaid?',
      `Confirm that ${loan.friendName} has repaid ${money(loan.amount)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark repaid',
          onPress: () => {
            void markRepaid(loan);
          },
        },
      ]
    );
  }

  async function markRepaid(loan: Loan) {
    setLoading(true);
    try {
      await apiRequest(`/loans/${loan.id}/repay`, { method: 'PATCH' });
      await loadDashboard(false);
      Alert.alert('Success', 'Loan marked as repaid.');
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setPhone('');
    setOtp('');
    setOtpSent(false);
    setLoans([]);
    setSummary(emptySummary);
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          style={styles.loginContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.title}>MiniLedger</Text>
          <Text style={styles.subtitle}>Keep track of money lent to friends.</Text>

          <View style={styles.card}>
            <Text style={styles.heading}>{otpSent ? 'Verify your number' : 'Welcome back'}</Text>
            <Text style={styles.muted}>
              {otpSent ? 'Enter the mock OTP printed in your server terminal.' : 'Enter your mobile number to get started.'}
            </Text>

            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor="#8A94A6"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              editable={!otpSent && !loading}
              onChangeText={setPhone}
            />

            {otpSent && (
              <>
                <Text style={styles.label}>One-time password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="6-digit OTP"
                  placeholderTextColor="#8A94A6"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                />
              </>
            )}

            <TouchableOpacity style={styles.button} disabled={loading} onPress={otpSent ? verifyOtp : sendOtp}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{otpSent ? 'Verify & Continue' : 'Send OTP'}</Text>}
            </TouchableOpacity>

            {otpSent && (
              <TouchableOpacity style={styles.secondaryButton} onPress={() => { setOtpSent(false); setOtp(''); }}>
                <Text style={styles.greenText}>Change phone number</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.footer}>Simple, secure tracking for your personal loans.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.dashboard} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR PERSONAL FINANCES</Text>
            <Text style={styles.dashboardTitle}>MiniLedger</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Your overview</Text>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.greenCard]}>
            <Text style={styles.summaryLabel}>TOTAL LENT</Text>
            <Text style={styles.summaryValue}>{money(summary.totalLent)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.blueCard]}>
            <Text style={styles.summaryLabel}>REPAID</Text>
            <Text style={styles.summaryValue}>{money(summary.totalRepaid)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.redCard]}>
            <Text style={styles.summaryLabel}>OVERDUE</Text>
            <Text style={styles.summaryValue}>{money(summary.overdueAmount)}</Text>
          </View>
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your loans</Text>
            <Text style={styles.muted}>{loans.length} record{loans.length === 1 ? '' : 's'}</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(!showForm)}>
            <Text style={styles.addButtonText}>{showForm ? 'Cancel' : '+ Add loan'}</Text>
          </TouchableOpacity>
        </View>

        {showForm && (
          <View style={styles.card}>
            <Text style={styles.heading}>Add a loan</Text>
            <Text style={styles.label}>Friend's name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Rahul"
              placeholderTextColor="#8A94A6"
              value={friendName}
              onChangeText={setFriendName}
              maxLength={100}
            />
            <Text style={styles.label}>Amount (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1500"
              placeholderTextColor="#8A94A6"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <Text style={styles.label}>Due date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#8A94A6"
              value={dueDate}
              onChangeText={setDueDate}
              maxLength={10}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.button} disabled={loading} onPress={addLoan}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save loan</Text>}
            </TouchableOpacity>
          </View>
        )}

        {refreshing && <ActivityIndicator style={styles.loader} size="large" color="#166534" />}

        {!refreshing && loans.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No loans yet</Text>
            <Text style={styles.muted}>Tap “Add loan” to record money you lent to a friend.</Text>
          </View>
        )}

        {loans.map(loan => {
          const overdue = isOverdue(loan);
          return (
            <View key={String(loan.id)} style={[styles.loanCard, overdue && styles.overdueCard]}>
              <View style={styles.loanTop}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.avatarText}>{loan.friendName?.charAt(0)?.toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{loan.friendName}</Text>
                  <Text style={styles.dueDate}>Due {String(loan.dueDate).slice(0, 10)}</Text>
                </View>
                <View style={styles.amountInfo}>
                  <Text style={styles.loanAmount}>{money(loan.amount)}</Text>
                  <Text style={[styles.status, loan.isRepaid ? styles.repaidStatus : overdue ? styles.overdueStatus : styles.pendingStatus]}>
                    {loan.isRepaid ? 'REPAID' : overdue ? 'OVERDUE' : 'PENDING'}
                  </Text>
                </View>
              </View>

              {!loan.isRepaid && (
                <TouchableOpacity style={styles.repayButton} disabled={loading} onPress={() => confirmRepayment(loan)}>
                  <Text style={styles.repayButtonText}>✓ Mark as repaid</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={styles.refreshButton} onPress={() => loadDashboard(true)}>
          <Text style={styles.greenText}>↻ Refresh dashboard</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>MiniLedger • Your money, clearly tracked.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7FB' },
  loginContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  dashboard: { padding: 20, paddingBottom: 40 },
  logo: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#166534', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  logoText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  title: { fontSize: 32, fontWeight: '800', color: '#14251B', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#657368', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E5EBE7', marginBottom: 18 },
  heading: { fontSize: 22, fontWeight: '700', color: '#17251C' },
  muted: { fontSize: 13, color: '#778178', marginTop: 5, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '600', color: '#37463C', marginBottom: 8, marginTop: 14 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#DCE4DE', borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: '#17251C', backgroundColor: '#FCFDFC' },
  button: { minHeight: 52, backgroundColor: '#166534', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', paddingTop: 18 },
  greenText: { color: '#166534', fontWeight: '700' },
  footer: { textAlign: 'center', color: '#8A948D', fontSize: 12, marginTop: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 28 },
  eyebrow: { color: '#6B756E', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  dashboardTitle: { color: '#17251C', fontSize: 30, fontWeight: '800', marginTop: 4 },
  logoutButton: { borderWidth: 1, borderColor: '#DCE4DE', paddingVertical: 9, paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#FFFFFF' },
  logoutText: { color: '#37463C', fontWeight: '700' },
  sectionTitle: { color: '#17251C', fontSize: 19, fontWeight: '800', marginBottom: 12 },
  summaryGrid: { gap: 10, marginBottom: 30 },
  summaryCard: { padding: 17, borderRadius: 16 },
  greenCard: { backgroundColor: '#166534' },
  blueCard: { backgroundColor: '#1D4ED8' },
  redCard: { backgroundColor: '#991B1B' },
  summaryLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  summaryValue: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: 8 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  addButton: { backgroundColor: '#166534', borderRadius: 11, paddingVertical: 11, paddingHorizontal: 14 },
  addButtonText: { color: '#FFFFFF', fontWeight: '800' },
  emptyState: { alignItems: 'center', padding: 28, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5EBE7' },
  emptyTitle: { color: '#17251C', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  loader: { marginVertical: 25 },
  loanCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#E5EBE7' },
  overdueCard: { borderColor: '#FCA5A5', backgroundColor: '#FFF8F8' },
  loanTop: { flexDirection: 'row', alignItems: 'center' },
  friendAvatar: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  avatarText: { color: '#166534', fontSize: 19, fontWeight: '800' },
  friendInfo: { flex: 1 },
  friendName: { color: '#17251C', fontSize: 15, fontWeight: '800' },
  dueDate: { color: '#778178', fontSize: 12, marginTop: 5 },
  amountInfo: { alignItems: 'flex-end', marginLeft: 5 },
  loanAmount: { color: '#17251C', fontSize: 16, fontWeight: '800' },
  status: { fontSize: 9, fontWeight: '900', marginTop: 6, letterSpacing: 0.5 },
  repaidStatus: { color: '#166534' },
  overdueStatus: { color: '#B91C1C' },
  pendingStatus: { color: '#B45309' },
  repayButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, marginTop: 14 },
  repayButtonText: { color: '#166534', fontWeight: '700', fontSize: 12 },
  refreshButton: { alignItems: 'center', padding: 15, marginTop: 8 },
});
