class Expense {
  constructor(
    expense_id,
    trip_id,
    user_id,
    category,
    amount,
    expense_date,
    description,
    receipt_url,
  ) {
    this.expense_id = expense_id;
    this.trip_id = trip_id;
    this.user_id = user_id;
    this.category = category;
    this.amount = amount;
    this.expense_date = expense_date;
    this.description = description;
    this.receipt_url = receipt_url;
  }
}
module.exports = Expense;
