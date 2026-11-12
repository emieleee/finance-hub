import {eom, inR, iso, P, payday30, savSigned, sum, today} from './utils.js';

export function payCycle(record) {
  if (!record.covStart || !record.covEnd) return '';
  const start = P(record.covStart);
  const end = P(record.covEnd);
  if (start.getDate() === 1 && end.getDate() === 15) return '1st-15th';
  if (end.getDate() === eom(end.getFullYear(), end.getMonth()).getDate()) return '16th-Month End';
  return 'Custom / Partial';
}

export function stdPayday(record) {
  const cycle = payCycle(record);
  if (!cycle || !record.covEnd) return '';
  const end = P(record.covEnd);
  if (cycle === '1st-15th') return iso(new Date(end.getFullYear(), end.getMonth(), 15));
  if (cycle === '16th-Month End') return iso(payday30(end.getFullYear(), end.getMonth()));
  return '';
}

export function timing(record) {
  if (!record.date) return 'Pending';
  const standardPayday = stdPayday(record);
  const due = record.adjPay || standardPayday;
  if (!due) return 'Unscheduled';
  if (record.date < due) return 'Paid Early';
  if (record.date > due) return 'Paid Late';
  if (record.adjPay && standardPayday && record.adjPay < standardPayday) return 'Adjusted Early';
  if (record.adjPay && standardPayday && record.adjPay > standardPayday) return 'Adjusted Late';
  return record.adjPay ? 'On Adjusted Date' : 'On Time';
}

export function periodRange(monthString, view) {
  const date = P(monthString);
  const year = date.getFullYear();
  const month = date.getMonth();
  const payday = payday30(year, month);
  switch (view) {
    case '1st-14th': return [iso(new Date(year, month, 1)), iso(new Date(year, month, 14))];
    case '15th-Payday Eve': return [iso(new Date(year, month, 15)), iso(new Date(payday.getTime() - 864e5))];
    case 'Payday-14th': return [iso(payday), iso(new Date(year, month + 1, 14))];
    default: return [iso(new Date(year, month, 1)), iso(eom(year, month))];
  }
}

export function createFinance(getState) {
  const state = getState;
  const isCredit = wallet => !!wallet && wallet.type === 'credit';
  const defaultWallet = () => {
    const wallets = state().wallets;
    const wallet = wallets.find(item => !isCredit(item)) || wallets[0];
    return wallet ? wallet.id : '';
  };
  const wById = id => state().wallets.find(wallet => wallet.id === id);
  const wOf = record => record && record.wallet && wById(record.wallet) ? record.wallet : defaultWallet();
  function wFlows(wallet, start, end, excludeAdjustmentId) {
    const data = state();
    const id = wallet.id;
    const income = sum(data.income.filter(record => wOf(record) === id && inR(record.date, start, end)));
    const expenses = sum(data.expenses.filter(record =>
      record.paidFrom !== 'Goal Funds' && wOf(record) === id && inR(record.date, start, end)));
    const deposits = sum(data.savings.filter(record =>
      record.action === 'Deposit' && wOf(record) === id && inR(record.date, start, end)));
    const withdrawals = sum(data.savings.filter(record =>
      record.action === 'Withdrawal' && wOf(record) === id && inR(record.date, start, end)));
    const transfersIn = sum(data.transfers.filter(record => record.to === id && inR(record.date, start, end)));
    const transfersOut = sum(data.transfers.filter(record => record.from === id && inR(record.date, start, end)));
    const adjustment = sum(data.adjustments.filter(record =>
      record.wallet === id && record.id !== excludeAdjustmentId && inR(record.date, start, end)), record => record.delta);
    return {in: income + withdrawals + transfersIn, out: expenses + deposits + transfersOut, adjustment};
  }
  function walletBal(wallet, end, excludeAdjustmentId) {
    const data = state();
    const flows = wFlows(wallet, data.settings.startDate, end || today(), excludeAdjustmentId);
    return (isCredit(wallet) ? -(+wallet.start || 0) : (+wallet.start || 0)) +
      flows.in - flows.out + flows.adjustment;
  }
  const srcOf = record => record.paidFrom === 'Goal Funds' ? '__goal' : wOf(record);
  const srcToFields = source => source === '__goal'
    ? {paidFrom: 'Goal Funds', wallet: ''}
    : {paidFrom: 'Cash Balance', wallet: source || defaultWallet()};
  const savingsRecordDelta = (record, account) => {
    const amount = +record.amount || 0;
    if (record.action === 'Deposit') return record.account === account ? amount : 0;
    if (record.action === 'Withdrawal') return record.account === account ? -amount : 0;
    if (record.action === 'Transfer') {
      const from = record.fromAccount || record.account;
      return (from === account ? -amount : 0) + (record.toAccount === account ? amount : 0);
    }
    return 0;
  };
  function savingsBal(account, end, excludeAdjustmentId) {
    const data = state();
    const until = end || today();
    const otherAccount = data.lists.savings.includes('General Savings')
      ? 'General Savings'
      : data.lists.savings.find(item => item !== 'Goal') || 'General Savings';
    const startBalance = account === 'Goal' ? +data.settings.startGoal || 0
      : account === otherAccount ? +data.settings.startOther || 0 : 0;
    const records = sum(data.savings.filter(record => inR(record.date, data.settings.startDate, until)),
      record => savingsRecordDelta(record, account));
    const adjustments = sum(data.adjustments.filter(record =>
      record.target === 'savings' && record.account === account && record.id !== excludeAdjustmentId &&
      inR(record.date, data.settings.startDate, until)), record => record.delta);
    const goalSpending = account === 'Goal'
      ? sum(data.expenses.filter(record => record.paidFrom === 'Goal Funds' &&
        inR(record.date, data.settings.startDate, until)))
      : 0;
    return startBalance + records + adjustments - goalSpending;
  }
  const ymOf = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;
  const nextPayday = fromIso => {
    const date = P(fromIso);
    const year = date.getFullYear();
    const month = date.getMonth();
    const fifteenth = new Date(year, month, 15);
    const thirtieth = payday30(year, month);
    if (date < fifteenth) return iso(fifteenth);
    if (date < thirtieth) return iso(thirtieth);
    return iso(new Date(year, month + 1, 15));
  };
  const billDue = (bill, year, month) =>
    iso(new Date(year, month, Math.min(+bill.dueDay || 1, eom(year, month).getDate())));
  const billPayment = (bill, month) =>
    state().expenses.find(expense => expense.billId === bill.id && expense.billMonth === month);
  function billAllotmentData(bill, month) {
    const saved = (bill.allotments || {})[month];
    if (typeof saved === 'number') return {amount: Math.max(0, saved), wallet: defaultWallet()};
    const data = state();
    const wallet = saved && data.wallets.some(item => item.id === saved.wallet && !isCredit(item))
      ? saved.wallet
      : defaultWallet();
    return {amount: Math.max(0, +(saved && saved.amount) || 0), wallet};
  }
  const billAllotment = (bill, month) => billAllotmentData(bill, month).amount;
  function billAllotmentSummary(bill, month) {
    const data = billAllotmentData(bill, month);
    const total = Math.max(0, +bill.amount || 0);
    return {
      amount: data.amount,
      total,
      remaining: Math.max(0, total - data.amount),
      progress: total ? Math.min(data.amount / total, 1) * 100 : 0,
      wallet: data.wallet
    };
  }
  function billState(bill, year, month) {
    const ym = ymOf(year, month);
    const due = billDue(bill, year, month);
    const paid = billPayment(bill, ym);
    if (paid) return {ym, due, st: 'paid', paid};
    if ((bill.skips || []).includes(ym)) return {ym, due, st: 'skipped'};
    const days = Math.round((P(due) - P(today())) / 864e5);
    return {ym, due, days, st: days < 0 ? 'overdue' : days <= 3 ? 'soon' : 'scheduled'};
  }
  function upcomingBills() {
    const date = P(today());
    const payday = nextPayday(iso(date));
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const months = [[date.getFullYear(), date.getMonth()], [nextMonth.getFullYear(), nextMonth.getMonth()]];
    const list = [];
    state().bills.filter(bill => bill.status !== 'Paused').forEach(bill => months.forEach(([year, month]) => {
      const item = billState(bill, year, month);
      if (item.st === 'paid' || item.st === 'skipped' || item.due > payday) return;
      if (bill.created && item.ym < bill.created.slice(0, 7)) return;
      list.push({b: bill, ...item});
    }));
    return {np: payday, list: list.sort((a, b) => a.due.localeCompare(b.due))};
  }
  function billsNeedingAllotment() {
    const date = P(today());
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const months = [[date.getFullYear(), date.getMonth()], [nextMonth.getFullYear(), nextMonth.getMonth()]];
    const list = [];
    state().bills.filter(bill => bill.status !== 'Paused').forEach(bill => months.forEach(([year, month]) => {
      const item = billState(bill, year, month);
      const remaining = billAllotmentSummary(bill, item.ym).remaining;
      if (item.days < 0 || item.days > 5 || item.st === 'paid' || item.st === 'skipped' ||
          (bill.created && item.ym < bill.created.slice(0, 7)) || remaining <= 0.005) return;
      list.push({b: bill, ...item, remaining});
    }));
    return list.sort((a, b) => a.due.localeCompare(b.due));
  }
  function billAllotments(month = today().slice(0, 7)) {
    const [year, monthNumber] = month.split('-').map(Number);
    const result = {};
    state().bills.forEach(bill => {
      if (bill.status === 'Paused' || (bill.created && month < bill.created.slice(0, 7))) return;
      const item = billState(bill, year, monthNumber - 1);
      if (item.st === 'paid' || item.st === 'skipped') return;
      const allotment = billAllotmentData(bill, month);
      const wallet = wById(allotment.wallet);
      if (allotment.amount && wallet && !isCredit(wallet))
        result[allotment.wallet] = (result[allotment.wallet] || 0) + allotment.amount;
    });
    return result;
  }
  const billAllotted = (wallet, month) => billAllotments(month)[wallet] || 0;
  function balances(asOf) {
    const data = state();
    const start = data.settings.startDate;
    const end = asOf || today();
    const income = sum(data.income.filter(record => inR(record.date, start, end)));
    const cashExp = sum(data.expenses.filter(record =>
      record.paidFrom !== 'Goal Funds' && inR(record.date, start, end)));
    const goalExp = sum(data.expenses.filter(record =>
      record.paidFrom === 'Goal Funds' && inR(record.date, start, end)));
    const savings = data.savings.filter(record => inR(record.date, start, end));
    const netSav = sum(savings, savSigned);
    const goalSav = sum(savings, record => savingsRecordDelta(record, 'Goal'));
    const savingsAdjustments = data.adjustments.filter(record =>
      record.target === 'savings' && inR(record.date, start, end));
    const goalAdjustment = sum(savingsAdjustments.filter(record => record.account === 'Goal'), record => record.delta);
    const otherAdjustment = sum(savingsAdjustments.filter(record => record.account !== 'Goal'), record => record.delta);
    const goalFunds = (+data.settings.startGoal || 0) + goalSav + goalAdjustment - goalExp;
    const other = (+data.settings.startOther || 0) + netSav - goalSav + otherAdjustment;
    const cash = sum(data.wallets.filter(wallet => !isCredit(wallet)), wallet => walletBal(wallet, end));
    const owed = -sum(data.wallets.filter(isCredit), wallet => walletBal(wallet, end));
    const reserved = end === today() ? sum(Object.values(billAllotments()), amount => amount) : 0;
    return {inc: income, cashExp, goalExp, netSav, cash, availableCash: cash - reserved, owed,
      other, goalFunds, totalSav: other + goalFunds};
  }
  function periodStats(start, end) {
    const data = state();
    const income = sum(data.income.filter(record => inR(record.date, start, end)));
    const expenses = sum(data.expenses.filter(record => inR(record.date, start, end)));
    const creditWallets = new Set(data.wallets.filter(isCredit).map(wallet => wallet.id));
    const cashExp = sum(data.expenses.filter(record =>
      record.paidFrom !== 'Goal Funds' && !creditWallets.has(wOf(record)) && inR(record.date, start, end)));
    const creditExp = sum(data.expenses.filter(record =>
      record.paidFrom !== 'Goal Funds' && creditWallets.has(wOf(record)) && inR(record.date, start, end)));
    const goalExpP = sum(data.expenses.filter(record =>
      record.paidFrom === 'Goal Funds' && inR(record.date, start, end)));
    const cardPay = sum(data.transfers.filter(record =>
      inR(record.date, start, end) && !creditWallets.has(record.from) && creditWallets.has(record.to))) -
      sum(data.transfers.filter(record =>
        inR(record.date, start, end) && creditWallets.has(record.from) && !creditWallets.has(record.to)));
    const deposits = sum(data.savings.filter(record => record.action === 'Deposit' && inR(record.date, start, end)));
    const withdrawals = sum(data.savings.filter(record => record.action === 'Withdrawal' && inR(record.date, start, end)));
    const netSav = deposits - withdrawals;
    const net = income - cashExp - cardPay - netSav;
    const before = iso(new Date(P(start).getTime() - 864e5));
    const opening = start <= data.settings.startDate
      ? sum(data.wallets.filter(wallet => !isCredit(wallet)), wallet => +wallet.start || 0)
      : balances(before).cash;
    const adjustment = sum(data.adjustments.filter(record =>
      record.target !== 'savings' && !isCredit(wById(record.wallet)) && inR(record.date, start, end)), record => record.delta);
    return {inc: income, exp: expenses, cashExp, creditExp, goalExpP, cardPay, dep: deposits, wd: withdrawals,
      netSav, net, rate: income ? netSav / income : 0, opening, adjustment, closing: opening + net + adjustment,
      savEnd: balances(end).totalSav};
  }
  function goalStats() {
    return state().goals.map(goal => {
      const alloc = sum(state().allocs.filter(item => item.goal === goal.id));
      const need = Math.max(goal.target - alloc, 0);
      const fraction = goal.target > 0 ? Math.min(alloc / goal.target, 1) : 0;
      const status = need === 0 ? 'Goal Achieved' : goal.date && today() > goal.date ? 'Past Target' : 'In Progress';
      return {...goal, alloc, need, f: fraction, status};
    });
  }
  function monthsList() {
    const data = state();
    const start = P(data.settings.startDate);
    const dates = [...data.income, ...data.expenses, ...data.savings, ...data.transfers, ...data.adjustments]
      .map(record => record.date).filter(Boolean).sort();
    const now = new Date();
    const last = dates.length ? P(dates[dates.length - 1]) : now;
    const endMonth = Math.max(last.getFullYear() * 12 + last.getMonth(), now.getFullYear() * 12 + now.getMonth()) + 1;
    const months = [];
    for (let index = start.getFullYear() * 12 + start.getMonth(); index <= endMonth; index++)
      months.push(iso(new Date(Math.floor(index / 12), index % 12, 1)));
    return months;
  }
  return {
    isCredit, defaultWallet, wById, wOf, wFlows, walletBal, srcOf, srcToFields, nextPayday,
    billDue, billPayment, billAllotmentData, billAllotment, billAllotmentSummary, billState,
    upcomingBills, billsNeedingAllotment, billAllotments, billAllotted, balances, periodStats,
    goalStats, savingsBal, monthsList
  };
}
