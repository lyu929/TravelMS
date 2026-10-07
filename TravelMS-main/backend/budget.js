// Work in cents so threshold checks and remaining amounts agree with saved money.
function budgetSummary(allocated, recorded) {
  const budget = Math.round(Number(allocated) * 100);
  const spent = Math.round(Number(recorded) * 100);
  return {
    remaining: (budget - spent) / 100,
    overrun: Math.max(0, spent - budget) / 100,
    used_percent: budget > 0 ? Math.floor((spent * 10000) / budget) / 100 : null,
    state:
      spent > budget
        ? 'OVER'
        : budget === 0
          ? 'UNSET'
          : spent * 100 >= budget * 80
            ? 'NEAR'
            : 'ON_TRACK',
  };
}
module.exports = { budgetSummary };
